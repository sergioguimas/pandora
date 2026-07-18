import type { Agent } from "@/types/database";
import { AgentEditorForm } from "@/components/agents/agent-editor-form";
import { DeleteAgentButton } from "@/components/agents/delete-agent-button";
import type { Provider } from "@/lib/provider-keys";

type KnowledgeSpaceOption = {
  id: string;
  nome: string;
};

type AgentEditorPanelProps = {
  agent: Agent;
  knowledgeSpaces?: KnowledgeSpaceOption[];
  availableProviders?: Provider[];
};

export function AgentEditorPanel({
  agent,
  knowledgeSpaces,
  availableProviders,
}: AgentEditorPanelProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            configuração
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-foreground">
            {agent.nome}
          </h2>
        </div>

        <DeleteAgentButton agentId={agent.id} agentName={agent.nome} />
      </div>

      <AgentEditorForm
        agent={agent}
        knowledgeSpaces={knowledgeSpaces}
        availableProviders={availableProviders}
      />
    </div>
  );
}
