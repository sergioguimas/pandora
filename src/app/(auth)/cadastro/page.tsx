import Link from "next/link";
import { signUpWithEmailPassword } from "@/server/actions/auth-actions";

type CadastroPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function CadastroPage({
  searchParams,
}: CadastroPageProps) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary font-mono text-lg font-semibold text-primary-foreground">
            P
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Pandora AI Hub</p>
            <p className="font-mono text-xs text-muted-foreground">
              central de agentes
            </p>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre-se para acessar sua central de agentes.
        </p>

        {error === "signup_failed" && (
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível criar a conta.
          </div>
        )}

        <form action={signUpWithEmailPassword} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Nome
            </label>
            <input
              name="nome"
              type="text"
              required
              className="h-11 w-full rounded-md border border-input bg-surface-1 px-3.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="h-11 w-full rounded-md border border-input bg-surface-1 px-3.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Senha
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="h-11 w-full rounded-md border border-input bg-surface-1 px-3.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <button className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90">
            Criar conta
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}