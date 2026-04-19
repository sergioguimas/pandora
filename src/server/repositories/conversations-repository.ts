import { createClient } from "@/lib/supabase/server";
import type { Conversation, ConversationWithAgent } from "@/types/database";

type AgentLookupRow = {
  id: string;
  nome: string;
  slug: string;
};

export async function createConversationForAgent(
  userId: string,
  agentSlug: string,
  title?: string | null
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

  const { data: createdConversationData, error: createError } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      agent_id: agent.id,
      titulo: title?.trim() || `Nova conversa - ${agent.nome}`,
    })
    .select("*")
    .single();

  if (createError || !createdConversationData) {
    throw new Error("Erro ao criar conversa.");
  }

  return createdConversationData as Conversation;
}

export async function listUserConversationsByAgent(
  userId: string,
  agentId: string
): Promise<Array<{ id: string; titulo: string | null; updated_at: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select("id, titulo, updated_at")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao buscar conversas do agente.");
  }

  return (data ?? []) as Array<{
    id: string;
    titulo: string | null;
    updated_at: string;
  }>;
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

export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("conversations")
    .update({
      titulo: title.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Erro ao renomear conversa.");
  }
}