import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/gemini/client";
import { generateQueryEmbedding } from "@/server/services/ai/providers/gemini-embeddings";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";
import { matchKnowledge } from "@/server/repositories/knowledge-repository";
import { listAgentsByConversation } from "@/server/repositories/conversation-agents-repository";

type Message = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  role: "user" | "assistant" | "system";
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
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
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Erro ao salvar mensagem.");
  }

  return data as Message;
}

function buildSystemInstruction(agent: any, knowledge: string) {
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

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { conversationId, content } = body;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 🔹 salvar mensagem do usuário
  const savedUserMessage = await saveMessage({
    conversationId,
    userId: user.id,
    role: "user",
    content,
  });

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          // 🔹 enviar mensagem do usuário para o client
          controller.enqueue(
            encoder.encode(
              sse({
                type: "saved_user",
                message: savedUserMessage,
              })
            )
          );

          // 🔹 buscar histórico
          const history = await getMessagesByConversationId(conversationId);

          // 🔹 buscar agentes da conversa
          const conversationAgents =
            await listAgentsByConversation(conversationId);

          // 🔹 fallback para agente principal
          let agentsToUse = conversationAgents;

          if (agentsToUse.length === 0) {
            const { data: conversation } = await supabase
              .from("conversations")
              .select("agents(*)")
              .eq("id", conversationId)
              .single();

            const agent =
              Array.isArray(conversation?.agents)
                ? conversation.agents[0]
                : conversation?.agents;

            if (agent) {
              agentsToUse = [agent];
            }
          }

          const ai = getGeminiClient();

          // 🔥 LOOP MULTI-AGENTE
          const previousAgentResponses: Array<{
            agentName: string;
            content: string;
          }> = [];

          for (const agent of agentsToUse) {
            let fullResponse = "";

            const values = await generateQueryEmbedding(content);

            const matches = await matchKnowledge({
              agentId: agent.id,
              conversationId,
              embedding: values,
            });

            const knowledge = matches.map((m) => m.content).join("\n\n");

            const systemInstruction = buildSystemInstruction(agent, knowledge);

            const chainContext = previousAgentResponses.length
              ? [
                  "RESPOSTAS DOS AGENTES ANTERIORES NESTA RODADA:",
                  ...previousAgentResponses.map(
                    (response, index) =>
                      `#${index + 1} ${response.agentName}:\n${response.content}`
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
                role: "user",
                parts: [
                  {
                    text: finalSystemInstruction,
                  },
                ],
              },
              ...history.map((msg) => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content ?? "" }],
              })),
              {
                role: "user",
                parts: [{ text: content }],
              },
            ];

            const stream = await ai.models.generateContentStream({
              model: agent.model,
              contents,
              config: {
                temperature: agent.temperature,
              },
            });

            for await (const chunk of stream) {
              const text = chunk.text ?? "";

              if (!text) continue;

              fullResponse += text;

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

            const savedAssistantMessage = await saveMessage({
              conversationId,
              userId: null,
              role: "assistant",
              content: fullResponse,
              metadata: {
                agent_id: agent.id,
                agent_name: agent.nome,
                orchestration: {
                  mode: "chain",
                  order: agent.ordem ?? null,
                  previous_agents: previousAgentResponses.map((response) => ({
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
              agentName: agent.nome,
              content: fullResponse,
            });
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
              },
            });

            for await (const chunk of synthesisStream) {
              const text = chunk.text ?? "";

              if (!text) continue;

              finalSynthesis += text;

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

          controller.enqueue(encoder.encode(sse("[DONE]")));
          controller.close();
        } catch (error) {
          console.error(error);

          controller.enqueue(
            encoder.encode(
              sse({
                type: "error",
                error: "Erro ao gerar resposta.",
              })
            )
          );

          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      },
    }
  );
}