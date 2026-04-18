import { createClient } from "@/lib/supabase/server";
import type { Agent, AgentListItem } from "@/types/database";

export async function getActiveAgents(userId?: string): Promise<AgentListItem[]> {
  const supabase = await createClient();

  const { data: agents, error } = await supabase
    .from("agents")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error("Erro ao buscar agentes.");
  }

  const typedAgents = (agents ?? []) as Agent[];

  if (!userId || typedAgents.length === 0) {
    return typedAgents;
  }

  const agentIds = typedAgents.map((agent) => agent.id);

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, agent_id, updated_at")
    .eq("user_id", userId)
    .in("agent_id", agentIds);

  const conversationMap = new Map<
    string,
    { id: string; updated_at: string }
  >();

  for (const conversation of conversations ?? []) {
    conversationMap.set(conversation.agent_id, {
      id: conversation.id,
      updated_at: conversation.updated_at,
    });
  }

  const conversationIds = [...conversationMap.values()].map((item) => item.id);

  let latestMessagesMap = new Map<
    string,
    { content: string | null; created_at: string }
  >();

  if (conversationIds.length > 0) {
    const { data: messages } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    for (const message of messages ?? []) {
      if (!latestMessagesMap.has(message.conversation_id)) {
        latestMessagesMap.set(message.conversation_id, {
          content: message.content,
          created_at: message.created_at,
        });
      }
    }
  }

  return typedAgents.map((agent) => {
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