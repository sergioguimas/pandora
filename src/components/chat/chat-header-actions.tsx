import Link from "next/link";
import { signOut } from "@/server/actions/auth-actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function ChatHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/agentes"
        className="rounded-xl border border-border bg-card/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition hover:bg-accent"
      >
        Agentes
      </Link>

      <ThemeToggle />

      <form action={signOut}>
        <button className="rounded-xl border border-border bg-card/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition hover:bg-accent">
          Sair
        </button>
      </form>
    </div>
  );
}