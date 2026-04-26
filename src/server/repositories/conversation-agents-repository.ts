import { createClient } from "@/lib/supabase/server";

export type ConversationAgentItem = {
  conversation_agent_id: string;
  id: string;
  nome: string;
  descricao: string | null;
  prompt_base: string;
  provider: "gemini" | "openai";
  model: string;
  temperature: number;
  max_history_messages: number;
  knowledge_space_id: string | null;
  category: string | null;
  tags: string[];
  ordem: number;
};

export async function listAgentsByConversation(
  conversationId: string
): Promise<ConversationAgentItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_agents")
    .select(`
      id,
      ordem,
      created_at,
      agents (
        id,
        nome,
        descricao,
        prompt_base,
        provider,
        model,
        temperature,
        max_history_messages,
        knowledge_space_id,
        category,
        tags
      )
    `)
    .eq("conversation_id", conversationId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar agentes da conversa: ${error.message}`);
  }

  return (data ?? [])
    .map((row: any) => {
      const agent = Array.isArray(row.agents) ? row.agents[0] : row.agents;

      if (!agent) return null;

      return {
        conversation_agent_id: row.id,
        ordem: row.ordem ?? 0,
        id: agent.id,
        nome: agent.nome,
        descricao: agent.descricao,
        prompt_base: agent.prompt_base,
        provider: agent.provider,
        model: agent.model,
        temperature: agent.temperature,
        max_history_messages: agent.max_history_messages,
        knowledge_space_id: agent.knowledge_space_id,
        category: agent.category,
        tags: agent.tags ?? [],
      };
    })
    .filter(Boolean) as ConversationAgentItem[];
}

export async function reorderConversationAgents(params: {
  conversationId: string;
  orderedAgentIds: string[];
}) {
  const supabase = await createClient();

  for (let index = 0; index < params.orderedAgentIds.length; index += 1) {
    const agentId = params.orderedAgentIds[index];

    const { error } = await supabase
      .from("conversation_agents")
      .update({ ordem: index + 1 })
      .eq("conversation_id", params.conversationId)
      .eq("agent_id", agentId);

    if (error) {
      throw new Error(`Erro ao reordenar agentes: ${error.message}`);
    }
  }
}