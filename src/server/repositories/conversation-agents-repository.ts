import { createClient } from "@/lib/supabase/server";

export async function listAgentsByConversation(conversationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_agents")
    .select(`
      agents (
        id,
        nome,
        descricao,
        prompt_base,
        provider,
        model,
        temperature,
        max_history_messages
      )
    `)
    .eq("conversation_id", conversationId);

  if (error) {
    throw new Error("Erro ao buscar agentes da conversa.");
  }

  return (data ?? []).map((row: any) =>
    Array.isArray(row.agents) ? row.agents[0] : row.agents
  );
}