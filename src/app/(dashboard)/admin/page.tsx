import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  isPlatformAdmin,
  listAllOrganizations,
} from "@/server/repositories/organizations-repository";
import { AdminPanel } from "@/components/admin/admin-panel";
import { SettingsNav } from "@/components/settings/settings-nav";

// Painel de admin de PLATAFORMA (PD-25). Só o login com `is_platform_admin`
// chega aqui — qualquer outro é mandado para o /chat. A criação de organizações
// vive só neste painel.

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!(await isPlatformAdmin(user.id))) {
    redirect("/chat");
  }

  const organizacoes = await listAllOrganizations();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <SettingsNav active="admin" isPlatformAdmin />
      <h1 className="text-xl font-semibold text-foreground">Administração da plataforma</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Crie organizações e acompanhe as existentes. Cada organização gerencia os próprios
        membros a partir daqui.
      </p>

      <AdminPanel organizacoes={organizacoes} />
    </main>
  );
}
