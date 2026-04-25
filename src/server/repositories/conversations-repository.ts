import { createClient } from "@/lib/supabase/server";
import type { Conversation, ConversationWithAgent } from "@/types/database";
import { getOrganizationIdForUser } from "@/server/repositories/organization-members-repository";
import { addConversationParticipant } from "@/server/repositories/conversation-participants-repository";

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

  const organizationId = await getOrganizationIdForUser(userId);
  const agent = agentData as AgentLookupRow;

  const { data: createdConversationData, error: createError } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      agent_id: agent.id,
      organization_id: organizationId,
      titulo: title?.trim() || `Nova conversa - ${agent.nome}`,
    })
    .select("*")
    .single();

  if (createError || !createdConversationData) {
    throw new Error("Erro ao criar conversa.");
  }

  const conversation = createdConversationData as Conversation;

  await addConversationParticipant({
    conversationId: conversation.id,
    userId,
    role: "owner",
  });

  return conversation;
}

export async function listUserConversationsByAgent(
  userId: string,
  agentId: string
): Promise<Array<{ id: string; titulo: string | null; updated_at: string }>> {
  const supabase = await createClient();

  const { data: participantRows, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (participantError) {
    throw new Error("Erro ao buscar participações do usuário.");
  }

  const conversationIds = (participantRows ?? []).map(
    (row) => row.conversation_id as string
  );

  if (conversationIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, titulo, updated_at")
    .eq("agent_id", agentId)
    .in("id", conversationIds)
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
  _userId: string
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

  const { data: participant, error: participantError } = await supabase
    .from("conversation_participants")
    .select("role")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (participantError || !participant) {
    throw new Error("Você não participa desta conversa.");
  }

  if (participant.role !== "owner") {
    throw new Error("Somente o dono da conversa pode renomeá-la.");
  }

  const { error } = await supabase
    .from("conversations")
    .update({
      titulo: title.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    throw new Error("Erro ao renomear conversa.");
  }
}

export async function listUserConversationsWithRole(
  userId: string,
  agentId: string
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_participants")
    .select(`
      role,
      conversations (
        id,
        titulo,
        updated_at,
        agent_id
      )
    `)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Erro ao buscar conversas do usuário.");
  }

  const rows = (data ?? []) as any[];

  return rows
    .map((row) => {
      const convo = Array.isArray(row.conversations)
        ? row.conversations[0]
        : row.conversations;

      if (!convo) return null;

      return {
        ...convo,
        role: row.role as "owner" | "member",
      };
    })
    .filter(Boolean)
    .filter((c) => c.agent_id === agentId);
}