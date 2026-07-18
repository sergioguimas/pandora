import { signOut } from "@/server/actions/auth-actions";

// Tela para membro de uma organização INATIVA (PD-27) — desativada manualmente
// ou com o prazo expirado. Bloqueia o uso sem excluir nada; ao reativar, o
// acesso volta. O bloqueio é de camada de app (login/layout/API): o dado
// continua no banco, apenas o acesso pela aplicação é barrado.

export function OrgSuspended() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Organização suspensa</h1>
      <p className="text-sm text-muted-foreground">
        O acesso da sua organização está temporariamente suspenso. Fale com o
        administrador da plataforma para regularizar. Seus dados continuam salvos.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
