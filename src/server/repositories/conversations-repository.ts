import { createClient } from "@/lib/supabase/server";
import type { Conversation, ConversationWithAgent } from "@/types/database";

type AgentLookupRow = {
  id: string;
  nome: string;
  slug: string;
};

export async function getOrCreateConversationByAgentSlug(
  userId: string,
  agentSlug: string
): Promise<Conversation> {
  const supabase = await createClient();

  const { data: agentData, error: agentError } = await supabase
    .from("agents")
    .select("id, nome, slug")
    .eq("slug", agentSlug)
    .eq("ativo", true)
    .single();

  if (agentError || !agentData) {
    throw new Error("Agente não encontrado.");
  }

  const agent = agentData as AgentLookupRow;

  const { data: existingConversationData, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_id", agent.id)
    .maybeSingle();

  if (existingError) {
    throw new Error("Erro ao buscar conversa.");
  }

  if (existingConversationData) {
    return existingConversationData as Conversation;
  }

  const { data: createdConversationData, error: createError } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      agent_id: agent.id,
      titulo: agent.nome,
    })
    .select("*")
    .single();

  if (createError || !createdConversationData) {
    throw new Error("Erro ao criar conversa.");
  }

  return createdConversationData as Conversation;
}

export async function getConversationWithAgent(
  conversationId: string,
  userId: string
): Promise<ConversationWithAgent> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      user_id,
      agent_id,
      titulo,
      created_at,
      updated_at,
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
    `)
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Erro ao carregar conversa com agente.");
  }

  return data as ConversationWithAgent;
}