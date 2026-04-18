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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Criar conta na Pandora</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Cadastre-se para acessar sua central de agentes.
          </p>
        </div>

        {error === "signup_failed" && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Não foi possível criar a conta.
          </div>
        )}

        <form action={signUpWithEmailPassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Nome</label>
            <input
              name="nome"
              type="text"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Senha</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm outline-none"
            />
          </div>

          <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500">
            Criar conta
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-emerald-400 hover:text-emerald-300"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}