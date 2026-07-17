"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  createOrganizationWithOwner,
  isPlatformAdmin,
} from "@/server/repositories/organizations-repository";

// Ações de admin de PLATAFORMA (PD-25). Só quem tem `profiles.is_platform_admin`
// cria organizações. A flag é checada aqui, e as escritas rodam pelo client
// admin — porta explícita ao lado da parede da RLS, não um buraco nela.

type ActionState = { ok: boolean; error?: string; mensagem?: string };

async function autorizarPlataforma() {
  const user = await getCurrentUser();
  if (!user) return { erro: "Não autenticado." as const };
  if (!(await isPlatformAdmin(user.id))) {
    return { erro: "Apenas o administrador da plataforma pode criar organizações." as const };
  }
  return { user };
}

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const ownerEmail = String(formData.get("owner_email") ?? "").trim().toLowerCase();

  if (nome.length < 2) return { ok: false, error: "Informe um nome de organização." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return { ok: false, error: "Informe um e-mail válido para o dono." };
  }

  const auth = await autorizarPlataforma();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  try {
    await createOrganizationWithOwner(nome, ownerEmail);
  } catch (err) {
    // Mensagens do RPC ("usuário já pertence a uma organização") são seguras de
    // repassar — dizem o motivo da recusa, não vazam dado.
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao criar organização." };
  }

  revalidatePath("/admin");
  return { ok: true, mensagem: `Organização "${nome}" criada. Convite enviado a ${ownerEmail}.` };
}
