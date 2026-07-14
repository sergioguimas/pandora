"use client";

import Link from "next/link";
import { Bot, Cpu, ShieldAlert, ShieldCheck, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/database";

type AgentsSidebarProps = {
  agents: Agent[];
  selectedSlug?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AgentsSidebar({ agents, selectedSlug }: AgentsSidebarProps) {
  const activeCount = agents.filter((agent) => agent.ativo).length;

  return (
    <aside className="hidden h-full w-full max-w-[320px] flex-col border-r border-border bg-surface-1 text-foreground md:flex lg:max-w-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight">Agentes</h1>
          <span className="font-mono text-xs text-subtle-foreground">
            {agents.length} · {activeCount} ativos
          </span>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground">
          <Settings2 className="h-4 w-4" />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {agents.map((agent) => {
          const isActive = agent.slug === selectedSlug;

          return (
            <Link
              key={agent.id}
              href={`/agentes?slug=${agent.slug}`}
              className={cn(
                "group relative block rounded-md px-2 py-2.5 transition-colors",
                isActive ? "bg-primary-soft" : "hover:bg-surface-2"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "border border-border bg-surface-2 text-muted-foreground"
                  )}
                >
                  {getInitials(agent.nome) || <Bot className="h-4 w-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {agent.nome}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {agent.category || "agente"}
                      </p>
                    </div>

                    {agent.ativo ? (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 shrink-0 text-subtle-foreground" />
                    )}
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {agent.descricao ||
                      "Nenhuma descrição definida para este agente."}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-subtle-foreground">
                    <Cpu className="h-3 w-3" />
                    <span className="truncate">{agent.model || "modelo padrão"}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
