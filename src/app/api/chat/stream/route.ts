import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createClient } from "@/lib/supabase/server";
import { getConversationWithAgent } from "@/server/repositories/conversations-repository";
import { getRecentMessagesByConversationId } from "@/server/repositories/messages-repository";
import { matchKnowledge } from "@/server/repositories/knowledge-repository";
import { generateQueryEmbedding } from "@/server/services/ai/providers/gemini-embeddings";
import type { Message } from "@/types/database";

export const runtime = "nodejs";

type StreamRequestBody = {
  conversationId: string;
  content: string;
};

type RuntimeAgent = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  prompt_base: string;
  provider: "gemini" | "openai";
  model: string;
  temperature: number;
  max_history_messages: number;
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
): RuntimeAgent {
  if (!value) {
    throw new Error("Agente da conversa não encontrado.");
  }

  const agent = Array.isArray(value) ? value[0] : value;

  if (!agent) {
    throw new Error("Agente da conversa não encontrado.");
  }

  return {
    id: agent.id,
    slug: agent.slug,
    nome: agent.nome,
    descricao: agent.descricao,
    prompt_base: agent.prompt_base,
    provider: agent.provider,
    model: agent.model,
    temperature: agent.temperature,
    max_history_messages: agent.max_history_messages,
  };
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

function extractChunkText(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") return "";

  const value = chunk as {
    text?: string;
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  return value.text ?? value.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function buildSystemInstruction(
  agent: RuntimeAgent,
  knowledge: string
): string {
  return [
    `Você é o agente "${agent.nome}".`,
    agent.descricao ? `Descrição: ${agent.descricao}` : null,
    "",
    "Siga rigorosamente o prompt base abaixo:",
    agent.prompt_base,
    knowledge.trim()
      ? [
          "",
          "INFORMAÇÕES IMPORTANTES (use como base da resposta):",
          knowledge,
        ].join("\n")
      : null,
    "",
    "Regras:",
    "- Priorize as informações fornecidas no contexto.",
    "- Não invente dados.",
    "- Se faltar contexto suficiente, diga isso claramente.",
    "- Responda em português do Brasil.",
  ]
    .filter(Boolean)
    .join("\n");
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

async function retrieveKnowledge(params: {
  agentId: string;
  conversationId: string;
  query: string;
}): Promise<string> {
  const embedding = await generateQueryEmbedding(params.query);

  const matches = await matchKnowledge({
    agentId: params.agentId,
    conversationId: params.conversationId,
    embedding,
    threshold: 0.45,
    count: 6,
  });

  if (!matches.length) {
    return "";
  }

  const globalChunks = matches.filter((item) => item.scope === "global");
  const conversationChunks = matches.filter(
    (item) => item.scope === "conversation"
  );

  return [
    globalChunks.length
      ? `BASE DE CONHECIMENTO DO AGENTE:\n\n${globalChunks
          .map((item) => item.content)
          .join("\n\n---\n\n")}`
      : null,
    conversationChunks.length
      ? `CONTEXTO ESPECÍFICO DESTA CONVERSA:\n\n${conversationChunks
          .map((item) => item.content)
          .join("\n\n---\n\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n====================\n\n");
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
      return new Response("Payload inválido.", { status: 400 });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullResponse = "";

        try {
          const conversation = await getConversationWithAgent(
            conversationId,
            user.id
          );

          const agent = getAgentFromConversation(conversation.agents);

          await saveMessage({
            conversationId,
            userId: user.id,
            role: "user",
            content,
            metadata: null,
          });

          const history = await getRecentMessagesByConversationId(
            conversationId,
            agent.max_history_messages || 12
          );

          const knowledge = await retrieveKnowledge({
            agentId: agent.id,
            conversationId,
            query: content,
          });

          const contents = mapMessagesToGemini(history);

          const responseStream = await ai.models.generateContentStream({
            model: agent.model || "gemini-1.5-flash",
            contents,
            config: {
              systemInstruction: buildSystemInstruction(agent, knowledge),
              temperature: agent.temperature,
            },
          });

          for await (const chunk of responseStream) {
            const token = extractChunkText(chunk);

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

          const savedAssistantMessage = await saveMessage({
            conversationId,
            userId: null,
            role: "assistant",
            content: fullResponse,
            metadata: {
              provider: "gemini",
              model: agent.model || "gemini-1.5-flash",
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