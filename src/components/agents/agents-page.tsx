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
};

export function AgentsPage({
  agents,
  selectedAgent,
  conversations,
  knowledgeSpaces,
  knowledgeDocuments,
}: AgentsPageProps) {
  const activeAgents = agents.filter((agent) => agent.ativo);

  return (
    <main className="flex h-screen overflow-hidden bg-[#050b16] text-white">
      <AgentsSidebar agents={agents} selectedSlug={selectedAgent?.slug} />

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-10 border-b border-white/10 bg-[#020817]/95 px-5 py-4 backdrop-blur-xl md:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="hidden h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-emerald-200 sm:flex">
                <Settings2 className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                  Pandora
                </p>
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight">
                  Gestão de agentes
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/chat"
                className={cn(
                  "group hidden h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white md:inline-flex"
                )}
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Chat
              </Link>

              <CreateAgentButton />
            </div>
          </div>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {selectedAgent ? (
            <div
              key={selectedAgent.id}
              className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 md:px-8"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                    Agentes
                  </p>
                  <p className="mt-2 text-2xl font-black">{agents.length}</p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                    Ativos
                  </p>
                  <p className="mt-2 text-2xl font-black">{activeAgents.length}</p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                    Conhecimentos
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {knowledgeDocuments.length}
                  </p>
                </div>
              </div>

              <AgentEditorPanel
                agent={selectedAgent}
                knowledgeSpaces={knowledgeSpaces}
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
            <div className="flex h-full flex-col items-center justify-center px-6 text-center animate-in fade-in zoom-in-95 duration-700">
              <div className="mb-5 rounded-lg border border-white/10 bg-white/[0.04] p-6">
                <LayoutGrid className="h-12 w-12 text-white/25" />
              </div>

              <h2 className="text-2xl font-black tracking-tight">
                Selecione um agente
              </h2>
              <p className="mt-3 max-w-[340px] text-sm font-medium leading-6 text-white/55">
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
