import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/types/database";

type MessageRow = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  role: "user" | "assistant" | "system";
  content: string | null;
  metadata: unknown;
  created_at: string;
};

function normalizeMetadata(
  value: unknown
): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    role: row.role,
    content: row.content,
    metadata: normalizeMetadata(row.metadata),
    created_at: row.created_at,
  };
}

export async function getMessagesByConversationId(
  conversationId: string
): Promise<Message[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Erro ao buscar mensagens.");
  }

  return (data ?? []).map((row) => mapMessage(row as MessageRow));
}

export async function getRecentMessagesByConversationId(
  conversationId: string,
  limit = 12
): Promise<Message[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Erro ao buscar mensagens recentes.");
  }

  return (data ?? [])
    .map((row) => mapMessage(row as MessageRow))
    .reverse();
}