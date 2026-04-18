import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/types/database";

export async function getActiveAgents(): Promise<Agent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error("Erro ao buscar agentes.");
  }

  return (data ?? []) as Agent[];
}