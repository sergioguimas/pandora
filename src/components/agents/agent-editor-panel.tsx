import type { Agent } from "@/types/database";
import { AgentEditorForm } from "@/components/agents/agent-editor-form";
import { DeleteAgentButton } from "@/components/agents/delete-agent-button";

type KnowledgeSpaceOption = {
  id: string;
  nome: string;
};

type AgentEditorPanelProps = {
  agent: Agent;
  knowledgeSpaces?: KnowledgeSpaceOption[];
};

export function AgentEditorPanel({ agent }: AgentEditorPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-end">
          <DeleteAgentButton agentId={agent.id} agentName={agent.nome} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <AgentEditorForm agent={agent} />
      </div>
    </div>
  );
}