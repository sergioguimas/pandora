import { createClient } from "@/lib/supabase/server";
import {
  streamModel,
  type ModelContents,
  type ModelStream,
  type ModelStreamParams,
} from "@/server/services/ai/providers/stream";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";
import { matchKnowledge } from "@/server/repositories/knowledge-repository";
import { listAgentsByConversation } from "@/server/repositories/conversation-agents-repository";
// Só o TIPO é importado estaticamente. O módulo tem `import "server-only"`, que
// lança no ambiente de teste (vitest, node) — e este arquivo É importado pelos
// testes do orquestrador. Um `import type` é apagado na compilação, então não
// carrega o módulo; a função real entra por import DINÂMICO no defaultDeps, que
// os testes nunca exercitam (eles injetam deps falsos).
// Módulo PURO (sem server-only): seguro para os testes do orquestrador. A função
// real de banco entra por import dinâmico no defaultDeps.
import {
  resolveApiKeyForProvider,
  type TenantKeyResolution,
} from "@/lib/provider-keys";
import { generateQueryEmbedding } from "@/server/services/ai/providers/gemini-embeddings";
import {
  classifyModelError,
  isProbablyIncompleteAnswer,
  maxOutputTokensFor,
  MODEL_TIMEOUT_MS,
  ModelGenerationError,
  normalizeText,
  removeActionJson,
  sanitizeJson,
  saveMessage,
  withRetryBeforeStreaming,
  withTimeout,
  type Message,
  type ModelErrorInfo,
  type ResponseMode,
} from "@/server/services/ai/runtime";

// ============================================================================
// Orquestração de uma rodada de conversa.
//
// Emite eventos em vez de escrever em um ReadableStream — o handler HTTP é só
// um adaptador que serializa esses eventos como SSE. Isso permite exercitar a
// cadeia de agentes, a síntese e o tratamento de erro sem subir request nem
// chamar o Gemini de verdade (ver `deps`).
//
// Contrato SSE: docs/FLUXO-DE-CHAT.md §5. Os payloads abaixo são serializados
// tal como estão — mudá-los quebra o cliente.
// ============================================================================

export const SYNTHESIS_AGENT_ID = "pandora-synthesis";
export const SYNTHESIS_AGENT_NAME = "Síntese Pandora";
const MAX_DYNAMIC_CALLS = 2;

export type RuntimeAgent = {
  id: string;
  slug?: string | null;
  nome: string;
  descricao: string | null;
  prompt_base: string;
  provider: "gemini" | "openai";
  model: string;
  temperature: number;
  max_history_messages: number;
  /** Preset de tamanho da saída. Ausente/desconhecido cai no padrão (`medio`). */
  modo_resposta?: ResponseMode | string | null;
  knowledge_space_id?: string | null;
  ordem?: number | null;
};

type AgentAction = {
  action: "call_agent";
  agent: string;
  reason?: string;
};

export type OrchestrationEvent =
  | { type: "saved_user"; message: Message }
  | { type: "orchestration_plan"; agents: Array<{ id: string; name: string }> }
  | { type: "token"; token: string; agentId: string; agentName: string }
  | {
      type: "agent_call";
      fromAgentId: string;
      fromAgentName: string;
      toAgentId: string;
      toAgentName: string;
      reason: string | null;
    }
  | {
      type: "agent_warning";
      agentId: string;
      agentName: string;
      code: string;
      message: string;
      retryable: boolean;
    }
  | {
      type: "agent_error";
      agentId: string;
      agentName: string;
      code: string;
      status: number | null;
      message: string;
      retryable: boolean;
      partial: boolean;
    }
  | { type: "final"; message: Message }
  | { type: "error"; error: string };

