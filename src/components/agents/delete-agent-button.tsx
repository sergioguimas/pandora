"use client";

import { Trash2 } from "lucide-react";
import { deleteAgent } from "@/server/actions/agents-actions";

type DeleteAgentButtonProps = {
  agentId: string;
  agentName: string;
};

export function DeleteAgentButton({
  agentId,
  agentName,
}: DeleteAgentButtonProps) {
  return (
    <form
      action={deleteAgent}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Tem certeza que deseja excluir o agente "${agentName}"?\n\nEssa ação também removerá as conversas vinculadas a ele.`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={agentId} />

      <button
        type="submit"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/15"
      >
        <Trash2 className="h-4 w-4" />
        Excluir
      </button>
    </form>
  );
}
