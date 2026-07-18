import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";
import { matchKnowledge } from "@/server/repositories/knowledge-repository";
import { getTenantApiKeysForConversation } from "@/server/repositories/provider-keys-repository";
import { resolveApiKeyForProvider } from "@/lib/provider-keys";
import { generateQueryEmbedding } from "@/server/services/ai/providers/gemini-embeddings";
import { streamModel } from "@/server/services/ai/providers/stream";
import {
  classifyModelError,
  maxOutputTokensFor,
  MODEL_TIMEOUT_MS,
  removeActionJson,
  sanitizeJson,
  saveMessage,
  sse,
  withRetryBeforeStreaming,
  withTimeout,
  type Message,
} from "@/server/services/ai/runtime";

export const runtime = "nodejs";

type RuntimeAgent = {
  id: string;
  nome: string;
  slug?: string | null;
  descricao: string | null;
  prompt_base: string;
  provider: "gemini" | "openai";
  model: string;
  temperature: number;
  max_history_messages: number;
  modo_resposta?: string | null;
  knowledge_space_id?: string | null;
  ordem?: number | null;
};

type RetryMetadata = {
  status?: "completed" | "partial" | "failed" | "superseded";
  retryable?: boolean;
  agent_id?: string;
  agent_name?: string;
  original_user_message_id?: string;
  error?: {
    code?: string;
    status?: number | null;
    message?: string;
  } | null;
  orchestration?: Record<string, unknown>;
};

