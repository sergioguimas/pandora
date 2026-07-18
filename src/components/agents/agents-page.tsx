"use client";

import Link from "next/link";
import type { Agent } from "@/types/database";
import { AgentsSidebar } from "@/components/agents/agents-sidebar";
import { CreateAgentButton } from "@/components/agents/create-agent-button";
import { AgentEditorPanel } from "@/components/agents/agent-editor-panel";
import { KnowledgeIngestForm } from "@/components/agents/knowledge-ingest-form";
import { KnowledgeDocumentsList } from "@/components/agents/knowledge-documents-list";
import { ChevronLeft, LayoutGrid, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/provider-keys";
import type { KnowledgeDocumentListItem } from "@/server/repositories/knowledge-repository";

type ConversationOption = {
  id: string;
  titulo: string | null;
};

type KnowledgeSpaceOption = {
  id: string;
  nome: string;
};

type AgentsPageProps = {
  agents: Agent[];
  selectedAgent: Agent | null;
  knowledgeSpaces: KnowledgeSpaceOption[];
  conversations: ConversationOption[];
  knowledgeDocuments: KnowledgeDocumentListItem[];
  availableProviders?: Provider[];
};

export function AgentsPage({
  agents,
  selectedAgent,
  conversations,
  knowledgeSpaces,
  knowledgeDocuments,
  availableProviders,
}: AgentsPageProps) {
  const activeAgents = agents.filter((agent) => agent.ativo);

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <AgentsSidebar agents={agents} selectedSlug={selectedAgent?.slug} />

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-10 border-b border-border bg-surface-1 px-5 py-3.5 md:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground sm:flex">
                <Settings2 className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Pandora AI Hub
                </p>
                <h1 className="truncate text-base font-semibold tracking-tight">
                  Gestão de agentes
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/chat"
                className={cn(
                  "group hidden h-9 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground md:inline-flex"
                )}
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Chat
              </Link>

              <CreateAgentButton />
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedAgent ? (
            <div
              key={selectedAgent.id}
              className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-6 md:px-8"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Agentes
                  </p>
                  <p className="mt-1.5 text-2xl font-semibold">{agents.length}</p>
                </div>

                <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Ativos
                  </p>
                  <p className="mt-1.5 text-2xl font-semibold">{activeAgents.length}</p>
                </div>

                <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Conhecimentos
                  </p>
                  <p className="mt-1.5 text-2xl font-semibold">
                    {knowledgeDocuments.length}
                  </p>
                </div>
              </div>

              <AgentEditorPanel
                agent={selectedAgent}
                knowledgeSpaces={knowledgeSpaces}
                availableProviders={availableProviders}
              />

              <KnowledgeIngestForm
                agentId={selectedAgent.id}
                agentName={selectedAgent.nome}
                conversations={conversations}
                knowledgeSpaces={knowledgeSpaces}
                defaultKnowledgeSpaceId={selectedAgent.knowledge_space_id}
              />

              <KnowledgeDocumentsList documents={knowledgeDocuments} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-md border border-border bg-surface-1 p-5">
                <LayoutGrid className="h-9 w-9 text-muted-foreground" />
              </div>

              <h2 className="text-lg font-semibold tracking-tight">
                Selecione um agente
              </h2>
              <p className="mt-1.5 max-w-[340px] text-sm leading-6 text-muted-foreground">
                Escolha um perfil na barra lateral para ajustar prompts,
                comportamento e base de conhecimento.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
