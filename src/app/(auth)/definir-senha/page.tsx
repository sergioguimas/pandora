import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/get-user";
import { SetPasswordForm } from "./set-password-form";

// A sessão é estabelecida antes, pela rota /auth/confirm (que processa o token do
// e-mail). Se chegou aqui SEM sessão, o link expirou/é inválido ou o usuário
// entrou direto — mostramos como pedir um novo, em vez de um formulário que
// falharia.

export default async function DefinirSenhaPage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-lg font-semibold text-foreground">Definir senha</h1>

      {user ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie uma senha para acessar sua conta ({user.email}).
          </p>
          <SetPasswordForm />
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link não é mais válido. Peça um novo pela opção &quot;Esqueci minha
            senha&quot; na tela de acesso.
          </p>
          <Link
            href="/recuperar-senha"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Pedir novo link
          </Link>
        </>
      )}
    </main>
  );
}
