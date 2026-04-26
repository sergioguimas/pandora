"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, Home, MessageSquare, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { CreateConversationButton } from "@/components/chat/create-conversation-button";
import { AgentConversationsList } from "@/components/chat/agent-conversations-list";
import { ShareConversationPanel } from "@/components/chat/share-conversation-panel";
import { ConversationAgentsPanel } from "@/components/chat/conversation-agents-panel";
import type { Agent } from "@/types/database";

type Tab = "conversas" | "equipe" | "agentes";

type ConversationItem = {
  id: string;
  titulo: string | null;
  updated_at: string;
  role: "owner" | "member";
};

type MemberItem = {
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ParticipantItem = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
  nome: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ConversationAgentItem = Pick<
  Agent,
  "id" | "nome" | "descricao"
> & {
  ordem?: number;
  conversation_agent_id?: string;
};

type ChatSidePanelProps = {
  agentSlug: string;
  agentName: string;
  conversationId: string;
  currentUserId: string;
  isOwner: boolean;
  conversations: ConversationItem[];
  members: MemberItem[];
  participants: ParticipantItem[];
  conversationAgents: ConversationAgentItem[];
  availableAgents: ConversationAgentItem[];
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
    <aside className="hidden w-[380px] shrink-0 border-r border-white/10 bg-[#020817] text-white lg:flex lg:flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-sm font-black">
            {getInitials(agentName) || <Bot className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
              Conversa ativa
            </p>
            <h2 className="mt-1 truncate text-lg font-bold tracking-tight">
              {agentName}
            </h2>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Organize conversas, equipe e agentes da rodada.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <CreateConversationButton agentSlug={agentSlug} />

          <Link
            href="/chat"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Home className="h-4 w-4" />
            Início
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 rounded-lg border border-white/10 bg-white/[0.04] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold transition",
                  active
                    ? "bg-white text-[#020817] shadow-sm"
                    : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
