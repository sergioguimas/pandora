"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateMockAgentResponse } from "@/server/services/mock-agent-response";

export async function sendMessage(formData: FormData): Promise<void> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const redirectPath = String(formData.get("redirectPath") ?? "/chat");

  if (!conversationId || !content) {
    return;
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

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select(`
      id,
      user_id,
      agent_id,
      agents (
        id,
        slug,
        nome
      )
    `)
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (conversationError || !conversation) {
    throw new Error("Erro ao localizar a conversa.");
  }

  const agent = Array.isArray(conversation.agents)
    ? conversation.agents[0]
    : conversation.agents;

  if (!agent) {
    throw new Error("Agente da conversa não encontrado.");
  }

  const mockResponse = generateMockAgentResponse({
    agentName: agent.nome,
    agentSlug: agent.slug,
    userMessage: content,
  });

  const { error: insertAssistantMessageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: mockResponse,
      metadata: {
        source: "mock",
      },
    });

  if (insertAssistantMessageError) {
    throw new Error("Erro ao salvar resposta do agente.");
  }

  revalidatePath(redirectPath);
}