"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Settings2, UsersRound } from "lucide-react";
import type { ConversationSidebarItem } from "@/components/chat/agents-sidebar";

type ConversationsSidebarContentProps = {
  conversations: ConversationSidebarItem[];
  onNavigate?: () => void;
};

function formatTime(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return format(date, "dd/MM HH:mm", { locale: ptBR });
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ConversationsSidebarContent({
  conversations,
  onNavigate,
}: ConversationsSidebarContentProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 rounded-full border border-white/10 bg-white/5 p-3">
          <MessageSquare className="h-6 w-6 text-white/35" />
        </div>
        <p className="text-sm font-medium text-white">Nenhuma conversa</p>
        <p className="mt-1 text-xs text-white/50">
          Crie uma nova conversa para começar.
        </p>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-[#020817] text-white">
        <div className="border-b border-white/10 px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                Pandora
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Conversas</h1>
            <p className="mt-1 text-xs leading-5 text-white/55">
                Retome conversas individuais ou com múltiplos agentes.
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
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                Conversas
                </span>
            </div>
            <p className="mt-1 text-lg font-black">{conversations.length}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-2 text-white/55">
                <UsersRound className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                Grupos
                </span>
            </div>
            <p className="mt-1 text-lg font-black">
                {conversations.filter((conversation) => conversation.agents.length > 1).length}
            </p>
            </div>
        </div>
        </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          {conversations.map((conversation) => {
            const time = formatTime(conversation.updated_at);
            const title =
              conversation.titulo || `Conversa com ${conversation.primaryAgent.nome}`;
            const isGroup = conversation.agents.length > 1;

            return (
              <Link
                key={conversation.id}
                href={conversation.href}
                onClick={onNavigate}
                className="group block rounded-lg border border-transparent px-3 py-3 transition hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-xs font-black text-white">
                    {isGroup ? (
                      <UsersRound className="h-4 w-4" />
                    ) : (
                      getInitials(conversation.primaryAgent.nome)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-white">
                          {title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs font-medium text-emerald-100/55">
                          {conversation.agents.length > 1
                            ? `${conversation.agents.length} agentes`
                            : conversation.primaryAgent.nome}
                        </p>
                      </div>

                      {time ? (
                        <span className="shrink-0 text-[11px] font-bold text-white/45">
                          {time}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 line-clamp-1 text-xs leading-5 text-white/50">
                      {conversation.agents.map((agent) => agent.nome).join(", ")}
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