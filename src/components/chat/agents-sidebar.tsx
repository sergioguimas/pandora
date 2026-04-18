"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AgentListItem } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AgentsSidebarContent } from "@/components/chat/agents-sidebar-content";
import { MobileSidebarTrigger } from "@/components/chat/mobile-sidebar-trigger";

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
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar agentes..."
            className="h-11 rounded-2xl border-border/60 bg-background/60 pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentsSidebarContent
          agents={filteredAgents}
          activeSlug={activeSlug}
          onNavigate={() => setOpen(false)}
        />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-full max-w-sm border-r border-border/60 bg-card/60 backdrop-blur-2xl md:block">
        {sidebarInner}
      </aside>

      <div className="md:hidden">
        <div className="fixed left-4 top-4 z-50">
          <MobileSidebarTrigger onClick={() => setOpen(true)} />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-sm border-border/60 bg-card/90 p-0 backdrop-blur-2xl"
          >
            <SheetTitle className="sr-only">Agentes</SheetTitle>
            {sidebarInner}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}