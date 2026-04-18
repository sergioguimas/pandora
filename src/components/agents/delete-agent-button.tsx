"use client";

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
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
      >
        Excluir agente
      </button>
    </form>
  );
}