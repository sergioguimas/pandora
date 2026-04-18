import { createAgent } from "@/server/actions/agents-actions";

export function CreateAgentButton() {
  return (
    <form action={createAgent}>
      <button
        type="submit"
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
      >
        Novo agente
      </button>
    </form>
  );
}