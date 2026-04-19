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

type AgentsPageProps = {
  agents: Agent[];
  selectedAgent: Agent | null;
  conversations: ConversationOption[];
  knowledgeDocuments: KnowledgeDocumentListItem[];
};

export function AgentsPage({
  agents,
  selectedAgent,
  conversations,
  knowledgeDocuments,
}: AgentsPageProps) {
  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <AgentsSidebar
        agents={agents}
        selectedSlug={selectedAgent?.slug}
      />

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-10 border-b border-border/50 bg-card/40 px-8 py-5 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary sm:flex">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-foreground">
                  Gestão de Agentes
                </h1>
                <p className="mt-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Configuração de Inteligência Pandora
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/chat"
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all",
                  "text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95"
                )}
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Voltar ao Chat
              </Link>

              <div className="h-6 w-[1px] bg-border/60" />

              <CreateAgentButton />
            </div>
          </div>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {selectedAgent ? (
            <div
              key={selectedAgent.id}
              className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <AgentEditorPanel agent={selectedAgent} />

              <KnowledgeIngestForm
                agentId={selectedAgent.id}
                agentName={selectedAgent.nome}
                conversations={conversations}
              />

              <KnowledgeDocumentsList documents={knowledgeDocuments} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center animate-in fade-in zoom-in-95 duration-700">
              <div className="relative mb-6">
                <div className="absolute inset-0 scale-150 rounded-full bg-primary/5 blur-3xl" />
                <div className="relative rounded-3xl border border-border/60 bg-card p-6 shadow-xl">
                  <LayoutGrid className="h-12 w-12 text-muted-foreground/20" />
                </div>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-foreground">
                Selecione um Agente
              </h2>
              <p className="mt-3 max-w-[320px] text-sm font-medium leading-relaxed text-muted-foreground">
                Escolha um perfil na barra lateral para ajustar permissões
                técnicas, prompts de sistema e parâmetros de resposta.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}