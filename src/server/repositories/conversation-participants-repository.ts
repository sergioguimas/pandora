import { createClient } from "@/lib/supabase/server";
import { error } from "console";

export type ConversationParticipantRole = "owner" | "member";

export async function addConversationParticipant(params: {
  conversationId: string;
  userId: string;
  role?: ConversationParticipantRole;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("conversation_participants").insert({
    conversation_id: params.conversationId,
    user_id: params.userId,
    role: params.role ?? "member",
  });

  if (error) {
    throw new Error("Erro ao adicionar participante à conversa.");
  }
}

export async function removeConversationParticipant(params: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId);

  if (error) {
    throw new Error("Erro ao remover participante da conversa.");
  }
}

export async function listConversationParticipants(conversationId: string) {
  const supabase = await createClient();

  const { data: participantsData, error: participantsError } = await supabase
    .from("conversation_participants")
    .select("id, conversation_id, user_id, role, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (participantsError) {
    throw new Error(
      `Erro ao listar participantes da conversa: ${participantsError.message}`
    );
  }

  const participants = (participantsData ?? []) as Array<{
    id: string;
    conversation_id: string;
    user_id: string;
    role: ConversationParticipantRole;
    created_at: string;
  }>;

  if (participants.length === 0) {
    return [];
  }

  const userIds = participants.map((participant) => participant.user_id);

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nome, email, avatar_url")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(`Erro ao buscar perfis dos participantes: ${profilesError.message}`);
  }

  const profileMap = new Map(
    ((profilesData ?? []) as Array<{
      id: string;
      nome: string | null;
      email: string | null;
      avatar_url: string | null;
    }>).map((profile) => [profile.id, profile])
  );

  return participants.map((participant) => {
    const profile = profileMap.get(participant.user_id);

    return {
      id: participant.id,
      conversation_id: participant.conversation_id,
      user_id: participant.user_id,
      role: participant.role,
      created_at: participant.created_at,
      nome: profile?.nome ?? null,
      email: profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

export async function isConversationOwner(params: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_participants")
    .select("role")
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId)
    .eq("role", "owner")
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao verificar ownership da conversa: ${error.message}`);
  }

  return Boolean(data);
}