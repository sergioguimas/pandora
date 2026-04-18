import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createClient } from "@/lib/supabase/server";
import { getConversationWithAgent } from "@/server/repositories/conversations-repository";
import { getRecentMessagesByConversationId } from "@/server/repositories/messages-repository";
import type { Agent, Message } from "@/types/database";

export const runtime = "nodejs";

type StreamRequestBody = {
  conversationId: string;
  content: string;
};

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function getAgentFromConversation(
  value: Awaited<ReturnType<typeof getConversationWithAgent>>["agents"]
): Agent {
  if (!value) {
    throw new Error("Agente da conversa não encontrado.");
  }

  const agent = Array.isArray(value) ? value[0] : value;

  if (!agent) {
    throw new Error("Agente da conversa não encontrado.");
  }

  return {
    ...agent,
    avatar_url: null,
    ativo: true,
    created_at: "",
    updated_at: "",
  };
}

function buildSystemInstruction(agent: Agent, knowledge?: string) {
  return [
    `Você é o agente "${agent.nome}".`,
    agent.descricao ? `Descrição: ${agent.descricao}` : null,
    "",
    "Siga rigorosamente o prompt base abaixo:",
    agent.prompt_base,
    knowledge?.trim()
      ? ["", "Base de conhecimento recuperada:", knowledge].join("\n")
      : null,
    "",
    "Regras:",
    "- Responda de forma clara, útil e objetiva.",
    "- Se faltar contexto, diga isso explicitamente.",
    "- Não invente informações.",
  ]
    .filter(Boolean)
    .join("\n");
}

function mapMessagesToGemini(messages: Message[]): GeminiContent[] {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        (message.content ?? "").trim().length > 0
    )
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content ?? "" }],
    }));
}

async function saveMessage(params: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: params.metadata ?? null,
    })
    .select("id, conversation_id, role, content, metadata, created_at")
    .single();

  if (error || !data) {
    throw new Error("Erro ao salvar mensagem.");
  }

  return data as Message;
}

async function retrieveKnowledge(_agentId: string, _query: string) {
  // Placeholder da RAG/base de conhecimento.
  // Pode retornar string vazia por enquanto.
  return "";
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Response("GEMINI_API_KEY não configurada.", { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response("Não autenticado.", { status: 401 });
    }

    const body = (await req.json()) as StreamRequestBody;
    const conversationId = body?.conversationId;
    const content = body?.content?.trim();

    if (!conversationId || !content) {
      return new Response("Invalid payload", { status: 400 });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";

        try {
          // 1) valida conversa + resolve agente
          const conversation = await getConversationWithAgent(
            conversationId,
            user.id
          );

          const agent = getAgentFromConversation(conversation.agents);

          // 2) salva a mensagem do usuário
          await saveMessage({
            conversationId,
            role: "user",
            content,
            metadata: null,
          });

          // 3) busca histórico recente após salvar
          const history = await getRecentMessagesByConversationId(
            conversationId,
            agent.max_history_messages || 12
          );

          // 4) recupera conhecimento (stub por enquanto)
          const knowledge = await retrieveKnowledge(agent.id, content);

          // 5) monta conteúdo para o Gemini
          const contents = mapMessagesToGemini(history);

          const responseStream = await ai.models.generateContentStream({
            model: agent.model || "gemini-2.5-flash",
            contents,
            config: {
              systemInstruction: buildSystemInstruction(agent, knowledge),
              temperature: agent.temperature,
            },
          });

          for await (const chunk of responseStream) {
            const token = chunk.text ?? "";

            if (!token) continue;

            fullResponse += token;

            controller.enqueue(
              encoder.encode(
                sse({
                  type: "token",
                  token,
                })
              )
            );
          }

          // 6) salva resposta final do assistente
          const savedAssistantMessage = await saveMessage({
            conversationId,
            role: "assistant",
            content: fullResponse,
            metadata: {
              provider: "gemini",
              model: agent.model,
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

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erro interno";

          controller.enqueue(
            encoder.encode(
              sse({
                type: "error",
                error: message,
              })
            )
          );

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno na rota";

    return new Response(message, { status: 500 });
  }
}