import { Plus } from "lucide-react";
import { createAgent } from "@/server/actions/agents-actions";

export function CreateAgentButton() {
  return (
    <form action={createAgent}>
      <button
        type="submit"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#020817] transition hover:bg-white/90"
      >
        <Plus className="h-4 w-4" />
        Novo agente
      </button>
    </form>
  );
}
