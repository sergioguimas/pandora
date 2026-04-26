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
    <aside className="hidden h-full w-full max-w-[320px] flex-col border-r border-white/10 bg-[#020817] text-white shadow-2xl md:flex lg:max-w-sm">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
              Controle
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Agentes</h1>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Configure identidade, prompts e conhecimento dos especialistas.
            </p>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/75">
            <Settings2 className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              Total
            </p>
            <p className="mt-1 text-lg font-black">{agents.length}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              Ativos
            </p>
            <p className="mt-1 text-lg font-black">{activeCount}</p>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {agents.map((agent) => {
          const isActive = agent.slug === selectedSlug;

          return (
            <Link
              key={agent.id}
              href={`/agentes?slug=${agent.slug}`}
              className={cn(
                "group relative block rounded-lg border px-3 py-3 transition",
                isActive
                  ? "border-white/20 bg-white/[0.09]"
                  : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-black transition",
                    isActive
                      ? "border-white bg-white text-[#020817]"
                      : "border-white/10 bg-white/[0.04] text-white"
                  )}
                >
                  {getInitials(agent.nome) || <Bot className="h-4 w-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {agent.nome}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium text-emerald-100/55">
                        {agent.category || "Agente"}
                      </p>
                    </div>

                    {agent.ativo ? (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-200/75" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 shrink-0 text-white/30" />
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45">
                    {agent.descricao ||
                      "Nenhuma descrição técnica definida para este agente."}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                    <Cpu className="h-3 w-3" />
                    <span className="truncate">{agent.model || "Modelo padrão"}</span>
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
