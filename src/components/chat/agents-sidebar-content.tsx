"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SlidersHorizontal } from "lucide-react";
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
  return (
    <aside className="flex h-full w-full flex-col bg-[#020817] text-white">
      <div className="border-b border-white/10 px-7 pb-6 pt-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold tracking-tight">
              Conversas
            </h1>
            <p className="mt-1 text-[12px] text-white/55">
              Acesse agentes e retome o último contexto.
            </p>
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {agents.length} agentes
          </span>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-6">
          <div className="space-y-1">
            <h2 className="text-[20px] font-black tracking-tight">
              Pandora <span className="text-white/70">✦</span>
            </h2>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
              Intelligence Hub
            </p>
          </div>

          <Link
            href="/agentes"
            onClick={onNavigate}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Configurar Agentes
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-2">
          {agents.map((agent) => {
            const active = activeSlug === agent.slug;
            const time = formatLastMessageTime(agent.last_message_at);
            const conversationTitle =
              agent.last_conversation_title ||
              agent.descricao ||
              "Nenhuma conversa ainda";

            return (
              <Link
                key={agent.id}
                href={buildAgentHref(agent)}
                onClick={onNavigate}
                className={cn(
                  "group flex items-start gap-4 rounded-2xl px-3 py-3 transition",
                  active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                    active
                      ? "bg-white text-[#020817]"
                      : "bg-white/8 text-white"
                  )}
                >
                  {getInitials(agent.nome)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold text-white">
                        {agent.nome}
                      </h3>

                      <p className="mt-0.5 truncate text-[12px] font-medium text-white/55">
                        {conversationTitle}
                      </p>
                    </div>

                    {time ? (
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-bold",
                          active ? "text-white/85" : "text-white/55"
                        )}
                      >
                        {time}
                      </span>
                    ) : null}
                  </div>

                  {agent.last_message_preview ? (
                    <p
                      className={cn(
                        "mt-1.5 truncate text-[13px] leading-5",
                        active ? "text-white/80" : "text-white/65"
                      )}
                    >
                      {agent.last_message_preview}
                    </p>
                  ) : (
                    <p className="mt-1.5 truncate text-[13px] leading-5 text-white/35">
                      Nenhuma conversa iniciada ainda.
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}