"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/database";
import { Settings2, Cpu, ShieldCheck, ShieldAlert } from "lucide-react";

type AgentsSidebarProps = {
  agents: Agent[];
  selectedSlug?: string;
};

export function AgentsSidebar({
  agents,
  selectedSlug,
}: AgentsSidebarProps) {
  return (
    <aside className="w-full max-w-[320px] lg:max-w-sm border-r border-border/50 bg-card/30 backdrop-blur-xl flex flex-col h-full shadow-2xl">
      {/* Header do Painel Administrativo */}
      <div className="px-6 py-8 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-4 w-4" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80">
            Painel de Controle
          </p>
        </div>
        
        <h1 className="text-2xl font-black tracking-tighter text-foreground">
          Agentes
        </h1>
        <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground/80">
          Gerencie o comportamento, as permissões e a identidade das inteligências disponíveis.
        </p>
      </div>

      {/* Lista de Agentes para Edição */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar">
        {agents.map((agent) => {
          const isActive = agent.slug === selectedSlug;

          return (
            <Link
              key={agent.id}
              href={`/agentes?slug=${agent.slug}`}
              className={cn(
                "group relative flex items-start gap-4 rounded-2xl px-4 py-5 transition-all duration-300",
                "hover:bg-accent/50",
                isActive 
                  ? "bg-primary/10 shadow-sm ring-1 ring-primary/20" 
                  : "bg-transparent border border-transparent"
              )}
            >
              {/* Avatar Dinâmico */}
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-all duration-500 shadow-inner",
                  isActive
                    ? "bg-primary text-primary-foreground rotate-3 scale-110 shadow-lg shadow-primary/20"
                    : "bg-secondary text-muted-foreground group-hover:bg-background group-hover:text-primary group-hover:-rotate-2"
                )}
              >
                {agent.nome.slice(0, 2).toUpperCase()}
              </div>

              {/* Informações do Agente */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className={cn(
                    "truncate text-sm font-bold tracking-tight transition-colors",
                    isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                  )}>
                    {agent.nome}
                  </p>

                  {/* Indicador de Status Refinado */}
                  <div className="flex items-center">
                    {agent.ativo ? (
                      <ShieldCheck className={cn(
                        "h-4 w-4 transition-all",
                        isActive ? "text-primary animate-pulse" : "text-emerald-500/50 group-hover:text-emerald-500"
                      )} />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-zinc-400/50 group-hover:text-zinc-500" />
                    )}
                  </div>
                </div>

                <p className={cn(
                  "line-clamp-2 text-[13px] font-medium leading-snug transition-colors",
                  isActive ? "text-primary/70" : "text-muted-foreground group-hover:text-muted-foreground/80"
                )}>
                  {agent.descricao ?? "Nenhuma descrição técnica definida para este agente."}
                </p>
                
                {/* Badge de Modelo (Opcional, mas corporativo) */}
                <div className="mt-3 flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
                    {agent.model || "Default Model"}
                  </span>
                </div>
              </div>

              {/* Indicador Lateral Ativo */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary rounded-r-full shadow-[2px_0_10px_rgba(16,185,129,0.5)]" />
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}