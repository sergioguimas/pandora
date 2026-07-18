import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { diasRestantes } from "@/lib/org-lifecycle";

// Operações privilegiadas de organização (PD-25). Tudo aqui roda com o client
// admin (service_role, bypassa RLS) e SÓ deve ser chamado depois de a action
// conferir a autorização — é a "porta ao lado da parede" descrita no PD-25, não
// um buraco nela.

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error("Erro ao verificar admin de plataforma.");
  return data?.is_platform_admin === true;
}

/**
 * Cria uma organização com um dono, atômico (RPC `create_organization`).
 * Devolve o id da org nova. Lança se o dono já pertence a uma org (invariante
 * "uma org por usuário").
 */
export async function createOrganization(
  nome: string,
  ownerUserId: string
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("create_organization", {
    p_nome: nome,
    p_owner: ownerUserId,
  });

  if (error) {
    // A mensagem do RPC (ex.: "usuário já pertence a uma organização") é útil e
    // segura de repassar — não vaza dado, só o motivo da recusa.
    throw new Error(error.message);
  }

  return data as string;
}

/**
 * Convida por e-mail (ou acha, se já existir) e devolve o uuid do usuário.
 *
 * Usa `inviteUserByEmail` do Supabase: cria o usuário se novo e manda o e-mail
 * com o link de definição de senha — sem tabela de convites nem token próprio.
 * NÃO cria vínculo de organização; quem faz isso é o chamador (é `member` num
 * convite comum, ou `owner` quando o RPC cria a org).
 */
async function inviteOrGetUserId(email: string): Promise<string> {
  const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
  if (invite.data?.user) return invite.data.user.id;

  // Já existe: a API não tem getUserByEmail, então localiza pela listagem.
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw new Error("Erro ao localizar usuário para convite.");
  const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!found) throw new Error("Não foi possível resolver o usuário do convite.");
  return found.id;
}

/**
 * Cria uma organização e convida seu primeiro dono por e-mail. Só o admin de
 * plataforma chama isto (a autorização é da action). O owner é convidado (recebe
 * o e-mail de senha) e vira `owner` via o RPC atômico.
 *
 * `activeDays` e `keyMode` (PD-27) são aplicados num UPDATE logo após o RPC — o
 * RPC segue com 2 args (já está em produção), e estes campos têm default seguro,
 * então mesmo que o UPDATE falhe a org nasce ativa e em modo 'platform'.
 */
export async function createOrganizationWithOwner(
  orgName: string,
  ownerEmail: string,
  options?: { activeDays?: number | null; keyMode?: "platform" | "own" }
): Promise<{ organizationId: string; ownerUserId: string }> {
  const ownerUserId = await inviteOrGetUserId(ownerEmail);
  const organizationId = await createOrganization(orgName, ownerUserId);

  const activeUntil =
    options?.activeDays && options.activeDays > 0
      ? new Date(Date.now() + options.activeDays * 24 * 60 * 60 * 1000).toISOString()
      : null; // sem prazo

  const { error } = await supabaseAdmin
    .from("organizations")
    .update({ active_until: activeUntil, key_mode: options?.keyMode ?? "platform" })
    .eq("id", organizationId);

  if (error) throw new Error("Organização criada, mas falhou ao aplicar prazo/modo de chave.");

  return { organizationId, ownerUserId };
}

/** Liga/desliga uma organização (PD-27). Desativar bloqueia o acesso dos membros
 *  sem excluir nada; reativar libera. A org do sistema não pode ser desativada. */
export async function setOrganizationActive(
  organizationId: string,
  active: boolean
): Promise<void> {
  const { data: org, error: readErr } = await supabaseAdmin
    .from("organizations")
    .select("is_system")
    .eq("id", organizationId)
    .maybeSingle();

  if (readErr) throw new Error("Erro ao localizar a organização.");
  if (org?.is_system) throw new Error("A organização do sistema não pode ser desativada.");

  const { error } = await supabaseAdmin
    .from("organizations")
    .update({ is_active: active })
    .eq("id", organizationId);

  if (error) throw new Error("Erro ao alterar o status da organização.");
}

/** Convida um usuário para uma organização existente, como `member`. Idempotente. */
export async function inviteMemberToOrganization(
  email: string,
  organizationId: string
): Promise<{ userId: string; alreadyMember: boolean }> {
  const userId = await inviteOrGetUserId(email);

  const { data: existing } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return { userId, alreadyMember: true };

  const { error: memberErr } = await supabaseAdmin
    .from("organization_members")
    .insert({ organization_id: organizationId, user_id: userId, role: "member" });

  if (memberErr) throw new Error("Erro ao adicionar membro à organização.");
  return { userId, alreadyMember: false };
}

/** Remove um membro de uma organização. Não remove donos (protege a org de
 *  ficar sem dono) — a action já garante que quem chama é owner/admin da org. */
export async function removeMemberFromOrganization(
  userId: string,
  organizationId: string
): Promise<void> {
  const { data: alvo, error: alvoErr } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (alvoErr) throw new Error("Erro ao localizar o membro.");
  if (!alvo) return; // já não é membro
  if (alvo.role === "owner") throw new Error("O dono da organização não pode ser removido.");

  const { error } = await supabaseAdmin
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) throw new Error("Erro ao remover o membro.");
}

export type OrganizationSummary = {
  id: string;
  name: string;
  isSystem: boolean;
  memberCount: number;
  createdAt: string;
  isActive: boolean;
  activeUntil: string | null;
  /** Dias restantes até expirar; null = sem prazo; <=0 = expirada. */
  diasRestantes: number | null;
  keyMode: "platform" | "own";
  /** true = a org tem chave própria cadastrada ("api key utilizada"). */
  hasOwnKey: boolean;
};

/** Todas as organizações, para o painel de admin de plataforma. */
export async function listAllOrganizations(): Promise<OrganizationSummary[]> {
  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, is_system, created_at, is_active, active_until, key_mode")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Erro ao listar organizações.");

  // Contagem de membros e presença de chave própria, numa consulta cada.
  const { data: members, error: memErr } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id");
  if (memErr) throw new Error("Erro ao contar membros.");

  const { data: keys, error: keyErr } = await supabaseAdmin
    .from("organization_provider_keys")
    .select("organization_id");
  if (keyErr) throw new Error("Erro ao verificar chaves.");

  const contagem = new Map<string, number>();
  for (const m of members ?? []) {
    contagem.set(m.organization_id, (contagem.get(m.organization_id) ?? 0) + 1);
  }
  const comChave = new Set((keys ?? []).map((k) => k.organization_id));

  return (orgs ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    isSystem: o.is_system,
    memberCount: contagem.get(o.id) ?? 0,
    createdAt: o.created_at,
    isActive: o.is_active,
    activeUntil: o.active_until,
    diasRestantes: diasRestantes(o.active_until),
    keyMode: o.key_mode === "own" ? "own" : "platform",
    hasOwnKey: comChave.has(o.id),
  }));
}
