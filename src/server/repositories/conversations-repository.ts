import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/types/database";

export async function getOrCreateConversationByAgentSlug(
  userId: string,
  agentSlug: string
): Promise<Conversation> {
  const supabase = await createClient();

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, nome, slug")
    .eq("slug", agentSlug)
    .eq("ativo", true)
    .single();

  if (agentError || !agent) {
    throw new Error("Agente não encontrado.");
  }

  const { data: existingConversation, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_id", agent.id)
    .maybeSingle();

  if (existingError) {
    throw new Error("Erro ao buscar conversa.");
  }

  if (existingConversation) {
    return existingConversation as Conversation;
  }

  const { data: createdConversation, error: createError } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      agent_id: agent.id,
      titulo: agent.nome,
    })
    .select("*")
    .single();

  if (createError || !createdConversation) {
    throw new Error("Erro ao criar conversa.");
  }

  return createdConversation as Conversation;
}