"use client";

import Link from "next/link";
import { useState } from "react";
import { Home, MessageSquare, Users, Bot } from "lucide-react";

import { cn } from "@/lib/utils";
import { CreateConversationButton } from "@/components/chat/create-conversation-button";
import { AgentConversationsList } from "@/components/chat/agent-conversations-list";
import { ShareConversationPanel } from "@/components/chat/share-conversation-panel";
import { ConversationAgentsPanel } from "@/components/chat/conversation-agents-panel";

type Tab = "conversas" | "equipe" | "agentes";

type ChatSidePanelProps = {
  agentSlug: string;
  agentName: string;
  conversationId: string;
  currentUserId: string;
  isOwner: boolean;
  conversations: any[];
  members: any[];
  participants: any[];
  conversationAgents: any[];
  availableAgents: any[];
};

const tabs: Array<{
  id: Tab;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { id: "conversas", label: "Conversas", icon: MessageSquare },
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "agentes", label: "Agentes", icon: Bot },
];

export function ChatSidePanel({
  agentSlug,
  agentName,
  conversationId,
  currentUserId,
  isOwner,
  conversations,
  members,
  participants,
  conversationAgents,
  availableAgents,
}: ChatSidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("conversas");

  return (
    <aside className="hidden w-[380px] shrink-0 border-r border-border/60 bg-card/30 lg:flex lg:flex-col">
      <div className="border-b border-border/60 p-4">
        <div>
          <h2 className="truncate text-base font-semibold text-foreground">
            {agentName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize conversas, equipe e agentes.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <CreateConversationButton agentSlug={agentSlug} />

          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            Voltar
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 rounded-2xl border border-border/60 bg-background/60 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "conversas" ? (
          <AgentConversationsList
            agentSlug={agentSlug}
            conversations={conversations}
            selectedConversationId={conversationId}
          />
        ) : null}

        {activeTab === "equipe" ? (
          <ShareConversationPanel
            conversationId={conversationId}
            agentSlug={agentSlug}
            currentUserId={currentUserId}
            members={members}
            participants={participants}
            isOwner={isOwner}
          />
        ) : null}

        {activeTab === "agentes" ? (
          <ConversationAgentsPanel
            conversationId={conversationId}
            agentSlug={agentSlug}
            agents={conversationAgents}
            availableAgents={availableAgents}
            isOwner={isOwner}
          />
        ) : null}
      </div>
    </aside>
  );
}