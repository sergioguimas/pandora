import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  getMembershipForUser,
  UserWithoutOrganizationError,
} from "@/server/repositories/organization-members-repository";
import { listProviderKeysForOrg } from "@/server/repositories/provider-keys-repository";
import { isPlatformAdmin } from "@/server/repositories/organizations-repository";
import { ProviderKeysForm } from "@/components/settings/provider-keys-form";
import { SettingsNav } from "@/components/settings/settings-nav";

// Configuração das chaves de API por organização (PD-26).
// Só `owner`/`admin` chegam aqui; `member` é redirecionado.

export default async function ChavesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let organizationId: string;
  let role: string;
  try {
    ({ organizationId, role } = await getMembershipForUser(user.id));
  } catch (err) {
    if (err instanceof UserWithoutOrganizationError) {
      // Usuário sem organização (PD-25): ainda não foi provisionado/convidado.
      return (
        <main className="mx-auto max-w-2xl p-6">
          <h1 className="text-xl font-semibold text-foreground">Chaves de API</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a uma organização. Fale com o administrador.
          </p>
        </main>
      );
    }
    throw err;
  }

  if (role !== "owner" && role !== "admin") {
    redirect("/chat");
  }

  const chaves = await listProviderKeysForOrg(organizationId);
  const platformAdmin = await isPlatformAdmin(user.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <SettingsNav active="chaves" isPlatformAdmin={platformAdmin} />
      <h1 className="text-xl font-semibold text-foreground">Chaves de API da organização</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Informe a chave do provedor para que esta organização use a própria cota. Sem uma
        chave aqui, a plataforma usa a chave padrão.
      </p>

      <ProviderKeysForm chaves={chaves} />
    </main>
  );
}
