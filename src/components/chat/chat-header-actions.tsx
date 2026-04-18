import { signOut } from "@/server/actions/auth-actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function ChatHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />

      <form action={signOut}>
        <button className="rounded-xl border border-border bg-card/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition hover:bg-accent">
          Sair
        </button>
      </form>
    </div>
  );
}