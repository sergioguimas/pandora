"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getMembershipForUser } from "@/server/repositories/organization-members-repository";
import {
  inviteMemberToOrganization,
  removeMemberFromOrganization,
} from "@/server/repositories/organizations-repository";

// Ações de membros da PRÓPRIA organização (PD-25). Só `owner`/`admin`, e sempre
// na própria org — o `organizationId` vem da sessão, nunca do formulário, então
// ninguém convida/remove na org de outro.

type ActionState = { ok: boolean; error?: string; mensagem?: string };

async function autorizarOrg() {
  const user = await getCurrentUser();
  if (!user) return { erro: "Não autenticado." as const };

  const { organizationId, role } = await getMembershipForUser(user.id);
  if (role !== "owner" && role !== "admin") {
    return { erro: "Apenas o dono ou um admin podem gerenciar membros." as const };
  }
  return { user, organizationId };
}

export async function inviteMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Informe um e-mail válido." };
  }

  const auth = await autorizarOrg();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  try {
    const { alreadyMember } = await inviteMemberToOrganization(email, auth.organizationId);
    revalidatePath("/configuracoes/membros");
    return {
      ok: true,
      mensagem: alreadyMember
        ? `${email} já faz parte da organização.`
        : `Convite enviado a ${email}.`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao convidar." };
  }
}

export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { ok: false, error: "Membro inválido." };

  const auth = await autorizarOrg();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  // Não faz sentido remover a si mesmo por aqui (evita o admin se auto-expulsar
  // sem querer). Sair da org é outro fluxo.
  if (userId === auth.user.id) {
    return { ok: false, error: "Você não pode remover a si mesmo." };
  }

  try {
    await removeMemberFromOrganization(userId, auth.organizationId);
    revalidatePath("/configuracoes/membros");
    return { ok: true, mensagem: "Membro removido." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao remover." };
  }
}
