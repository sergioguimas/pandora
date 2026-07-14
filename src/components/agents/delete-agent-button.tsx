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
        className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
      >
        <Trash2 className="h-4 w-4" />
        Excluir
      </button>
    </form>
  );
}
