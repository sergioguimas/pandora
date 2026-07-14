import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        O recurso que você tentou acessar não existe.
      </p>
      <Link
        href="/chat"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
      >
        Voltar para o chat
      </Link>
    </main>
  );
}