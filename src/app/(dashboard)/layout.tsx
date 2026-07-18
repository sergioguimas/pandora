import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getOrganizationAccessForUser } from "@/server/repositories/organization-members-repository";
import { NoOrganization } from "@/components/layout/no-organization";
import { OrgSuspended } from "@/components/layout/org-suspended";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Ponto único de estrangulamento (PD-25/27): protege TODAS as páginas de uma
  // vez — chat, agentes, config. Sem organização → tela de convite; organização
  // inativa (desativada ou com prazo vencido) → tela de suspensão. As rotas de
  // API ficam fora deste layout e têm guarda própria.
  const access = await getOrganizationAccessForUser(user.id);
  if (!access) {
    return <NoOrganization />;
  }
  if (!access.active) {
    return <OrgSuspended />;
  }

  return <>{children}</>;
}
