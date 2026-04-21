import { createClient } from "@/lib/supabase/server";
import type { Agent, AgentListItem } from "@/types/database";

type ConversationRow = {
  id: string;
  agent_id: string;
  updated_at: string;
};

type MessagePreviewRow = {
  conversation_id: string;
  content: string | null;
  created_at: string;
};

export async function getActiveAgents(
  userId?: string
): Promise<AgentListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error("Erro ao buscar agentes.");
  }

  const agents = ((data ?? []) as Agent[]).map((agent) => ({
    ...agent,
    last_message_preview: null,
    last_message_at: null,
    last_conversation_title: null,
    last_conversation_id: null,
  })) satisfies AgentListItem[];

  if (!userId || agents.length === 0) {
    return agents;
  }

  const agentIds = agents.map((agent) => agent.id);

  const { data: participantRows, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (participantError) {
    throw new Error("Erro ao buscar participações do usuário.");
  }

  const conversationIdsFromParticipants = (participantRows ?? []).map(
    (row) => row.conversation_id as string
  );

  let conversations: Array<{
    id: string;
    agent_id: string;
    titulo: string | null;
    updated_at: string;
  }> = [];

  if (conversationIdsFromParticipants.length > 0) {
    const { data: conversationsData, error: conversationsError } = await supabase
      .from("conversations")
      .select("id, agent_id, titulo, updated_at")
      .in("id", conversationIdsFromParticipants)
      .in("agent_id", agentIds)
      .order("updated_at", { ascending: false });

    if (conversationsError) {
      throw new Error("Erro ao buscar conversas.");
    }

    conversations = (conversationsData ?? []) as Array<{
      id: string;
      agent_id: string;
      titulo: string | null;
      updated_at: string;
    }>;
  }

  const latestConversationMap = new Map<
    string,
    {
      id: string;
      titulo: string | null;
    }
  >();

  for (const conv of conversations) {
    if (!latestConversationMap.has(conv.agent_id)) {
      latestConversationMap.set(conv.agent_id, {
        id: conv.id,
        titulo: conv.titulo,
      });
    }
  }

  const conversationIds = conversations.map((c) => c.id);

  const latestMessagesMap = new Map<
    string,
    { content: string | null; created_at: string }
  >();

  if (conversationIds.length > 0) {
    const { data: messagesData, error: messagesError } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    if (messagesError) {
      throw new Error("Erro ao buscar mensagens.");
    }

    const messages = (messagesData ?? []) as MessagePreviewRow[];

    for (const message of messages) {
      if (!latestMessagesMap.has(message.conversation_id)) {
        latestMessagesMap.set(message.conversation_id, {
          content: message.content,
          created_at: message.created_at,
        });
      }
    }
  }

  return agents.map((agent) => {
    const latestConversation = latestConversationMap.get(agent.id);

    const latestMessage = latestConversation
      ? latestMessagesMap.get(latestConversation.id)
      : null;

    return {
      ...agent,
      last_message_preview: latestMessage?.content ?? null,
      last_message_at: latestMessage?.created_at ?? null,
      last_conversation_title: latestConversation?.titulo ?? null,
      last_conversation_id: latestConversation?.id ?? null,
    };
  });
}

export async function getAllAgents(): Promise<Agent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error("Erro ao buscar agentes.");
  }

  return (data ?? []) as Agent[];
}

export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    throw new Error("Erro ao buscar agente.");
  }

  return (data as Agent | null) ?? null;
}