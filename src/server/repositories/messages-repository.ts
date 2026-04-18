import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/types/database";

export async function getMessagesByConversationId(
  conversationId: string
): Promise<Message[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Erro ao buscar mensagens.");
  }

  return (data ?? []) as Message[];
}