function buildSystemInstruction(agent: RuntimeAgent, knowledge: string): string {
  return [
    `Você é o agente "${agent.nome}".`,
    agent.descricao ? `Descrição: ${agent.descricao}` : null,
    "",
    "Siga rigorosamente o prompt base abaixo:",
    agent.prompt_base,
    knowledge.trim()
      ? ["", "INFORMAÇÕES IMPORTANTES, use como base da resposta:", knowledge].join(
          "\n"
        )
      : null,
    "",
    "Responda em português do Brasil.",
    "Se algum dado necessário não estiver disponível na base de conhecimento, informe isso claramente.",
    "Nunca encerre a resposta no meio de uma frase, lista, tabela ou marcação Markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function markOriginalAsSuperseded(message: Message) {
  const supabase = await createClient();

  const metadata = (message.metadata ?? {}) as RetryMetadata;

  const { error } = await supabase
    .from("messages")
    .update({
      metadata: sanitizeJson({
        ...metadata,
        status: "superseded",
        retryable: false,
        superseded_at: new Date().toISOString(),
      }),
    })
    .eq("id", message.id);

  if (error) {
    console.error("Erro ao marcar mensagem como superseded:", {
      messageId: message.id,
      error,
    });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const assistantMessageId =
    typeof body?.assistantMessageId === "string"
      ? body.assistantMessageId
      : null;

  if (!assistantMessageId) {
    return Response.json(
      { error: "assistantMessageId é obrigatório." },
      { status: 400 }
    );
  }

  const { data: failedMessage, error: failedMessageError } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, role, content, metadata, created_at")
    .eq("id", assistantMessageId)
    .eq("role", "assistant")
    .single();

  if (failedMessageError || !failedMessage) {
    return Response.json(
      { error: "Mensagem para tentar novamente não encontrada." },
      { status: 404 }
    );
  }

  const retryMessage = failedMessage as Message;
  const retryMetadata = (retryMessage.metadata ?? {}) as RetryMetadata;

  if (!retryMetadata.retryable) {
    return Response.json(
      { error: "Essa mensagem não está marcada como retryable." },
      { status: 400 }
    );
  }

  const conversationId = retryMessage.conversation_id;

  // Acesso é validado pela RLS (is_conversation_participant): qualquer
  // participante da conversa — não só o dono — pode retentar uma resposta.
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .single();

  if (conversationError || !conversation) {
    return Response.json(
      { error: "Conversa não encontrada ou sem acesso." },
      { status: 404 }
    );
  }

  const originalUserMessageId = retryMetadata.original_user_message_id;
  const agentId = retryMetadata.agent_id;

  if (!originalUserMessageId || !agentId) {
    return Response.json(
      {
        error:
          "A mensagem não possui metadata suficiente para tentar novamente.",
      },
      { status: 400 }
    );
  }

  const { data: originalUserMessage, error: originalMessageError } =
    await supabase
      .from("messages")
      .select("id, conversation_id, user_id, role, content, metadata, created_at")
      .eq("id", originalUserMessageId)
      .eq("conversation_id", conversationId)
      .eq("role", "user")
      .single();

  if (originalMessageError || !originalUserMessage?.content) {
    return Response.json(
      { error: "Mensagem original do usuário não encontrada." },
      { status: 404 }
    );
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      agentId
    );

  let agentQuery = supabase
    .from("agents")
    .select(
      "id, slug, nome, descricao, prompt_base, provider, model, temperature, max_history_messages, modo_resposta, knowledge_space_id, ativo"
    )
    .eq("ativo", true);

  agentQuery = isUuid
    ? agentQuery.eq("id", agentId)
    : agentQuery.eq("slug", agentId);

  const { data: agent, error: agentError } = await agentQuery.maybeSingle();

  if (agentError || !agent) {
    console.error("Agente original não encontrado no retry:", {
      assistantMessageId,
      agentId,
      isUuid,
      originalUserMessageId,
      retryMetadata,
      agentError,
    });

    return Response.json(
      { error: "Agente original não encontrado ou inativo." },
      { status: 404 }
    );
  }

  const runtimeAgent = {
    ...(agent as RuntimeAgent),
    ordem:
      typeof retryMetadata.orchestration?.order === "number"
        ? retryMetadata.orchestration.order
        : null,
  };
  const userContent = originalUserMessage.content;

  // Chave do tenant (PD-26/27): a org da conversa paga a própria geração,
  // conforme o modo dela. Resolvido uma vez; o enforcement (modo 'own' sem
  // chave) é aplicado onde o streamModel é chamado.
  const tenantKeys = await getTenantApiKeysForConversation(conversationId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      let generationFailed = false;
      let generationPartial = false;
      let generationError: ReturnType<typeof classifyModelError> | null = null;

      try {
        controller.enqueue(
          encoder.encode(
            sse({
              type: "retry_started",
              originalMessageId: retryMessage.id,
              agentId: runtimeAgent.id,
              agentName: runtimeAgent.nome,
            })
          )
        );

        const queryEmbedding = await generateQueryEmbedding(userContent);

        const matches = await matchKnowledge({
          agentId: runtimeAgent.id,
          conversationId,
          embedding: queryEmbedding,
          knowledgeSpaceId: runtimeAgent.knowledge_space_id ?? null,
          query: userContent,
          threshold: 0.35,
          count: 4,
        });

        const knowledge = matches.map((item) => item.content).join("\n\n");

        const history = await getMessagesByConversationId(conversationId);

        const filteredHistory = history.filter((message) => {
          if (message.id === retryMessage.id) return false;
          if (message.id === originalUserMessage.id) return false;

          const metadata = (message.metadata ?? {}) as RetryMetadata;

          if (metadata.status === "failed") return false;
          if (metadata.status === "partial") return false;
          if (metadata.status === "superseded") return false;

          if (message.role === "system") return false;

          // Mantém mensagens do usuário anteriores como contexto geral.
          if (message.role === "user") return true;

          const orchestration = metadata.orchestration as
            | Record<string, unknown>
            | undefined;

          // Evita reaproveitar respostas internas de outros agentes.
          if (orchestration?.mode === "chain") {
            return metadata.agent_id === runtimeAgent.id;
          }

          // Permite respostas antigas do mesmo agente.
          if (message.role === "assistant") {
            return metadata.agent_id === runtimeAgent.id;
          }

          return false;
        });

        const systemInstruction = buildSystemInstruction(runtimeAgent, knowledge);

        const contents = [
          {
            role: "user" as const,
            parts: [{ text: systemInstruction }],
          },
          ...filteredHistory.map((message) => ({
            role:
              message.role === "assistant"
                ? ("model" as const)
                : ("user" as const),
            parts: [{ text: message.content ?? "" }],
          })),
          {
            role: "user" as const,
            parts: [{ text: userContent }],
          },
        ];

        try {
          fullResponse = await withTimeout(
            (async () => {
              let accumulated = "";
              let receivedAnyToken = false;

              const responseStream = await withRetryBeforeStreaming(
                () =>
                  streamModel({
                    provider: runtimeAgent.provider,
                    model: runtimeAgent.model,
                    contents,
                    temperature: runtimeAgent.temperature,
                    maxOutputTokens: maxOutputTokensFor(runtimeAgent.modo_resposta),
                    apiKey: resolveApiKeyForProvider(tenantKeys, runtimeAgent.provider),
                  }),
                {
                  retries: 2,
                  delaysMs: [800, 2000],
                }
              );

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
                        agentId: runtimeAgent.id,
                        agentName: runtimeAgent.nome,
                      })
                    )
                  );
                }
              } catch (error) {
                const classified = classifyModelError(error);

                generationPartial = receivedAnyToken;
                generationFailed = true;
                generationError = {
                  ...classified,
                  code: receivedAnyToken
                    ? "MODEL_STREAM_INTERRUPTED"
                    : classified.code,
                  message: receivedAnyToken
                    ? "A resposta foi interrompida antes de terminar."
                    : classified.message,
                };

                return accumulated;
              }

              return accumulated;
            })(),
            MODEL_TIMEOUT_MS,
            `Tempo limite excedido para o agente ${runtimeAgent.nome}.`
          );
        } catch (error) {
          generationFailed = true;
          generationError = classifyModelError(error);
          fullResponse = "";
        }

        if (generationFailed && !fullResponse.trim()) {
          fullResponse =
            generationError?.message ??
            "Não consegui concluir a nova tentativa.";
        }

        if (generationFailed && fullResponse.trim()) {
          generationPartial = true;

          fullResponse = `${fullResponse.trim()}

> ⚠️ A nova tentativa foi interrompida antes de terminar. Você pode tentar novamente.`;
        }

        const cleanResponse = removeActionJson(fullResponse);

        const savedAssistantMessage = await saveMessage({
          conversationId,
          userId: null,
          role: "assistant",
          content: cleanResponse || fullResponse,
          metadata: {
            agent_id: runtimeAgent.id,
            agent_slug: runtimeAgent.slug ?? null,
            agent_name: runtimeAgent.nome,

            status: generationFailed
              ? generationPartial
                ? "partial"
                : "failed"
              : "completed",

            retryable: generationError?.retryable ?? false,

            error: generationError
              ? {
                  code: generationError.code,
                  status: generationError.status ?? null,
                  message: generationError.message,
                }
              : null,

            retry_of_message_id: retryMessage.id,
            original_user_message_id: originalUserMessage.id,

            orchestration: {
              mode: "retry",
              retried_agent_id: runtimeAgent.id,
              retried_agent_name: runtimeAgent.nome,
            },
          },
        });

        await markOriginalAsSuperseded(retryMessage);

        controller.enqueue(
          encoder.encode(
            sse({
              type: "final",
              message: savedAssistantMessage,
              supersededMessageId: retryMessage.id,
            })
          )
        );

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
                  : "Erro ao tentar gerar novamente.",
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