/** Dependências externas. Injetáveis para teste. */
export type OrchestratorDeps = {
  getHistory: (conversationId: string) => Promise<Message[]>;
  listAgents: (conversationId: string) => Promise<RuntimeAgent[]>;
  getFallbackAgent: (conversationId: string) => Promise<RuntimeAgent | null>;
  generateQueryEmbedding: (text: string) => Promise<number[]>;
  matchKnowledge: (params: {
    agentId: string;
    conversationId: string;
    embedding: number[];
    knowledgeSpaceId?: string | null;
    query?: string;
    threshold?: number;
    count?: number;
  }) => Promise<Array<{ content: string }>>;
  saveMessage: typeof saveMessage;
  streamModel: (params: ModelStreamParams) => Promise<ModelStream>;
  // Chaves do tenant (PD-26/27), resolvidas uma vez por request e injetadas no
  // streamModel. Devolve o modo da org + as chaves. Opcional: sem ela, tudo roda
  // na chave da plataforma — o comportamento dos testes e o padrão antes do BYOK.
  getTenantApiKeys?: (conversationId: string) => Promise<TenantKeyResolution>;
};

// --- Agente principal da conversa (fallback quando não há conversation_agents) ---

async function fetchFallbackAgent(
  conversationId: string
): Promise<RuntimeAgent | null> {
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
        max_history_messages,
        modo_resposta,
        knowledge_space_id
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

export const defaultDeps: OrchestratorDeps = {
  getHistory: (conversationId) =>
    getMessagesByConversationId(conversationId) as Promise<Message[]>,
  listAgents: (conversationId) =>
    listAgentsByConversation(conversationId) as unknown as Promise<RuntimeAgent[]>,
  getFallbackAgent: fetchFallbackAgent,
  generateQueryEmbedding,
  matchKnowledge,
  saveMessage,
  streamModel,
  getTenantApiKeys: (conversationId) =>
    import("@/server/repositories/provider-keys-repository").then((m) =>
      m.getTenantApiKeysForConversation(conversationId)
    ),
};

// Re-export do tipo puro para os testes do orquestrador construírem deps.
export type { TenantKeyResolution } from "@/lib/provider-keys";

// --- Filtro de histórico ------------------------------------------------------

function getMetadata(message: Pick<Message, "metadata">) {
  return (message.metadata ?? {}) as Record<string, unknown>;
}

function isFailedOrInvalidHistoryMessage(message: Message) {
  const status = getMetadata(message).status;

  return (
    status === "failed" ||
    status === "partial" ||
    status === "superseded" ||
    status === "streaming"
  );
}

export function shouldIncludeHistoryMessageForAgent(params: {
  message: Message;
  currentAgentId: string;
  currentUserMessageId: string;
  isMultiAgentChain: boolean;
}) {
  const { message, currentAgentId, currentUserMessageId, isMultiAgentChain } =
    params;

  // A mensagem atual do usuário é adicionada no fim de `contents`, então evita duplicidade.
  if (message.id === currentUserMessageId) return false;

  if (isFailedOrInvalidHistoryMessage(message)) return false;

  // Histórico do usuário é seguro para todos os agentes.
  if (message.role === "user") return true;

  if (message.role !== "assistant") return false;

  // Em conversas encadeadas, não reaproveita respostas antigas de assistentes.
  // Isso evita um agente usar valores/dados que vieram de outro agente em rodada anterior.
  if (isMultiAgentChain) return false;

  // Em conversa de agente único, mantém somente respostas antigas do mesmo agente.
  return getMetadata(message).agent_id === currentAgentId;
}

// --- Chamada dinâmica entre agentes -------------------------------------------

export function tryParseAgentAction(text: string): AgentAction | null {
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

export function findTargetAgent(params: {
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

// --- Prompts ------------------------------------------------------------------

export function buildSystemInstruction(
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

function buildSynthesisInstruction(params: {
  content: string;
  responses: Array<{ agentName: string; content: string }>;
}) {
  return [
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
    params.content,
    "",
    "RESPOSTAS DOS AGENTES:",
    ...params.responses.map(
      (response, index) => `#${index + 1} ${response.agentName}:\n${response.content}`
    ),
  ].join("\n\n");
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

// --- Geração com streaming ----------------------------------------------------

/**
 * Emite os tokens do modelo e retorna o texto acumulado.
 *
 * O timeout é aplicado como um *deadline* corrido: cada passo da iteração corre
 * contra o tempo restante. É equivalente a envolver toda a geração em
 * `withTimeout`, mas permite emitir token a token — não dá para `yield` de
 * dentro de uma função aninhada.
 *
 * Estouro de deadline lança `Error` puro (não `ModelGenerationError`), o que faz
 * o chamador descartar o conteúdo parcial — mesmo comportamento de antes.
 */
async function* streamAnswer(params: {
  deps: OrchestratorDeps;
  provider: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  contents: ModelContents;
  agentId: string;
  agentName: string;
  timeoutMessage: string;
}): AsyncGenerator<OrchestrationEvent, string, void> {
  const deadline = Date.now() + MODEL_TIMEOUT_MS;
  let accumulated = "";
  let receivedAnyToken = false;

  let responseStream: AsyncIterable<{ text?: string }>;

  try {
    responseStream = await withTimeout(
      withRetryBeforeStreaming(() =>
        params.deps.streamModel({
          provider: params.provider,
          model: params.model,
          contents: params.contents,
          temperature: params.temperature,
          maxOutputTokens: params.maxOutputTokens,
        })
      ),
      Math.max(1, deadline - Date.now()),
      params.timeoutMessage
    );
  } catch (error) {
    if (error instanceof Error && error.message === params.timeoutMessage) {
      throw error;
    }

    const classified = classifyModelError(error);

    throw new ModelGenerationError({
      message: classified.message,
      code: classified.code,
      status: classified.status,
      partialContent: accumulated,
      retryable: classified.retryable,
    });
  }

  const iterator = responseStream[Symbol.asyncIterator]();

  try {
    while (true) {
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        throw new Error(params.timeoutMessage);
      }

      const result = await withTimeout(
        iterator.next(),
        remaining,
        params.timeoutMessage
      );

      if (result.done) break;

      const text = result.value?.text ?? "";

      if (!text) continue;

      receivedAnyToken = true;
      accumulated += text;

      yield {
        type: "token",
        token: text,
        agentId: params.agentId,
        agentName: params.agentName,
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message === params.timeoutMessage) {
      throw error;
    }

    const classified = classifyModelError(error);

    throw new ModelGenerationError({
      message: receivedAnyToken
        ? "A resposta foi interrompida antes de terminar."
        : classified.message,
      code: receivedAnyToken ? "MODEL_STREAM_INTERRUPTED" : classified.code,
      status: classified.status,
      partialContent: accumulated,
      // Corte no meio do stream vale retentar; senão, respeita o veredito.
      retryable: receivedAnyToken ? true : classified.retryable,
    });
  }

  return accumulated;
}

// --- Orquestração -------------------------------------------------------------

export async function* orchestrateConversation(
  input: {
    conversationId: string;
    content: string;
    savedUserMessage: Message;
  },
  deps: OrchestratorDeps = defaultDeps
): AsyncGenerator<OrchestrationEvent, void, void> {
  const { conversationId, content, savedUserMessage } = input;

  try {
    yield { type: "saved_user", message: savedUserMessage };

    // Resolve as chaves do tenant UMA vez e embrulha o streamModel para injetar
    // a chave certa por provider. Assim toda geração daqui pra frente (agentes e
    // síntese) usa a chave do tenant quando existe, e a da plataforma quando não
    // — sem propagar `apiKey` por cada assinatura. Uma chave já setada no params
    // (não acontece hoje) tem precedência, por segurança.
    const tenantKeys: TenantKeyResolution = deps.getTenantApiKeys
      ? await deps.getTenantApiKeys(conversationId)
      : { keyMode: "platform", keys: {} };
    const gen: OrchestratorDeps = {
      ...deps,
      streamModel: (params) =>
        deps.streamModel({
          ...params,
          // Enforcement do modo da org (PD-27): 'platform' → chave da plataforma;
          // 'own' → chave do tenant, e LANÇA se faltar (o erro vira agent_error).
          apiKey: params.apiKey ?? resolveApiKeyForProvider(tenantKeys, params.provider),
        }),
    };

    const history = await deps.getHistory(conversationId);
    const conversationAgents = await deps.listAgents(conversationId);

    let agentsToUse: RuntimeAgent[] = conversationAgents;

    if (agentsToUse.length === 0) {
      const fallbackAgent = await deps.getFallbackAgent(conversationId);

      if (fallbackAgent) {
        agentsToUse = [fallbackAgent];
      }
    }

    if (agentsToUse.length === 0) {
      throw new Error("Nenhum agente disponível para responder.");
    }

    // A ordem de execução é a definida em conversation_agents (campo `ordem`),
    // preservando a cadeia configurada para a conversa.
    const orchestrationLocked = agentsToUse.length > 1;

    if (orchestrationLocked) {
      yield {
        type: "orchestration_plan",
        agents: agentsToUse.map((agent) => ({ id: agent.id, name: agent.nome })),
      };
    }

    const queryEmbedding = await deps.generateQueryEmbedding(content);

    const previousAgentResponses: Array<{
      agentId: string;
      agentName: string;
      content: string;
    }> = [];

    const queuedAgentIds = new Set(agentsToUse.map((agent) => agent.id));
    const executedAgentIds = new Set<string>();

    let dynamicCalls = 0;

    for (let index = 0; index < agentsToUse.length; index += 1) {
      const agent = agentsToUse[index];

      if (!agent || executedAgentIds.has(agent.id)) continue;

      executedAgentIds.add(agent.id);

      let fullResponse = "";
      let knowledge = "";

      try {
        const matches = await deps.matchKnowledge({
          agentId: agent.id,
          conversationId,
          embedding: queryEmbedding,
          knowledgeSpaceId: agent.knowledge_space_id ?? null,
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

      const contents: ModelContents = [
        { role: "user", parts: [{ text: finalSystemInstruction }] },
        ...limitedHistory.map((message) => ({
          role: (message.role === "assistant" ? "model" : "user") as "user" | "model",
          parts: [{ text: message.content ?? "" }],
        })),
        { role: "user", parts: [{ text: content }] },
      ];

      let generationFailed = false;
      let generationPartial = false;
      let generationError: ModelErrorInfo | null = null;

      try {
        fullResponse = yield* streamAnswer({
          deps: gen,
          provider: agent.provider,
          model: agent.model,
          temperature: agent.temperature,
          maxOutputTokens: maxOutputTokensFor(agent.modo_resposta),
          contents,
          agentId: agent.id,
          agentName: agent.nome,
          timeoutMessage: `Tempo limite excedido para o agente ${agent.nome}.`,
        });

        if (isProbablyIncompleteAnswer(fullResponse)) {
          generationPartial = true;
          generationError = {
            code: "MODEL_STREAM_INTERRUPTED",
            message: "A resposta parece incompleta. Recomenda-se tentar novamente.",
            retryable: true,
          };

          yield {
            type: "agent_warning",
            agentId: agent.id,
            agentName: agent.nome,
            code: generationError.code,
            message: generationError.message,
            retryable: true,
          };
        }
      } catch (error) {
        generationFailed = true;

        if (error instanceof ModelGenerationError) {
          generationError = {
            code: error.code,
            status: error.status,
            message: error.message,
            retryable: error.retryable,
          };

          fullResponse = error.partialContent?.trim() || "";
          generationPartial = Boolean(fullResponse);
        } else {
          generationError = classifyModelError(error);
          fullResponse = "";
        }

        const errorMessage = generationPartial
          ? "\n\n> ⚠️ A resposta foi interrompida antes de terminar. Você pode tentar novamente."
          : generationError.message;

        yield {
          type: "agent_error",
          agentId: agent.id,
          agentName: agent.nome,
          code: generationError.code,
          status: generationError.status ?? null,
          message: generationError.message,
          retryable: generationError.retryable,
          partial: generationPartial,
        };

        if (!generationPartial) {
          yield {
            type: "token",
            token: errorMessage,
            agentId: agent.id,
            agentName: agent.nome,
          };
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
        assistantMessage = await deps.saveMessage({
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

        yield {
          type: "agent_error",
          agentId: agent.id,
          agentName: agent.nome,
          code: "MESSAGE_SAVE_FAILED",
          status: null,
          message: persistedErrorMessage,
          retryable: false,
          partial: false,
        };
      }

      yield { type: "final", message: assistantMessage };

      previousAgentResponses.push({
        agentId: agent.id,
        agentName: agent.nome,
        content:
          !generationFailed && !generationPartial
            ? cleanResponse || fullResponse
            : "Este agente não conseguiu concluir a resposta por falha temporária do provedor de IA.",
      });

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

          yield {
            type: "agent_call",
            fromAgentId: agent.id,
            fromAgentName: agent.nome,
            toAgentId: targetAgent.id,
            toAgentName: targetAgent.nome,
            reason: action.reason ?? null,
          };
        }
      }
    }

    if (previousAgentResponses.length > 1) {
      yield* runSynthesis({
        deps: gen,
        conversationId,
        content,
        savedUserMessage,
        // Síntese segue o primeiro agente da cadeia, igual à escolha de modelo.
        provider: agentsToUse[0]?.provider ?? "gemini",
        model: agentsToUse[0]?.model ?? "gemini-2.0-flash",
        modoResposta: agentsToUse[0]?.modo_resposta ?? null,
        responses: previousAgentResponses,
      });
    }
  } catch (error) {
    console.error(error);

    yield {
      type: "error",
      error: error instanceof Error ? error.message : "Erro ao gerar resposta.",
    };
  }
}

// --- Síntese final ------------------------------------------------------------

async function* runSynthesis(params: {
  deps: OrchestratorDeps;
  conversationId: string;
  content: string;
  savedUserMessage: Message;
  provider: string;
  model: string;
  modoResposta?: ResponseMode | string | null;
  responses: Array<{ agentId: string; agentName: string; content: string }>;
}): AsyncGenerator<OrchestrationEvent, void, void> {
  const { deps, conversationId, savedUserMessage, responses } = params;

  let finalSynthesis = "";
  let synthesisFailed = false;
  let synthesisError: ModelErrorInfo | null = null;

  const timeoutMessage = "Tempo limite excedido na síntese final.";

  try {
    finalSynthesis = yield* streamAnswer({
      deps,
      provider: params.provider,
      model: params.model,
      temperature: 0.4,
      maxOutputTokens: maxOutputTokensFor(params.modoResposta),
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildSynthesisInstruction({
                content: params.content,
                responses,
              }),
            },
          ],
        },
      ],
      agentId: SYNTHESIS_AGENT_ID,
      agentName: SYNTHESIS_AGENT_NAME,
      timeoutMessage,
    });
  } catch (error) {
    synthesisFailed = true;
    synthesisError = classifyModelError(error);

    finalSynthesis =
      "Não consegui concluir a síntese final por instabilidade temporária do provedor de IA. As respostas individuais dos agentes acima foram preservadas.";

    yield {
      type: "agent_error",
      agentId: SYNTHESIS_AGENT_ID,
      agentName: SYNTHESIS_AGENT_NAME,
      code: synthesisError.code,
      status: synthesisError.status ?? null,
      message: synthesisError.message,
      retryable: synthesisError.retryable,
      partial: false,
    };

    yield {
      type: "token",
      token: finalSynthesis,
      agentId: SYNTHESIS_AGENT_ID,
      agentName: SYNTHESIS_AGENT_NAME,
    };
  }

  const synthesisMetadata = sanitizeJson({
    agent_id: SYNTHESIS_AGENT_ID,
    agent_name: SYNTHESIS_AGENT_NAME,

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
      source_agents: responses.map((response) => ({
        agent_id: response.agentId,
        agent_name: response.agentName,
      })),
    },
  });

  let synthesisMessage: Message;

  try {
    synthesisMessage = await deps.saveMessage({
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
      id: `unsaved-${SYNTHESIS_AGENT_ID}-${Date.now()}`,
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

    yield {
      type: "agent_error",
      agentId: SYNTHESIS_AGENT_ID,
      agentName: SYNTHESIS_AGENT_NAME,
      code: "MESSAGE_SAVE_FAILED",
      status: null,
      message: persistedErrorMessage,
      retryable: false,
      partial: false,
    };
  }

  yield { type: "final", message: synthesisMessage };
}
