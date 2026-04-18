import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-zinc-400">
        O recurso que você tentou acessar não existe.
      </p>
      <Link
        href="/chat"
        className="mt-6 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
      >
        Voltar para o chat
      </Link>
    </main>
  );
}