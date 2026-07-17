"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithEmailPassword(
  formData: FormData
): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  redirect("/chat");
}

// PD-25: o cadastro público foi removido. O acesso é por convite (o admin de
// plataforma cria organizações; cada org convida seus membros via
// `inviteMemberToOrganization`). Não há mais `signUpWithEmailPassword`: uma
// porta de auto-cadastro reabriria o buraco — qualquer um viraria membro.

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}