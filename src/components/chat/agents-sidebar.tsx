"use client";

import { LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Bot, MessageSquare, Plus, Search } from "lucide-react";
import type { AgentListItem } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AgentsSidebarContent } from "@/components/chat/agents-sidebar-content";
import { ConversationsSidebarContent } from "@/components/chat/conversations-sidebar-content";
import { MobileSidebarTrigger } from "@/components/chat/mobile-sidebar-trigger";
import { CreateConversationModal } from "@/components/chat/create-conversation-modal";
import { cn } from "@/lib/utils";

type AgentsSidebarProps = {
  agents: AgentListItem[];
  activeSlug?: string;
};

type SidebarMode = "conversations" | "agents";

export type ConversationSidebarItem = {
  id: string;
  titulo: string | null;
  updated_at: string;
  href: string;
  primaryAgent: {
    id: string;
    slug: string;
    nome: string;
  };
  agents: Array<{
    id: string;
    slug: string;
    nome: string;
    ordem: number;
  }>;
};

export function AgentsSidebar({ agents, activeSlug }: AgentsSidebarProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SidebarMode>("conversations");
  const [conversations, setConversations] = useState<ConversationSidebarItem[]>(
    []
  );

  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations ?? []))
      .catch(() => setConversations([]));
  }, [createOpen]);

  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return agents;

    return agents.filter((agent) => {
      return (
        agent.nome.toLowerCase().includes(normalized) ||
        (agent.descricao ?? "").toLowerCase().includes(normalized) ||
        (agent.category ?? "").toLowerCase().includes(normalized) ||
        agent.tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
        (agent.last_message_preview ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [agents, query]);

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return conversations;

    return conversations.filter((conversation) => {
      return (
        (conversation.titulo ?? "").toLowerCase().includes(normalized) ||
        conversation.primaryAgent.nome.toLowerCase().includes(normalized) ||
        conversation.agents.some((agent) =>
          agent.nome.toLowerCase().includes(normalized)
        )
      );
    });
  }, [conversations, query]);

  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  const sidebarInner = (
    <div className="flex h-full flex-col bg-surface-1 text-foreground">
      <div className="space-y-3 border-b border-border px-4 py-4">
        <Button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setOpen(false);
          }}
          className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova conversa
        </Button>

        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setMode("conversations")}
            className={cn(
              "flex h-8 items-center justify-center gap-2 rounded-sm text-xs font-medium transition-colors",
              mode === "conversations"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Conversas
          </button>

          <button
            type="button"
            onClick={() => setMode("agents")}
            className={cn(
              "flex h-8 items-center justify-center gap-2 rounded-sm text-xs font-medium transition-colors",
              mode === "agents"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className="h-3.5 w-3.5" />
            Agentes
          </button>
        </div>

        <div className="group relative">
          <Search
            className={cn(
              "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
              query
                ? "text-muted-foreground"
                : "text-subtle-foreground group-focus-within:text-muted-foreground"
            )}
          />

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              mode === "conversations"
                ? "Buscar conversas…"
                : "Buscar agentes…"
            }
            className={cn(
              "h-10 rounded-md border-border bg-surface-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground",
              "outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            )}
          />
        </div>
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        {mode === "conversations" ? (
          <ConversationsSidebarContent
            conversations={filteredConversations}
            onNavigate={() => setOpen(false)}
          />
        ) : filteredAgents.length > 0 ? (
          <AgentsSidebarContent
            agents={filteredAgents}
            activeSlug={activeSlug}
            onNavigate={() => setOpen(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 rounded-md border border-border bg-surface-2 p-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum resultado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nada encontrado para &quot;{query}&quot;.
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-border p-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="z-20 hidden w-full max-w-[320px] border-r border-border md:block lg:max-w-sm">
        {sidebarInner}
      </aside>

      <div className="md:hidden">
        <div className="fixed left-4 top-4 z-50">
          <MobileSidebarTrigger onClick={() => setOpen(true)} />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-sm border-r border-border bg-surface-1 p-0"
          >
            <SheetTitle className="sr-only">Menu</SheetTitle>
            {sidebarInner}
          </SheetContent>
        </Sheet>
      </div>

      <CreateConversationModal
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}