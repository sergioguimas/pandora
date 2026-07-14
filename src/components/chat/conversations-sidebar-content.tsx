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
        <div className="mb-4 rounded-md border border-border bg-surface-2 p-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhuma conversa</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Crie uma nova conversa para começar.
        </p>
      </div>
    );
  }

  const groupCount = conversations.filter(
    (conversation) => conversation.agents.length > 1
  ).length;

  return (
    <aside className="flex h-full w-full flex-col text-foreground">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Conversas</h2>
          <span className="font-mono text-xs text-subtle-foreground">
            {conversations.length} · {groupCount} grupos
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
          {conversations.map((conversation) => {
            const time = formatTime(conversation.updated_at);
            const title =
              conversation.titulo ||
              `Conversa com ${conversation.primaryAgent.nome}`;
            const isGroup = conversation.agents.length > 1;

            return (
              <Link
                key={conversation.id}
                href={conversation.href}
                onClick={onNavigate}
                className="group block rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-xs font-semibold text-muted-foreground">
                    {isGroup ? (
                      <UsersRound className="h-4 w-4" />
                    ) : (
                      getInitials(conversation.primaryAgent.nome)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate text-sm font-medium text-foreground">
                        {title}
                      </h3>

                      {time ? (
                        <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">
                          {time}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">
                      {isGroup
                        ? conversation.agents
                            .map((agent) => agent.nome)
                            .join(", ")
                        : conversation.primaryAgent.nome}
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