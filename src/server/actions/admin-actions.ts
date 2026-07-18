"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  createOrganizationWithOwner,
  isPlatformAdmin,
  setOrganizationActive,
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
  const diasRaw = String(formData.get("dias_ativos") ?? "").trim();
  const keyMode = String(formData.get("key_mode") ?? "platform") === "own" ? "own" : "platform";

  if (nome.length < 2) return { ok: false, error: "Informe um nome de organização." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return { ok: false, error: "Informe um e-mail válido para o dono." };
  }

  // Dias ativos: vazio = sem prazo; senão precisa ser inteiro positivo.
  let activeDays: number | null = null;
  if (diasRaw !== "") {
    const n = Number(diasRaw);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, error: "Dias ativos deve ser um número inteiro positivo (ou vazio para sem prazo)." };
    }
    activeDays = n;
  }

  const auth = await autorizarPlataforma();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  try {
    await createOrganizationWithOwner(nome, ownerEmail, { activeDays, keyMode });
  } catch (err) {
    // Mensagens do RPC ("usuário já pertence a uma organização") são seguras de
    // repassar — dizem o motivo da recusa, não vazam dado.
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao criar organização." };
  }

  revalidatePath("/admin");
  return { ok: true, mensagem: `Organização "${nome}" criada. Convite enviado a ${ownerEmail}.` };
}

export async function setOrgActiveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const organizationId = String(formData.get("organization_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!organizationId) return { ok: false, error: "Organização inválida." };

  const auth = await autorizarPlataforma();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  try {
    await setOrganizationActive(organizationId, active);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao alterar status." };
  }

  revalidatePath("/admin");
  return { ok: true, mensagem: active ? "Organização reativada." : "Organização desativada." };
}
