"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getConversationWithAgent } from "@/server/repositories/conversations-repository";
import { getRecentMessagesByConversationId } from "@/server/repositories/messages-repository";
import { generateAgentResponse } from "@/server/services/ai/generate-agent-response";

type SendMessageState = {
  ok: boolean;
};

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const redirectPath = String(formData.get("redirectPath") ?? "/chat");

  if (!conversationId || !content) {
    return { ok: false };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { error: insertUserMessageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content,
    metadata: null,
  });

  if (insertUserMessageError) {
    throw new Error("Erro ao enviar mensagem do usuário.");
  }

  const conversation = await getConversationWithAgent(conversationId, user.id);
  const agent = Array.isArray(conversation.agents)
    ? conversation.agents[0]
    : conversation.agents;

  if (!agent) {
    throw new Error("Agente da conversa não encontrado.");
  }

  const recentMessages = await getRecentMessagesByConversationId(
    conversationId,
    agent.max_history_messages
  );

  const result = await generateAgentResponse({
    provider: agent.provider,
    model: agent.model,
    temperature: agent.temperature,
    maxHistoryMessages: agent.max_history_messages,
    agentName: agent.nome,
    agentDescription: agent.descricao ?? null,
    agentPromptBase: agent.prompt_base,
    latestUserMessage: content,
    history: recentMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  const { error: insertAssistantMessageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: result.text,
      metadata: {
        source: result.provider,
        model: result.model,
        temperature: agent.temperature,
      },
    });

  if (insertAssistantMessageError) {
    throw new Error("Erro ao salvar resposta do agente.");
  }

  revalidatePath(redirectPath);

  return { ok: true };
}