"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentListItem } from "@/types/database";

type AgentsSidebarContentProps = {
  agents: AgentListItem[];
  activeSlug?: string;
  onNavigate?: () => void;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatLastMessageTime(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return format(date, "HH:mm", { locale: ptBR });
}

function buildAgentHref(agent: AgentListItem) {
  if (agent.last_conversation_id) {
    return `/chat/${agent.slug}?conversation=${agent.last_conversation_id}`;
  }

  return `/chat/${agent.slug}`;
}

export function AgentsSidebarContent({
  agents,
  activeSlug,
  onNavigate,
}: AgentsSidebarContentProps) {
  const agentsWithHistory = agents.filter((agent) => agent.last_conversation_id);

  return (
    <aside className="flex h-full w-full flex-col text-foreground">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Agentes</h2>
          <span className="font-mono text-xs text-subtle-foreground">
            {agents.length} · {agentsWithHistory.length} recentes
          </span>
        </div>

        <Link
          href="/agentes"
          onClick={onNavigate}
          aria-label="Configurar agentes"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="space-y-0.5">
          {agents.map((agent) => {
            const active = activeSlug === agent.slug;
            const time = formatLastMessageTime(agent.last_message_at);

            return (
              <Link
                key={agent.id}
                href={buildAgentHref(agent)}
                onClick={onNavigate}
                className={cn(
                  "group block rounded-md px-2 py-2.5 transition-colors",
                  active
                    ? "bg-primary-soft"
                    : "hover:bg-surface-2"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold",
                      active
                        ? "bg-primary/20 text-primary"
                        : "border border-border bg-surface-2 text-muted-foreground"
                    )}
                  >
                    {getInitials(agent.nome) || <Bot className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3
                        className={cn(
                          "truncate text-sm font-medium",
                          active ? "text-foreground" : "text-foreground"
                        )}
                      >
                        {agent.nome}
                      </h3>

                      {time ? (
                        <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">
                          {time}
                        </span>
                      ) : agent.last_conversation_id ? null : (
                        <span className="shrink-0 font-mono text-[11px] text-primary">
                          novo
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground"
                      )}
                    >
                      {agent.last_message_preview ||
                        agent.descricao ||
                        "Pronto para iniciar uma conversa."}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
