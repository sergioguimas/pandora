"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getMembershipForUser } from "@/server/repositories/organization-members-repository";
import {
  deleteProviderKey,
  upsertProviderKey,
  type Provider,
} from "@/server/repositories/provider-keys-repository";

const PROVIDERS: Provider[] = ["gemini", "openai"];

type ActionState = { ok: boolean; error?: string; mensagem?: string };

// A tabela de chaves é fail-closed (sem RLS de leitura/escrita para
// authenticated). TODO acesso passa por aqui, e aqui é onde a autorização
// acontece: só `owner`/`admin` da PRÓPRIA org, e sempre para a própria org — o
// `organizationId` vem da sessão, nunca do formulário, então ninguém grava
// chave na org de outro.
async function autorizar() {
  const user = await getCurrentUser();
  if (!user) return { erro: "Não autenticado." as const };

  const { organizationId, role } = await getMembershipForUser(user.id);
  if (role !== "owner" && role !== "admin") {
    return { erro: "Apenas o dono ou um admin da organização podem gerenciar chaves." as const };
  }
  return { user, organizationId };
}

export async function saveProviderKey(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  const chave = String(formData.get("chave") ?? "");

  if (!PROVIDERS.includes(provider)) return { ok: false, error: "Provider inválido." };
  if (chave.trim().length < 8) {
    return { ok: false, error: "A chave parece curta demais. Confira e tente de novo." };
  }

  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  try {
    await upsertProviderKey(auth.organizationId, provider, chave, auth.user.id);
  } catch {
    return { ok: false, error: "Não foi possível salvar a chave." };
  }

  revalidatePath("/configuracoes/chaves");
  return { ok: true, mensagem: `Chave do ${provider} salva. Ela não poderá ser exibida de novo.` };
}

export async function removeProviderKey(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  if (!PROVIDERS.includes(provider)) return { ok: false, error: "Provider inválido." };

  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  try {
    await deleteProviderKey(auth.organizationId, provider);
  } catch {
    return { ok: false, error: "Não foi possível remover a chave." };
  }

  revalidatePath("/configuracoes/chaves");
  return { ok: true, mensagem: `Chave do ${provider} removida. A plataforma volta a usar a chave padrão.` };
}
