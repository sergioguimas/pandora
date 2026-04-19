"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: string;
  titulo: string | null;
  updated_at: string;
};

type AgentConversationsListProps = {
  agentSlug: string;
  conversations: ConversationItem[];
  selectedConversationId?: string | null;
};

export function AgentConversationsList({
  agentSlug,
  conversations,
  selectedConversationId,
}: AgentConversationsListProps) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
        Nenhuma conversa criada ainda para este agente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => {
        const active = selectedConversationId === conversation.id;

        return (
          <Link
            key={conversation.id}
            href={`/chat/${agentSlug}?conversation=${conversation.id}`}
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 transition",
              active
                ? "border-primary/30 bg-primary/10"
                : "border-border/60 bg-card/50 hover:bg-accent"
            )}
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {conversation.titulo || "Conversa sem título"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Atualizada{" "}
                {formatDistanceToNow(new Date(conversation.updated_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}