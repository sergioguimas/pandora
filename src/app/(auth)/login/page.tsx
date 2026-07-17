import { signInWithEmailPassword } from "@/server/actions/auth-actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    created?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params?.error;
  const created = params?.created;

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

        <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse sua central de agentes.
        </p>

        {created === "1" && (
          <div className="mt-5 rounded-md border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary">
            Conta criada. Agora é só entrar.
          </div>
        )}

        {error === "invalid_credentials" && (
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Email ou senha inválidos.
          </div>
        )}

        {error === "signup_failed" && (
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível criar a conta.
          </div>
        )}

        <form action={signInWithEmailPassword} className="mt-6 space-y-4">
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
              className="h-11 w-full rounded-md border border-input bg-surface-1 px-3.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <button className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90">
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          O acesso é por convite. Fale com o administrador da sua organização.
        </p>
      </div>
    </main>
  );
}