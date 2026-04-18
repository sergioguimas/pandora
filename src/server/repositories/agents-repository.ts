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
  })) satisfies AgentListItem[];

  if (!userId || agents.length === 0) {
    return agents;
  }

  const agentIds = agents.map((agent) => agent.id);

  const { data: conversationsData, error: conversationsError } = await supabase
    .from("conversations")
    .select("id, agent_id, updated_at")
    .eq("user_id", userId)
    .in("agent_id", agentIds);

  if (conversationsError) {
    throw new Error("Erro ao buscar conversas dos agentes.");
  }

  const conversations = (conversationsData ?? []) as ConversationRow[];

  const conversationMap = new Map<string, ConversationRow>();

  for (const conversation of conversations) {
    conversationMap.set(conversation.agent_id, conversation);
  }

  const conversationIds = conversations.map((conversation) => conversation.id);

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
      throw new Error("Erro ao buscar últimas mensagens dos agentes.");
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
    const conversation = conversationMap.get(agent.id);
    const latestMessage = conversation
      ? latestMessagesMap.get(conversation.id)
      : null;

    return {
      ...agent,
      last_message_preview: latestMessage?.content ?? null,
      last_message_at: latestMessage?.created_at ?? null,
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