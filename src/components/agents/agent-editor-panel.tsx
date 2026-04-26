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

export function AgentEditorPanel({
  agent,
  knowledgeSpaces,
}: AgentEditorPanelProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              Configuração
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">{agent.nome}</h2>
          </div>

          <DeleteAgentButton agentId={agent.id} agentName={agent.nome} />
        </div>
      </div>

      <div>
        <AgentEditorForm agent={agent} knowledgeSpaces={knowledgeSpaces} />
      </div>
    </div>
  );
}
