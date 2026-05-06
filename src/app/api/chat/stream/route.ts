import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/gemini/client";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";
import { matchKnowledge } from "@/server/repositories/knowledge-repository";
import { listAgentsByConversation } from "@/server/repositories/conversation-agents-repository";
import { generateQueryEmbedding } from "@/server/services/ai/providers/gemini-embeddings";

export const runtime = "nodejs";

type RuntimeAgent = {
  id: string;
  slug?: string | null;
  nome: string;
  descricao: string | null;
  prompt_base: string;
  provider: "gemini" | "openai";
  model: string;
  temperature: number;
  max_history_messages: number;
  knowledge_space_id?: string | null;
  ordem?: number | null;
};

type Message = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  role: "user" | "assistant" | "system";
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AgentAction = {
  action: "call_agent";
  agent: string;
  reason?: string;
};

type ModelErrorCode =
  | "MODEL_TEMPORARILY_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "MODEL_RATE_LIMITED"
  | "MODEL_STREAM_INTERRUPTED"
  | "MODEL_UNKNOWN_ERROR";

type ModelErrorInfo = {
  code: ModelErrorCode;
  status?: number;
  message: string;
  retryable: boolean;
};

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function sanitizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getMetadata(message: Pick<Message, "metadata">) {
  return (message.metadata ?? {}) as Record<string, unknown>;
}

function isFailedOrInvalidHistoryMessage(message: Message) {
  const metadata = getMetadata(message);
  const status = metadata.status;

  return (
    status === "failed" ||
    status === "partial" ||
    status === "superseded" ||
    status === "streaming"
  );
}

function shouldIncludeHistoryMessageForAgent(params: {
  message: Message;
  currentAgentId: string;
  currentUserMessageId: string;
  isMultiAgentChain: boolean;
}) {
  const { message, currentAgentId, currentUserMessageId, isMultiAgentChain } = params;

  // A mensagem atual do usuário é adicionada no fim de `contents`, então evita duplicidade.
  if (message.id === currentUserMessageId) return false;

  if (isFailedOrInvalidHistoryMessage(message)) return false;

  // Histórico do usuário é seguro para todos os agentes.
  if (message.role === "user") return true;

  if (message.role !== "assistant") return false;

  const metadata = getMetadata(message);

  // Em conversas encadeadas, não reaproveita respostas antigas de assistentes.
  // Isso evita um agente usar valores/dados que vieram de outro agente em rodada anterior.
  if (isMultiAgentChain) return false;

  // Em conversa de agente único, mantém somente respostas antigas do mesmo agente.
  return metadata.agent_id === currentAgentId;
}

