import { signOut } from "@/server/actions/auth-actions";

// Tela para o usuário AUTENTICADO mas sem organização (PD-25).
//
// Depois que o /cadastro foi fechado, o acesso é por convite, e o convite já
// vincula à org. Então este estado é EXCEÇÃO — um convite que criou o usuário
// mas não completou o vínculo, ou uma conta criada fora do fluxo. Em vez de um
// 500 cru (o que `getOrganizationIdForUser` lançaria), mostramos isto, com uma
// saída (sair) para o usuário não ficar preso.

export function NoOrganization() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        Sua conta ainda não está em uma organização
      </h1>
      <p className="text-sm text-muted-foreground">
        O acesso ao Pandora é por convite. Peça ao administrador da sua organização para
        te convidar pelo seu e-mail — assim que ele fizer isso, é só entrar de novo.
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
