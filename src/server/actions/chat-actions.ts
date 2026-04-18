"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const redirectPath = String(formData.get("redirectPath") ?? "/chat");

  if (!conversationId || !content) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content,
    metadata: null,
  });

  if (error) {
    throw new Error("Erro ao enviar mensagem.");
  }

  revalidatePath(redirectPath);
}