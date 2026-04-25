"use client";

import Link from "next/link";
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

export function AgentConversationsList({
  agentSlug,
  conversations,
  selectedConversationId,
}: Props) {
  const own = conversations.filter((c) => c.role === "owner");
  const shared = conversations.filter((c) => c.role === "member");

  function renderList(title: string, items: ConversationItem[]) {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>

        {items.map((conversation) => {
          const isActive = conversation.id === selectedConversationId;

          return (
            <Link
              key={conversation.id}
              href={`/chat/${agentSlug}?conversation=${conversation.id}`}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              <span>
                {conversation.role === "owner" ? "👤" : "👥"}
                <span className="text-[10px] opacity-70">
                  {conversation.role === "owner" ? "Você" : "Equipe"}
                </span>
              </span>

              <span className="truncate">
                {conversation.titulo || "Sem título"}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderList("Minhas Conversas", own)}
      {renderList("Compartilhadas", shared)}
    </div>
  );
}