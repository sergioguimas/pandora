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
      <div className="space-y-2">
        <p className="px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
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
                "group flex items-start gap-3 rounded-lg border px-3 py-3 transition",
                isActive
                  ? "border-white/20 bg-white/[0.09]"
                  : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                  isActive
                    ? "border-white bg-white text-[#020817]"
                    : "border-white/10 bg-white/[0.04] text-white/60"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-bold text-white">
                    {conversation.titulo || "Sem titulo"}
                  </p>

                  {time ? (
                    <span className="shrink-0 text-[11px] font-bold text-white/45">
                      {time}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs font-medium text-white/45">
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
    <div className="space-y-6">
      {renderList("Minhas conversas", own)}
      {renderList("Compartilhadas", shared)}

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
          <MessageSquare className="mx-auto h-6 w-6 text-white/35" />
          <p className="mt-3 text-sm font-semibold text-white">
            Nenhuma conversa ainda
          </p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Crie uma nova conversa para começar com este agente.
          </p>
        </div>
      ) : null}
    </div>
  );
}
