"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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
    <div className="flex h-full flex-col bg-[#020817] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="relative group">
          <Search
            className={cn(
              "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200",
              query
                ? "text-white/70"
                : "text-white/35 group-focus-within:text-white/70"
            )}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou conteúdo..."
            className={cn(
              "h-11 rounded-2xl border-white/10 bg-white/5 pl-10 pr-14 text-sm text-white placeholder:text-white/35 transition-all",
              "focus:border-white/20 focus:bg-white/8 focus:ring-4 focus:ring-white/5 outline-none"
            )}
          />
          {!query && (
            <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 opacity-40 lg:flex">
              <kbd className="text-[10px] font-sans text-white/60">⌘</kbd>
              <kbd className="text-[10px] font-sans text-white/60">K</kbd>
            </div>
          )}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {filteredAgents.length > 0 ? (
          <AgentsSidebarContent
            agents={filteredAgents}
            activeSlug={activeSlug}
            onNavigate={() => setOpen(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 rounded-full border border-white/10 bg-white/5 p-3">
              <Search className="h-6 w-6 text-white/35" />
            </div>
            <p className="text-sm font-medium text-white">Nenhum resultado</p>
            <p className="mt-1 text-xs text-white/50">
              Não encontramos nenhum agente para "{query}"
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="z-20 hidden w-full max-w-[320px] border-r border-white/10 md:block lg:max-w-sm">
        {sidebarInner}
      </aside>

      <div className="md:hidden">
        <div className="fixed left-4 top-4 z-50">
          <MobileSidebarTrigger onClick={() => setOpen(true)} />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-sm border-r border-white/10 bg-[#020817]/95 p-0 shadow-2xl backdrop-blur-2xl"
          >
            <SheetTitle className="sr-only">Menu de Agentes</SheetTitle>
            {sidebarInner}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}