"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createConversationForAgent, updateConversationTitle } from "@/server/repositories/conversations-repository";
import { addConversationParticipant, removeConversationParticipant, isConversationOwner } from "@/server/repositories/conversation-participants-repository";
import { reorderConversationAgents } from "@/server/repositories/conversation-agents-repository";
import { redirect } from "next/navigation";

export async function createConversationAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const agentSlug = String(formData.get("agentSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!agentSlug) {
    throw new Error("Agente não informado.");
  }

  const conversation = await createConversationForAgent(
    user.id,
    agentSlug,
    title || null
  );

  redirect(`/chat/${agentSlug}?conversation=${conversation.id}`);
}

export async function renameConversationAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const agentSlug = String(formData.get("agentSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!conversationId) {
    throw new Error("Conversa não informada.");
  }

  if (!agentSlug) {
    throw new Error("Agente não informado.");
  }

  if (!title) {
    throw new Error("Informe um nome para a conversa.");
  }

  await updateConversationTitle(conversationId, user.id, title);

  revalidatePath(`/chat/${agentSlug}`);
  revalidatePath("/chat");
}

export async function addConversationParticipantAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const participantUserId = String(formData.get("participantUserId") ?? "").trim();
  const agentSlug = String(formData.get("agentSlug") ?? "").trim();

  if (!conversationId || !participantUserId || !agentSlug) {
    throw new Error("Dados inválidos para compartilhamento.");
  }

  const owner = await isConversationOwner({
    conversationId,
    userId: user.id,
  });

  if (!owner) {
    throw new Error("Somente o dono da conversa pode compartilhar.");
  }

  await addConversationParticipant({
    conversationId,
    userId: participantUserId,
    role: "member",
  });

  revalidatePath(`/chat/${agentSlug}`);
  revalidatePath("/chat");
}

export async function removeConversationParticipantAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const participantUserId = String(formData.get("participantUserId") ?? "").trim();
  const agentSlug = String(formData.get("agentSlug") ?? "").trim();

  if (!conversationId || !participantUserId || !agentSlug) {
    throw new Error("Dados inválidos para remoção.");
  }

  const owner = await isConversationOwner({
    conversationId,
    userId: user.id,
  });

  if (!owner) {
    throw new Error("Somente o dono da conversa pode remover participantes.");
  }

  await removeConversationParticipant({
    conversationId,
    userId: participantUserId,
  });

  revalidatePath(`/chat/${agentSlug}`);
  revalidatePath("/chat");
}

export async function addConversationAgentAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const agentId = String(formData.get("agentId") ?? "");
  const agentSlug = String(formData.get("agentSlug") ?? "");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  const owner = await isConversationOwner({
    conversationId,
    userId: user.id,
  });

  if (!owner) {
    throw new Error("Apenas o dono pode adicionar agentes.");
  }

  const { error } = await supabase.from("conversation_agents").insert({
    conversation_id: conversationId,
    agent_id: agentId,
  });

  if (error) {
    throw new Error(`Erro ao adicionar agente: ${error.message}`);
  }

  revalidatePath(`/chat/${agentSlug}`);
}

export async function removeConversationAgentAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const agentId = String(formData.get("agentId") ?? "");
  const agentSlug = String(formData.get("agentSlug") ?? "");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  const owner = await isConversationOwner({
    conversationId,
    userId: user.id,
  });

  if (!owner) {
    throw new Error("Apenas o dono pode remover agentes.");
  }

  const { error } = await supabase
    .from("conversation_agents")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("agent_id", agentId);

  if (error) {
    throw new Error(`Erro ao remover agente: ${error.message}`);
  }

  revalidatePath(`/chat/${agentSlug}`);
}

export async function moveConversationAgentAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const agentSlug = String(formData.get("agentSlug") ?? "");
  const agentId = String(formData.get("agentId") ?? "");
  const direction = String(formData.get("direction") ?? "") as "up" | "down";

  const orderedAgentIds = String(formData.get("orderedAgentIds") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  const owner = await isConversationOwner({
    conversationId,
    userId: user.id,
  });

  if (!owner) {
    throw new Error("Apenas o dono pode reordenar agentes.");
  }

  const currentIndex = orderedAgentIds.indexOf(agentId);

  if (currentIndex < 0) {
    throw new Error("Agente não encontrado na ordenação.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= orderedAgentIds.length) {
    return;
  }

  const nextOrder = [...orderedAgentIds];

  const current = nextOrder[currentIndex];
  nextOrder[currentIndex] = nextOrder[targetIndex];
  nextOrder[targetIndex] = current;

  await reorderConversationAgents({
    conversationId,
    orderedAgentIds: nextOrder,
  });

  revalidatePath(`/chat/${agentSlug}`);
  revalidatePath("/chat");
}