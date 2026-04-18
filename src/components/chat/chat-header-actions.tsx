import { signOut } from "@/server/actions/auth-actions";

export function ChatHeaderActions() {
  return (
    <form action={signOut}>
      <button className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800">
        Sair
      </button>
    </form>
  );
}