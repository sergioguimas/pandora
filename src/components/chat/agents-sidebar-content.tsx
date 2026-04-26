"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, Clock3, MessageSquare, Settings2 } from "lucide-react";
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
    <aside className="flex h-full w-full flex-col bg-[#020817] text-white">
      <div className="border-b border-white/10 px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
              Pandora
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Agentes</h1>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Selecione um agente para retomar ou iniciar uma conversa.
            </p>
          </div>

          <Link
            href="/agentes"
            onClick={onNavigate}
            aria-label="Configurar agentes"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-2 text-white/55">
              <Bot className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Ativos
              </span>
            </div>
            <p className="mt-1 text-lg font-black">{agents.length}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-2 text-white/55">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Recentes
              </span>
            </div>
            <p className="mt-1 text-lg font-black">{agentsWithHistory.length}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          {agents.map((agent) => {
            const active = activeSlug === agent.slug;
            const time = formatLastMessageTime(agent.last_message_at);
            const label =
              agent.category ||
              (agent.tags.length > 0 ? agent.tags[0] : null) ||
              "Agente";

            return (
              <Link
                key={agent.id}
                href={buildAgentHref(agent)}
                onClick={onNavigate}
                className={cn(
                  "group block rounded-lg border px-3 py-3 transition",
                  active
                    ? "border-white/20 bg-white/[0.09]"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-black",
                      active
                        ? "border-white bg-white text-[#020817]"
                        : "border-white/10 bg-white/8 text-white"
                    )}
                  >
                    {getInitials(agent.nome) || <Bot className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-white">
                          {agent.nome}
                        </h3>
                        <p className="mt-0.5 truncate text-xs font-medium text-emerald-100/55">
                          {label}
                        </p>
                      </div>

                      {time ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-white/50">
                          <Clock3 className="h-3 w-3" />
                          {time}
                        </span>
                      ) : null}
                    </div>

                    <p
                      className={cn(
                        "mt-2 line-clamp-2 text-xs leading-5",
                        agent.last_message_preview
                          ? "text-white/68"
                          : "text-white/42"
                      )}
                    >
                      {agent.last_message_preview ||
                        agent.descricao ||
                        "Pronto para iniciar uma nova conversa."}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                          agent.last_conversation_id
                            ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.03] text-white/45"
                        )}
                      >
                        {agent.last_conversation_id ? "Retomar" : "Novo"}
                      </span>

                      {agent.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="truncate rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-white/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
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
