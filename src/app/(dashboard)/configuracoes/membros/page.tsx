import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  getMembershipForUser,
  listOrganizationMembersForUser,
  UserWithoutOrganizationError,
} from "@/server/repositories/organization-members-repository";
import { isPlatformAdmin } from "@/server/repositories/organizations-repository";
import { MembersPanel } from "@/components/settings/members-panel";
import { SettingsNav } from "@/components/settings/settings-nav";

// Membros da própria organização (PD-25). `owner`/`admin` gerenciam; `member` só
// não chega aqui (é redirecionado).

export default async function MembrosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let role: string;
  try {
    ({ role } = await getMembershipForUser(user.id));
  } catch (err) {
    if (err instanceof UserWithoutOrganizationError) {
      return (
        <main className="mx-auto max-w-2xl p-6">
          <h1 className="text-xl font-semibold text-foreground">Membros</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a uma organização. Fale com o administrador.
          </p>
        </main>
      );
    }
    throw err;
  }

  if (role !== "owner" && role !== "admin") redirect("/chat");

  const membros = await listOrganizationMembersForUser(user.id);
  const platformAdmin = await isPlatformAdmin(user.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <SettingsNav active="membros" isPlatformAdmin={platformAdmin} />
      <h1 className="text-xl font-semibold text-foreground">Membros da organização</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Convide pessoas por e-mail. Elas recebem um link para definir a senha e entram como
        membros.
      </p>

      <MembersPanel membros={membros} currentUserId={user.id} />
    </main>
  );
}