function tryParseAgentAction(text: string): AgentAction | null {
  try {
    const matches = text.match(/\{[\s\S]*?\}/g);

    if (!matches) return null;

    for (const match of matches) {
      const parsed = JSON.parse(match) as Partial<AgentAction>;

      if (
        parsed.action === "call_agent" &&
        typeof parsed.agent === "string" &&
        parsed.agent.trim()
      ) {
        return {
          action: "call_agent",
          agent: parsed.agent.trim(),
          reason:
            typeof parsed.reason === "string" ? parsed.reason.trim() : undefined,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function removeActionJson(text: string) {
  return text
    .replace(/\{[\s\S]*?"action"\s*:\s*"call_agent"[\s\S]*?\}/g, "")
    .trim();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Tempo limite excedido."
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

class ModelGenerationError extends Error {
  code: ModelErrorCode;
  status?: number;
  partialContent?: string;

  constructor(params: {
    message: string;
    code: ModelErrorCode;
    status?: number;
    partialContent?: string;
  }) {
    super(params.message);
    this.name = "ModelGenerationError";
    this.code = params.code;
    this.status = params.status;
    this.partialContent = params.partialContent;
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const maybeError = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown };
  };

  const status =
    maybeError.status ??
    maybeError.response?.status ??
    maybeError.cause?.status ??
    maybeError.code;

  if (typeof status === "number") return status;

  if (typeof status === "string") {
    const parsed = Number(status);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function classifyModelError(error: unknown): ModelErrorInfo {
  const status = getErrorStatus(error);
  const rawMessage =
    error instanceof Error ? error.message : "Erro ao gerar resposta.";

  const lowerMessage = rawMessage.toLowerCase();

  if (
    status === 503 ||
    lowerMessage.includes("503") ||
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("overloaded")
  ) {
    return {
      code: "MODEL_TEMPORARILY_UNAVAILABLE",
      status: 503,
      retryable: true,
      message:
        "O provedor de IA está temporariamente indisponível. Tente novamente em instantes.",
    };
  }

  if (
    status === 429 ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("rate limit")
  ) {
    return {
      code: "MODEL_RATE_LIMITED",
      status: 429,
      retryable: true,
      message:
        "O provedor de IA limitou temporariamente as requisições. Tente novamente em instantes.",
    };
  }

  if (status === 500 || status === 502 || status === 504) {
    return {
      code: "MODEL_TEMPORARILY_UNAVAILABLE",
      status,
      retryable: true,
      message:
        "O provedor de IA falhou temporariamente. Tente novamente em instantes.",
    };
  }

  if (
    lowerMessage.includes("tempo limite") ||
    lowerMessage.includes("timeout") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return {
      code: "MODEL_TIMEOUT",
      status,
      retryable: true,
      message: "A resposta demorou mais que o esperado e foi interrompida.",
    };
  }

  return {
    code: "MODEL_UNKNOWN_ERROR",
    status,
    retryable: false,
    message: rawMessage || "Erro ao gerar resposta.",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProbablyIncompleteAnswer(text: string) {
  const trimmed = text.trim();

  if (!trimmed) return true;
  if (trimmed.length < 40) return true;

  const suspiciousPatterns = [
    /\|\s*$/,
    /-\s*$/,
    /:\s*$/,
    /\bR\$\s*$/,
    /\bOpção\s*$/i,
    /\*\*Opção\s*$/i,
    /\bPlano\s*$/i,
    /\bCusto\s*$/i,
    /\bQuantidade\s*$/i,
    /\bSugestão de Venda\s*$/i,
    /\bModelo\s*$/i,
    /\bEquipamento\s*$/i,
  ];

  if (suspiciousPatterns.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  const boldMarkerCount = (trimmed.match(/\*\*/g) ?? []).length;
  if (boldMarkerCount % 2 !== 0) return true;

  const codeFenceCount = (trimmed.match(/```/g) ?? []).length;
  if (codeFenceCount % 2 !== 0) return true;

  return false;
}

async function withRetryBeforeStreaming<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    delaysMs?: number[];
  }
): Promise<T> {
  const retries = options?.retries ?? 2;
  const delaysMs = options?.delaysMs ?? [800, 2000];

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const classified = classifyModelError(error);

      if (!classified.retryable || attempt >= retries) {
        throw error;
      }

      await sleep(delaysMs[attempt] ?? 2000);
    }
  }

  throw lastError;
}

function findTargetAgent(params: {
  requestedAgent: string;
  availableAgents: RuntimeAgent[];
  currentAgentId: string;
}) {
  const requested = normalizeText(params.requestedAgent);

  return (
    params.availableAgents.find((agent) => {
      if (agent.id === params.currentAgentId) return false;

      const name = normalizeText(agent.nome);
      const description = normalizeText(agent.descricao ?? "");

      return (
        name === requested ||
        name.includes(requested) ||
        requested.includes(name) ||
        description.includes(requested)
      );
    }) ?? null
  );
}

async function saveMessage(params: {
  conversationId: string;
  userId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown> | null;
}): Promise<Message> {
  const supabase = await createClient();

  const payload = sanitizeJson({
    conversation_id: params.conversationId,
    user_id: params.userId ?? null,
    role: params.role,
    content: params.content,
    metadata: params.metadata ?? null,
  });

  const { data, error } = await supabase
    .from("messages")
    .insert(payload)
    .select("id, conversation_id, user_id, role, content, metadata, created_at")
    .single();

  if (error || !data) {
    console.error("Erro ao salvar mensagem no Supabase:", {
      error,
      payload: {
        ...payload,
        content:
          payload.content.length > 500
            ? `${payload.content.slice(0, 500)}...`
            : payload.content,
      },
    });

    throw new Error(
      error?.message
        ? `Erro ao salvar mensagem: ${error.message}`
        : "Erro ao salvar mensagem."
    );
  }

  return data as Message;
}

function buildSystemInstruction(
  agent: RuntimeAgent,
  knowledge: string,
  availableAgents: RuntimeAgent[]
): string {
  const availableAgentNames = availableAgents
    .filter((item) => item.id !== agent.id)
    .map((item) => `- ${item.nome}${item.descricao ? `: ${item.descricao}` : ""}`)
    .join("\n");

  return [
    `Você é o agente "${agent.nome}".`,
    agent.descricao ? `Descrição: ${agent.descricao}` : null,
    "",
    "Siga rigorosamente o prompt base abaixo:",
    agent.prompt_base,
    knowledge.trim()
      ? ["", "INFORMAÇÕES IMPORTANTES (use como base da resposta):", knowledge].join(
          "\n"
        )
      : null,
    "",
    "Agentes disponíveis para apoio nesta conversa:",
    availableAgentNames || "- Nenhum outro agente disponível.",
    "",
    "Automação entre agentes:",
    "Se você realmente precisar da ajuda de outro agente, inclua AO FINAL da sua resposta um JSON puro neste formato:",
    `{"action":"call_agent","agent":"nome do agente","reason":"motivo da chamada"}`,
    "Use isso com moderação. Não use se conseguir responder bem sozinho.",
    "",
    "Regras:",
    "- Responda estritamente dentro do seu papel de agente.",
    "- Use a base de conhecimento recebida nesta mensagem como fonte principal.",
    "- Não use valores, preços, custos ou dados técnicos que não estejam na sua base de conhecimento ou no contexto da rodada atual.",
    "- Se outro agente anterior trouxer informação fora do seu escopo, use apenas para entender o cenário, não para assumir autoridade sobre esses dados.",
    "- Não invente dados.",
    "- Se faltar contexto suficiente, diga isso claramente.",
    "- Responda em português do Brasil.",
    "- Antes de dizer que não possui uma informação, verifique o contexto da base de conhecimento fornecido nesta mensagem.",
    "- Se o contexto trouxer qualquer dado relacionado à pergunta, responda com base nele.",
    "- Não copie trechos longos da base de conhecimento.",
    "- Resuma a informação em linguagem natural.",
    "- Seja objetivo: responda primeiro em até 5 linhas e só detalhe se o usuário pedir.",
    "- Para perguntas sobre valores, planos, preços, custos ou tabela, procure no contexto antes de negar a informação.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function getFallbackAgent(conversationId: string): Promise<RuntimeAgent | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      agents (
        id,
        slug,
        nome,
        descricao,
        prompt_base,
        provider,
        model,
        temperature,
        max_history_messages
      )
    `
    )
    .eq("id", conversationId)
    .single();

  if (error || !data?.agents) {
    return null;
  }

  const agent = Array.isArray(data.agents) ? data.agents[0] : data.agents;

  return agent as RuntimeAgent;
}

function extractJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}

async function planAgentExecution(params: {
  ai: ReturnType<typeof getGeminiClient>;
  model: string;
  content: string;
  agents: RuntimeAgent[];
}) {
  if (params.agents.length <= 1) {
    return params.agents;
  }

  const agentList = params.agents
    .map(
      (agent, index) =>
        `${index + 1}. ${agent.nome}${agent.descricao ? ` — ${agent.descricao}` : ""}`
    )
    .join("\n");

  const prompt = [
    "Você é o orquestrador do Pandora.",
    "",
    "Sua função é escolher quais agentes devem responder e em qual ordem.",
    "",
    "Use SOMENTE os agentes disponíveis abaixo.",
    "Não invente agentes.",
    "Se todos forem úteis, inclua todos.",
    "Se algum agente não for útil para a pergunta, omita.",
    "",
    "Responda APENAS com JSON válido neste formato:",
    `{"plan":["nome exato do agente 1","nome exato do agente 2"],"reason":"motivo curto"}`,
    "",
    "AGENTES DISPONÍVEIS:",
    agentList,
    "",
    "PERGUNTA DO USUÁRIO:",
    params.content,
  ].join("\n");

  try {
    const result = await params.ai.models.generateContent({
      model: params.model,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        temperature: 0.2,
      },
    });

    const text = result.text ?? "";
    const parsed = extractJsonObject(text) as
      | { plan?: unknown; reason?: unknown }
      | null;

    if (!parsed || !Array.isArray(parsed.plan)) {
      return params.agents;
    }

    const normalizedPlan = parsed.plan
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeText(item));

    const selectedAgents = normalizedPlan
      .map((plannedName) =>
        params.agents.find((agent) => normalizeText(agent.nome) === plannedName)
      )
      .filter(Boolean) as RuntimeAgent[];

    if (selectedAgents.length === 0) {
      return params.agents;
    }

    return selectedAgents;
  } catch {
    return params.agents;
  }
}

function buildClientOnlyMessage(params: {
  id: string;
  conversationId: string;
  role: "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
}): Message {
  return {
    id: params.id,
    conversation_id: params.conversationId,
    user_id: null,
    role: params.role,
    content: params.content,
    metadata: params.metadata,
    created_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const { conversationId, content } = await req.json();

  if (!conversationId || !content) {
    return new Response("Invalid payload", { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const savedUserMessage = await saveMessage({
    conversationId,
    userId: user.id,
    role: "user",
    content,
    metadata: null,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            sse({
              type: "saved_user",
              message: savedUserMessage,
            })
          )
        );

        const history = (await getMessagesByConversationId(conversationId)) as Message[];
        const ai = getGeminiClient();

        const conversationAgents = await listAgentsByConversation(conversationId);

        let agentsToUse: RuntimeAgent[] = conversationAgents as RuntimeAgent[];

        if (agentsToUse.length === 0) {
          const fallbackAgent = await getFallbackAgent(conversationId);

          if (fallbackAgent) {
            agentsToUse = [fallbackAgent];
          }
        }

        if (agentsToUse.length === 0) {
          throw new Error("Nenhum agente disponível para responder.");
        }

        // O planAgentExecution fica disponível para uso futuro, mas por enquanto mantemos a ordem fixa
        // retornada por listAgentsByConversation para preservar a conversa encadeada.
        void planAgentExecution;

        const orchestrationLocked = agentsToUse.length > 1;

        if (agentsToUse.length > 1) {
          controller.enqueue(
            encoder.encode(
              sse({
                type: "orchestration_plan",
                agents: agentsToUse.map((agent) => ({
                  id: agent.id,
                  name: agent.nome,
                })),
              })
            )
          );
        }

        const queryEmbedding = await generateQueryEmbedding(content);

        const previousAgentResponses: Array<{
          agentId: string;
          agentName: string;
          content: string;
        }> = [];

        const queuedAgentIds = new Set(agentsToUse.map((agent) => agent.id));
        const executedAgentIds = new Set<string>();

        let dynamicCalls = 0;
        const MAX_DYNAMIC_CALLS = 2;

        for (let index = 0; index < agentsToUse.length; index += 1) {
          const agent = agentsToUse[index];

          if (!agent || executedAgentIds.has(agent.id)) {
            continue;
          }

          executedAgentIds.add(agent.id);

          let fullResponse = "";
          let knowledge = "";

          try {
            const matches = await matchKnowledge({
              agentId: agent.id,
              conversationId,
              embedding: queryEmbedding,
              query: content,
              threshold: 0.35,
              count: 4,
            });

            knowledge = matches.map((item) => item.content).join("\n\n");
          } catch (error) {
            console.error("Erro ao consultar base de conhecimento:", {
              agentId: agent.id,
              agentName: agent.nome,
              error,
            });

            knowledge = "";
          }

          const systemInstruction = buildSystemInstruction(agent, knowledge, agentsToUse);

          const chainContext = previousAgentResponses.length
            ? [
                "RESPOSTAS DOS AGENTES ANTERIORES NESTA RODADA:",
                ...previousAgentResponses.map(
                  (response, responseIndex) =>
                    `#${responseIndex + 1} ${response.agentName}:\n${response.content}`
                ),
                "",
                "Use essas respostas como contexto adicional apenas quando estiverem dentro do seu papel. Você pode complementar, corrigir, validar ou discordar de forma objetiva.",
              ].join("\n\n")
            : "";

          const finalSystemInstruction = [
            systemInstruction,
            chainContext ? `\n\n${chainContext}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          const filteredHistory = history.filter((message) =>
            shouldIncludeHistoryMessageForAgent({
              message,
              currentAgentId: agent.id,
              currentUserMessageId: savedUserMessage.id,
              isMultiAgentChain: orchestrationLocked,
            })
          );

          const limitedHistory = filteredHistory.slice(
            -(agent.max_history_messages ?? 12)
          );

          const contents = [
            {
              role: "user" as const,
              parts: [{ text: finalSystemInstruction }],
            },
            ...limitedHistory.map((message) => ({
              role: message.role === "assistant" ? ("model" as const) : ("user" as const),
              parts: [{ text: message.content ?? "" }],
            })),
            {
              role: "user" as const,
              parts: [{ text: content }],
            },
          ];

          let generationFailed = false;
          let generationPartial = false;
          let generationError: ModelErrorInfo | null = null;

          try {
            fullResponse = await withTimeout(
              (async () => {
                let accumulated = "";
                let receivedAnyToken = false;

                let responseStream;

                try {
                  responseStream = await withRetryBeforeStreaming(
                    () =>
                      ai.models.generateContentStream({
                        model: agent.model,
                        contents,
                        config: {
                          temperature: agent.temperature,
                          maxOutputTokens: 2000,
                        },
                      }),
                    {
                      retries: 2,
                      delaysMs: [800, 2000],
                    }
                  );
                } catch (error) {
                  const classified = classifyModelError(error);

                  throw new ModelGenerationError({
                    message: classified.message,
                    code: classified.code,
                    status: classified.status,
                    partialContent: accumulated,
                  });
                }

                try {
                  for await (const chunk of responseStream) {
                    const text = chunk.text ?? "";

                    if (!text) continue;

                    receivedAnyToken = true;
                    accumulated += text;

                    controller.enqueue(
                      encoder.encode(
                        sse({
                          type: "token",
                          token: text,
                          agentId: agent.id,
                          agentName: agent.nome,
                        })
                      )
                    );
                  }
                } catch (error) {
                  const classified = classifyModelError(error);

                  throw new ModelGenerationError({
                    message: receivedAnyToken
                      ? "A resposta foi interrompida antes de terminar."
                      : classified.message,
                    code: receivedAnyToken
                      ? "MODEL_STREAM_INTERRUPTED"
                      : classified.code,
                    status: classified.status,
                    partialContent: accumulated,
                  });
                }

                return accumulated;
              })(),
              75000,
              `Tempo limite excedido para o agente ${agent.nome}.`
            );

            if (isProbablyIncompleteAnswer(fullResponse)) {
              generationPartial = true;
              generationError = {
                code: "MODEL_STREAM_INTERRUPTED",
                message: "A resposta parece incompleta. Recomenda-se tentar novamente.",
                retryable: true,
              };

              controller.enqueue(
                encoder.encode(
                  sse({
                    type: "agent_warning",
                    agentId: agent.id,
                    agentName: agent.nome,
                    code: generationError.code,
                    message: generationError.message,
                    retryable: true,
                  })
                )
              );
            }
          } catch (error) {
            generationFailed = true;

            if (error instanceof ModelGenerationError) {
              generationError = {
                code: error.code,
                status: error.status,
                message: error.message,
                retryable: true,
              };

              fullResponse = error.partialContent?.trim() || "";
              generationPartial = Boolean(fullResponse);
            } else {
              const classified = classifyModelError(error);

              generationError = classified;
              fullResponse = "";
            }

            const errorMessage = generationPartial
              ? "\n\n> ⚠️ A resposta foi interrompida antes de terminar. Você pode tentar novamente."
              : generationError.message;

            controller.enqueue(
              encoder.encode(
                sse({
                  type: "agent_error",
                  agentId: agent.id,
                  agentName: agent.nome,
                  code: generationError.code,
                  status: generationError.status ?? null,
                  message: generationError.message,
                  retryable: generationError.retryable,
                  partial: generationPartial,
                })
              )
            );

            if (!generationPartial) {
              controller.enqueue(
                encoder.encode(
                  sse({
                    type: "token",
                    token: errorMessage,
                    agentId: agent.id,
                    agentName: agent.nome,
                  })
                )
              );
            }

            fullResponse = generationPartial
              ? `${fullResponse}${errorMessage}`
              : errorMessage;
          }

          const action = tryParseAgentAction(fullResponse);
          const cleanResponse = removeActionJson(fullResponse);

          const assistantMetadata = sanitizeJson({
            agent_id: agent.id,
            agent_slug: agent.slug ?? null,
            agent_name: agent.nome,

            status: generationFailed
              ? "failed"
              : generationPartial
                ? "partial"
                : "completed",

            retryable: generationError?.retryable ?? false,

            error: generationError
              ? {
                  code: generationError.code,
                  status: generationError.status ?? null,
                  message: generationError.message,
                }
              : null,

            original_user_message_id: savedUserMessage.id,

            orchestration: {
              mode: "chain",
              order: agent.ordem ?? index + 1,
              dynamic_call: false,
              previous_agents: previousAgentResponses.map((response) => ({
                agent_id: response.agentId,
                agent_name: response.agentName,
              })),
            },
          });

          let assistantMessage: Message;

          try {
            assistantMessage = await saveMessage({
              conversationId,
              userId: null,
              role: "assistant",
              content: cleanResponse || fullResponse,
              metadata: assistantMetadata,
            });
          } catch (error) {
            console.error("Falha ao persistir resposta do agente:", {
              agentId: agent.id,
              agentName: agent.nome,
              error,
            });

            const persistedErrorMessage =
              error instanceof Error ? error.message : "Erro ao salvar mensagem.";

            assistantMessage = buildClientOnlyMessage({
              id: `unsaved-${agent.id}-${Date.now()}`,
              conversationId,
              role: "assistant",
              content: `${cleanResponse || fullResponse}\n\n> ⚠️ Esta resposta foi gerada, mas não foi salva no banco. Erro: ${persistedErrorMessage}`,
              metadata: {
                ...assistantMetadata,
                status: "failed",
                retryable: false,
                error: {
                  code: "MESSAGE_SAVE_FAILED",
                  status: null,
                  message: persistedErrorMessage,
                },
              },
            });

            controller.enqueue(
              encoder.encode(
                sse({
                  type: "agent_error",
                  agentId: agent.id,
                  agentName: agent.nome,
                  code: "MESSAGE_SAVE_FAILED",
                  status: null,
                  message: persistedErrorMessage,
                  retryable: false,
                  partial: false,
                })
              )
            );
          }

          controller.enqueue(
            encoder.encode(
              sse({
                type: "final",
                message: assistantMessage,
              })
            )
          );

          if (!generationFailed && !generationPartial) {
            previousAgentResponses.push({
              agentId: agent.id,
              agentName: agent.nome,
              content: cleanResponse || fullResponse,
            });
          } else {
            previousAgentResponses.push({
              agentId: agent.id,
              agentName: agent.nome,
              content:
                "Este agente não conseguiu concluir a resposta por falha temporária do provedor de IA.",
            });
          }

          if (
            !orchestrationLocked &&
            action?.action === "call_agent" &&
            dynamicCalls < MAX_DYNAMIC_CALLS
          ) {
            const targetAgent = findTargetAgent({
              requestedAgent: action.agent,
              availableAgents: agentsToUse,
              currentAgentId: agent.id,
            });

            if (
              targetAgent &&
              !executedAgentIds.has(targetAgent.id) &&
              !queuedAgentIds.has(targetAgent.id)
            ) {
              dynamicCalls += 1;
              queuedAgentIds.add(targetAgent.id);
              agentsToUse.push(targetAgent);

              controller.enqueue(
                encoder.encode(
                  sse({
                    type: "agent_call",
                    fromAgentId: agent.id,
                    fromAgentName: agent.nome,
                    toAgentId: targetAgent.id,
                    toAgentName: targetAgent.nome,
                    reason: action.reason ?? null,
                  })
                )
              );
            }
          }
        }

        if (previousAgentResponses.length > 1) {
          let finalSynthesis = "";

          const synthesisInstruction = [
            "Você é o sintetizador final do Pandora.",
            "",
            "Sua função é consolidar as respostas dos agentes anteriores em uma resposta final clara, objetiva e útil para o usuário.",
            "",
            "Regras:",
            "- Não repita todas as respostas integralmente.",
            "- Destaque os pontos principais.",
            "- Resolva conflitos entre agentes, se houver.",
            "- Se algum agente trouxe informação mais específica, priorize essa informação.",
            "- Se um agente falhou, informe de forma discreta que aquela parte precisa ser tentada novamente ou revisada.",
            "- Responda em português do Brasil.",
            "- Seja direto, mas completo.",
            "- Responda em no máximo 8 linhas.",
            "- Não reexplique o raciocínio dos agentes.",
            "- Traga apenas a resposta consolidada final.",
            "",
            "PERGUNTA ORIGINAL DO USUÁRIO:",
            content,
            "",
            "RESPOSTAS DOS AGENTES:",
            ...previousAgentResponses.map(
              (response, index) =>
                `#${index + 1} ${response.agentName}:\n${response.content}`
            ),
          ].join("\n\n");

          let synthesisFailed = false;
          let synthesisError: ModelErrorInfo | null = null;

          try {
            finalSynthesis = await withTimeout(
              (async () => {
                const synthesisStream = await withRetryBeforeStreaming(
                  () =>
                    ai.models.generateContentStream({
                      model: agentsToUse[0]?.model ?? "gemini-2.0-flash",
                      contents: [
                        {
                          role: "user",
                          parts: [{ text: synthesisInstruction }],
                        },
                      ],
                      config: {
                        temperature: 0.4,
                        maxOutputTokens: 2000,
                      },
                    }),
                  {
                    retries: 2,
                    delaysMs: [800, 2000],
                  }
                );

                let accumulated = "";

                for await (const chunk of synthesisStream) {
                  const text = chunk.text ?? "";

                  if (!text) continue;

                  accumulated += text;

                  controller.enqueue(
                    encoder.encode(
                      sse({
                        type: "token",
                        token: text,
                        agentId: "pandora-synthesis",
                        agentName: "Síntese Pandora",
                      })
                    )
                  );
                }

                return accumulated;
              })(),
              75000,
              "Tempo limite excedido na síntese final."
            );
          } catch (error) {
            synthesisFailed = true;
            synthesisError = classifyModelError(error);

            finalSynthesis =
              "Não consegui concluir a síntese final por instabilidade temporária do provedor de IA. As respostas individuais dos agentes acima foram preservadas.";

            controller.enqueue(
              encoder.encode(
                sse({
                  type: "agent_error",
                  agentId: "pandora-synthesis",
                  agentName: "Síntese Pandora",
                  code: synthesisError.code,
                  status: synthesisError.status ?? null,
                  message: synthesisError.message,
                  retryable: synthesisError.retryable,
                  partial: false,
                })
              )
            );

            controller.enqueue(
              encoder.encode(
                sse({
                  type: "token",
                  token: finalSynthesis,
                  agentId: "pandora-synthesis",
                  agentName: "Síntese Pandora",
                })
              )
            );
          }

          const synthesisMetadata = sanitizeJson({
            agent_id: "pandora-synthesis",
            agent_name: "Síntese Pandora",

            status: synthesisFailed ? "failed" : "completed",
            // Não habilita retry da síntese por enquanto, porque ela não existe na tabela agents.
            retryable: false,
            error: synthesisError
              ? {
                  code: synthesisError.code,
                  status: synthesisError.status ?? null,
                  message: synthesisError.message,
                }
              : null,

            original_user_message_id: savedUserMessage.id,

            orchestration: {
              mode: "synthesis",
              source_agents: previousAgentResponses.map((response) => ({
                agent_id: response.agentId,
                agent_name: response.agentName,
              })),
            },
          });

          let synthesisMessage: Message;

          try {
            synthesisMessage = await saveMessage({
              conversationId,
              userId: null,
              role: "assistant",
              content: finalSynthesis,
              metadata: synthesisMetadata,
            });
          } catch (error) {
            console.error("Falha ao persistir síntese:", error);

            const persistedErrorMessage =
              error instanceof Error ? error.message : "Erro ao salvar síntese.";

            synthesisMessage = buildClientOnlyMessage({
              id: `unsaved-pandora-synthesis-${Date.now()}`,
              conversationId,
              role: "assistant",
              content: `${finalSynthesis}\n\n> ⚠️ Esta síntese foi gerada, mas não foi salva no banco. Erro: ${persistedErrorMessage}`,
              metadata: {
                ...synthesisMetadata,
                status: "failed",
                retryable: false,
                error: {
                  code: "MESSAGE_SAVE_FAILED",
                  status: null,
                  message: persistedErrorMessage,
                },
              },
            });

            controller.enqueue(
              encoder.encode(
                sse({
                  type: "agent_error",
                  agentId: "pandora-synthesis",
                  agentName: "Síntese Pandora",
                  code: "MESSAGE_SAVE_FAILED",
                  status: null,
                  message: persistedErrorMessage,
                  retryable: false,
                  partial: false,
                })
              )
            );
          }

          controller.enqueue(
            encoder.encode(
              sse({
                type: "final",
                message: synthesisMessage,
              })
            )
          );
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (error) {
        console.error(error);

        controller.enqueue(
          encoder.encode(
            sse({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Erro ao gerar resposta.",
            })
          )
        );

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
