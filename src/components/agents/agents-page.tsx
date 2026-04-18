import Link from "next/link";
import type { Agent } from "@/types/database";
import { AgentsSidebar } from "@/components/agents/agents-sidebar";
import { CreateAgentButton } from "@/components/agents/create-agent-button";
import { AgentEditorPanel } from "@/components/agents/agent-editor-panel";

type AgentsPageProps = {
  agents: Agent[];
  selectedAgent: Agent | null;
};

export function AgentsPage({
  agents,
  selectedAgent,
}: AgentsPageProps) {
  return (
    <main className="flex h-screen bg-background text-foreground">
      <AgentsSidebar
        agents={agents}
        selectedSlug={selectedAgent?.slug}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Administração interna dos agentes da Pandora
              </p>
            </div>

            <div className="flex items-center gap-3">
              <CreateAgentButton />

              <Link
                href="/chat"
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Voltar ao chat
              </Link>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {selectedAgent ? (
            <AgentEditorPanel agent={selectedAgent} />
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">
                  Nenhum agente selecionado
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Escolha um agente na lateral para começar a edição.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}