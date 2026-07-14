import { Plus } from "lucide-react";
import { createAgent } from "@/server/actions/agents-actions";

export function CreateAgentButton() {
  return (
    <form action={createAgent}>
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Novo agente
      </button>
    </form>
  );
}
