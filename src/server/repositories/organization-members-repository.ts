import { createClient } from "@/lib/supabase/server";

const DEFAULT_ORGANIZATION_ID = "11111111-1111-1111-1111-111111111111";

export async function ensureUserInDefaultOrganization(userId: string) {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error("Erro ao verificar organização do usuário.");
  }

  if (existing) return;

  const { error: insertError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: DEFAULT_ORGANIZATION_ID,
      user_id: userId,
      role: "member",
    });

  if (insertError) {
    throw new Error("Erro ao adicionar usuário à organização padrão.");
  }
}

export async function getOrganizationIdForUser(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Erro ao buscar organização do usuário.");
  }

  if (data?.organization_id) {
    return data.organization_id as string;
  }

  await ensureUserInDefaultOrganization(userId);

  const { data: retryData, error: retryError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (retryError || !retryData?.organization_id) {
    throw new Error("Organização do usuário não encontrada.");
  }

  return retryData.organization_id as string;
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