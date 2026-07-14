"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: string;
  titulo: string | null;
  updated_at: string;
  role: "owner" | "member";
};

type Props = {
  agentSlug: string;
  conversations: ConversationItem[];
  selectedConversationId?: string;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return format(date, "HH:mm", { locale: ptBR });
}

export function AgentConversationsList({
  agentSlug,
  conversations,
  selectedConversationId,
}: Props) {
  const own = conversations.filter((conversation) => conversation.role === "owner");
  const shared = conversations.filter(
    (conversation) => conversation.role === "member"
  );

  function renderList(title: string, items: ConversationItem[]) {
    if (items.length === 0) return null;

    return (
      <div className="space-y-1">
        <p className="px-1 pb-1 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">
          {title}
        </p>

        {items.map((conversation) => {
          const isActive = conversation.id === selectedConversationId;
          const Icon = conversation.role === "owner" ? MessageSquare : Users;
          const time = formatUpdatedAt(conversation.updated_at);

          return (
            <Link
              key={conversation.id}
              href={`/chat/${agentSlug}?conversation=${conversation.id}`}
              className={cn(
                "group flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors",
                isActive ? "bg-primary-soft" : "hover:bg-surface-2"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                  isActive
                    ? "border-primary/30 bg-primary/15 text-primary"
                    : "border-border bg-surface-2 text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {conversation.titulo || "Sem título"}
                  </p>

                  {time ? (
                    <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">
                      {time}
                    </span>
                  ) : null}
                </div>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  {conversation.role === "owner" ? "Sua conversa" : "Compartilhada"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {renderList("Minhas conversas", own)}
      {renderList("Compartilhadas", shared)}

      {conversations.length === 0 ? (
        <div className="rounded-md border border-border bg-surface-2 px-4 py-8 text-center">
          <MessageSquare className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Nenhuma conversa ainda
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Crie uma nova conversa para começar com este agente.
          </p>
        </div>
      ) : null}
    </div>
  );
}
