import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getOrganizationIdForUserOrNull } from "@/server/repositories/organization-members-repository";
import { NoOrganization } from "@/components/layout/no-organization";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Ponto único de estrangulamento (PD-25): um usuário sem organização não passa
  // do dashboard. Isso protege TODAS as páginas de uma vez — chat, agentes,
  // config — em vez de cada chamador de `getOrganizationIdForUser` estourar um
  // 500. As rotas de API ficam fora deste layout e têm guarda própria.
  const organizationId = await getOrganizationIdForUserOrNull(user.id);
  if (!organizationId) {
    return <NoOrganization />;
  }

  return <>{children}</>;
}
