"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AgentListItem } from "@/types/database";
import { Settings2, MessageSquare, Sparkles } from "lucide-react";

type AgentsSidebarContentProps = {
  agents: AgentListItem[];
  activeSlug?: string;
  onNavigate?: () => void;
};

export function AgentsSidebarContent({
  agents,
  activeSlug,
  onNavigate,
}: AgentsSidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header Interno - Brand & Call to Action */}
      <div className="px-6 py-6 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-foreground flex items-center gap-2">
              Pandora
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Intelligence Hub
            </p>
          </div>
        </div>
        
        <Link
          href="/agentes"
          className="group flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-card/50 px-3 py-2.5 text-xs font-bold text-foreground shadow-sm backdrop-blur-md transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary active:scale-[0.98]"
        >
          <Settings2 className="h-3.5 w-3.5 transition-transform group-hover:rotate-45" />
          Configurar Agentes
        </Link>
      </div>

      {/* Lista de Agentes */}
      <div className="flex-1 overflow-y-auto py-2">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum agente disponível.
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {agents.map((agent) => {
              const isActive = activeSlug === agent.slug;

              return (
                <Link
                  key={agent.id}
                  href={`/chat/${agent.slug}`}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-start gap-4 rounded-2xl px-4 py-4 transition-all duration-200",
                    "hover:bg-accent/50",
                    isActive 
                      ? "bg-primary/10 shadow-sm ring-1 ring-primary/20" 
                      : "bg-transparent"
                  )}
                >
                  {/* Avatar/Badge do Agente */}
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-all duration-300 shadow-inner",
                      isActive
                        ? "bg-primary text-primary-foreground rotate-3 scale-110 shadow-primary/20"
                        : "bg-secondary text-muted-foreground group-hover:bg-background group-hover:text-primary"
                    )}
                  >
                    {agent.nome.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info da Conversa */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={cn(
                        "truncate text-sm font-bold tracking-tight transition-colors",
                        isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                      )}>
                        {agent.nome}
                      </p>

                      <div className="flex items-center gap-2 shrink-0">
                        {agent.last_message_at && (
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                            {format(new Date(agent.last_message_at), "HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        )}
                        {isActive && (
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        )}
                      </div>
                    </div>

                    <p className={cn(
                      "line-clamp-1 text-xs font-medium leading-relaxed transition-colors",
                      isActive ? "text-primary/70" : "text-muted-foreground group-hover:text-muted-foreground/80"
                    )}>
                      {agent.last_message_preview ??
                        agent.descricao ??
                        "Pronto para ajudar."}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}