"use client";

import { useMemo, useState } from "react";
import { Search, Command, MessageSquare } from "lucide-react"; // Adicionado ícones para contexto
import type { AgentListItem } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AgentsSidebarContent } from "@/components/chat/agents-sidebar-content";
import { MobileSidebarTrigger } from "@/components/chat/mobile-sidebar-trigger";
import { cn } from "@/lib/utils";

type AgentsSidebarProps = {
  agents: AgentListItem[];
  activeSlug?: string;
};

export function AgentsSidebar({
  agents,
  activeSlug,
}: AgentsSidebarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return agents;

    return agents.filter((agent) => {
      return (
        agent.nome.toLowerCase().includes(normalized) ||
        (agent.descricao ?? "").toLowerCase().includes(normalized) ||
        (agent.last_message_preview ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [agents, query]);

  const sidebarInner = (
    <div className="flex h-full flex-col bg-card/30 backdrop-blur-xl">
      {/* Header da Sidebar com Título e Busca */}
      <div className="flex flex-col gap-4 border-b border-border/60 px-6 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Conversas
          </h2>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {agents.length} Agentes
          </span>
        </div>

        <div className="relative group">
          <Search className={cn(
            "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200",
            query ? "text-primary" : "text-muted-foreground group-focus-within:text-primary"
          )} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou conteúdo..."
            className={cn(
              "h-10 rounded-xl border-border/40 bg-background/40 pl-9 pr-4 text-sm transition-all",
              "focus:bg-background/80 focus:ring-4 focus:ring-primary/10 outline-none"
            )}
          />
          {/* Atalho visual sutil (opcional) */}
          {!query && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 opacity-40">
              <kbd className="text-[10px] font-sans">⌘</kbd>
              <kbd className="text-[10px] font-sans">K</kbd>
            </div>
          )}
        </div>
      </div>

      {/* Área de Conteúdo com Scrollbar Customizada */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
        {filteredAgents.length > 0 ? (
          <AgentsSidebarContent
            agents={filteredAgents}
            activeSlug={activeSlug}
            onNavigate={() => setOpen(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Search className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum resultado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Não encontramos nenhum agente para "{query}"
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Aside */}
      <aside className="hidden w-full max-w-[320px] lg:max-w-sm border-r border-border/50 md:block z-20">
        {sidebarInner}
      </aside>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <div className="fixed left-4 top-4 z-50">
          <MobileSidebarTrigger onClick={() => setOpen(true)} />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-sm border-r border-border/60 bg-card/95 p-0 shadow-2xl backdrop-blur-2xl"
          >
            <SheetTitle className="sr-only">Menu de Agentes</SheetTitle>
            {sidebarInner}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}