import { createClient } from "@/lib/supabase/server";
import { isOrgEffectivelyActive } from "@/lib/org-lifecycle";

// PD-25: NÃO há mais organização padrão, e nenhum funil para ela.
//
// Antes, `getOrganizationIdForUser` caía num `ensureUserInDefaultOrganization`
// que inseria o usuário na org `11111111-…` ("Base Geral"). Junto com o
// `/cadastro` público, isso fazia de qualquer cadastro um colega de organização
// do dono do produto — o buraco do PD-25. O funil morreu: um usuário sem org é
// um estado legítimo (recém-criado, ainda não convidado), tratado por quem
// chama, não "consertado" jogando-o numa org compartilhada.

export class UserWithoutOrganizationError extends Error {
  constructor(userId: string) {
    super(`Usuário ${userId} não pertence a nenhuma organização.`);
    this.name = "UserWithoutOrganizationError";
  }
}

/**
 * A organização do usuário. Uma, e exatamente uma (decisão do PD-25).
 *
 * Lança `UserWithoutOrganizationError` se ele não tiver org — o chamador decide
 * o que mostrar (tela de "aguardando convite", por exemplo). Antes isto puxava a
 * associação mais antiga por `created_at`, o que era frágil e alimentava o
 * funil; agora, achar mais de uma org é sinal de estado inconsistente e falha
 * alto em vez de escolher uma em silêncio.
 */
export async function getOrganizationIdForUser(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error("Erro ao buscar organização do usuário.");
  }

  const orgs = data ?? [];

  if (orgs.length === 0) {
    throw new UserWithoutOrganizationError(userId);
  }

  if (orgs.length > 1) {
    // Não deveria acontecer com o invariante do PD-25. Se acontecer, é bug de
    // provisionamento — gritar é melhor que escolher uma e mascarar.
    throw new Error(
      `Usuário ${userId} pertence a ${orgs.length} organizações; esperava 1.`
    );
  }

  return orgs[0].organization_id as string;
}

/** A organização do usuário, ou `null` se ele ainda não pertence a nenhuma. */
export async function getOrganizationIdForUserOrNull(
  userId: string
): Promise<string | null> {
  try {
    return await getOrganizationIdForUser(userId);
  } catch (err) {
    if (err instanceof UserWithoutOrganizationError) return null;
    throw err;
  }
}

/** A organização do usuário + se ela está EFETIVAMENTE ativa (PD-27):
 *  `is_active` manual E dentro do prazo (`active_until`). `null` = sem org.
 *  Usado no bloqueio de org inativa (layout do dashboard, rotas de API). */
export async function getOrganizationAccessForUser(
  userId: string
): Promise<{ organizationId: string; active: boolean } | null> {
  const organizationId = await getOrganizationIdForUserOrNull(userId);
  if (!organizationId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("is_active, active_until")
    .eq("id", organizationId)
    .single();

  if (error) throw new Error("Erro ao verificar status da organização.");

  const active = isOrgEffectivelyActive(data.is_active, data.active_until);
  return { organizationId, active };
}

export type OrgRole = "owner" | "admin" | "member";

/** A organização do usuário e o papel dele nela. Lança se não tiver org. */
export async function getMembershipForUser(
  userId: string
): Promise<{ organizationId: string; role: OrgRole }> {
  const supabase = await createClient();
  const organizationId = await getOrganizationIdForUser(userId);

  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single();

  if (error) throw new Error("Erro ao buscar papel do usuário.");
  return { organizationId, role: data.role as OrgRole };
}

export async function listOrganizationMembersForUser(userId: string) {
  const supabase = await createClient();
  const organizationId = await getOrganizationIdForUser(userId);

  const { data: membersData, error: membersError } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (membersError) {
    throw new Error("Erro ao buscar membros da organização.");
  }

  const members = (membersData ?? []) as Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at: string;
  }>;

  if (members.length === 0) {
    return [];
  }

  const userIds = members.map((member) => member.user_id);

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nome, email, avatar_url")
    .in("id", userIds);

  if (profilesError) {
    throw new Error("Erro ao buscar perfis dos membros da organização.");
  }

  const profileMap = new Map(
    ((profilesData ?? []) as Array<{
      id: string;
      nome: string | null;
      email: string | null;
      avatar_url: string | null;
    }>).map((profile) => [profile.id, profile])
  );

  return members.map((member) => {
    const profile = profileMap.get(member.user_id);

    return {
      user_id: member.user_id,
      role: member.role,
      created_at: member.created_at,
      nome: profile?.nome ?? null,
      email: profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}
