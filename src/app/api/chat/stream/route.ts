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

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
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

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      user_id: params.userId ?? null,
      role: params.role,
      content: params.content,
      metadata: params.metadata ?? null,
    })
    .select("id, conversation_id, user_id, role, content, metadata, created_at")
    .single();

  if (error || !data) {
    throw new Error("Erro ao salvar mensagem.");
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
    "- Priorize as informações fornecidas no contexto.",
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

        const history = await getMessagesByConversationId(conversationId);
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

          const matches = await matchKnowledge({
            agentId: agent.id,
            conversationId,
            embedding: queryEmbedding,
            query: content,
            threshold: 0.35,
            count: 4,
          });

          const knowledge = matches.map((item) => item.content).join("\n\n");

          const systemInstruction = buildSystemInstruction(
            agent,
            knowledge,
            agentsToUse
          );

          const chainContext = previousAgentResponses.length
            ? [
                "RESPOSTAS DOS AGENTES ANTERIORES NESTA RODADA:",
                ...previousAgentResponses.map(
                  (response, responseIndex) =>
                    `#${responseIndex + 1} ${response.agentName}:\n${response.content}`
                ),
                "",
                "Use essas respostas como contexto adicional. Você pode complementar, corrigir, validar ou discordar de forma objetiva, respeitando seu papel.",
              ].join("\n\n")
            : "";

          const finalSystemInstruction = [
            systemInstruction,
            chainContext ? `\n\n${chainContext}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          const contents = [
            {
              role: "user" as const,
              parts: [{ text: finalSystemInstruction }],
            },
            ...history.map((message) => ({
              role: message.role === "assistant" ? ("model" as const) : ("user" as const),
              parts: [{ text: message.content ?? "" }],
            })),
            {
              role: "user" as const,
              parts: [{ text: content }],
            },
          ];

          try {
            fullResponse = await withTimeout(
              (async () => {
                const responseStream = await ai.models.generateContentStream({
                  model: agent.model,
                  contents,
                  config: {
                    temperature: agent.temperature,
                    maxOutputTokens: 1200,
                  },
                });

                let accumulated = "";

                for await (const chunk of responseStream) {
                  const text = chunk.text ?? "";

                  if (!text) continue;

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

                return accumulated;
              })(),
              60000,
              `Tempo limite excedido para o agente ${agent.nome}.`
            );
          } catch {
            fullResponse =
              "Não consegui concluir minha resposta dentro do tempo limite. Tente fazer a pergunta de forma mais direta ou dividir em partes.";

            controller.enqueue(
              encoder.encode(
                sse({
                  type: "token",
                  token: fullResponse,
                  agentId: agent.id,
                  agentName: agent.nome,
                })
              )
            );
          }

          const action = tryParseAgentAction(fullResponse);
          const cleanResponse = removeActionJson(fullResponse);

          const savedAssistantMessage = await saveMessage({
            conversationId,
            userId: null,
            role: "assistant",
            content: cleanResponse || fullResponse,
            metadata: {
              agent_id: agent.id,
              agent_name: agent.nome,
              orchestration: {
                mode: "chain",
                order: agent.ordem ?? index + 1,
                dynamic_call: false,
                previous_agents: previousAgentResponses.map((response) => ({
                  agent_id: response.agentId,
                  agent_name: response.agentName,
                })),
              },
            },
          });

          controller.enqueue(
            encoder.encode(
              sse({
                type: "final",
                message: savedAssistantMessage,
              })
            )
          );

          previousAgentResponses.push({
            agentId: agent.id,
            agentName: agent.nome,
            content: cleanResponse || fullResponse,
          });

          if (!orchestrationLocked && action?.action === "call_agent" && dynamicCalls < MAX_DYNAMIC_CALLS) {
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

          try {
            finalSynthesis = await withTimeout(
              (async () => {
                const synthesisStream = await ai.models.generateContentStream({
                  model: agentsToUse[0]?.model ?? "gemini-2.0-flash",
                  contents: [
                    {
                      role: "user",
                      parts: [{ text: synthesisInstruction }],
                    },
                  ],
                  config: {
                    temperature: 0.4,
                    maxOutputTokens: 900,
                  },
                });

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
              60000,
              "Tempo limite excedido na síntese final."
            );
          } catch {
            finalSynthesis =
              "Não consegui concluir a síntese final dentro do tempo limite. As respostas individuais dos agentes acima foram preservadas.";

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

          const savedSynthesisMessage = await saveMessage({
            conversationId,
            userId: null,
            role: "assistant",
            content: finalSynthesis,
            metadata: {
              agent_id: "pandora-synthesis",
              agent_name: "Síntese Pandora",
              orchestration: {
                mode: "synthesis",
                source_agents: previousAgentResponses.map((response) => ({
                  agent_id: response.agentId,
                  agent_name: response.agentName,
                })),
              },
            },
          });

          controller.enqueue(
            encoder.encode(
              sse({
                type: "final",
                message: savedSynthesisMessage,
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
