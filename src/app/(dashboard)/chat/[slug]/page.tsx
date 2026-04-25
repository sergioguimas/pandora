import Link from "next/link";
import { Home } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getAgentBySlug,
  getAllAgents,
} from "@/server/repositories/agents-repository";

import {
  createConversationForAgent,
  getConversationWithAgent,
  listUserConversationsWithRole,
} from "@/server/repositories/conversations-repository";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";
import { listOrganizationMembersForUser } from "@/server/repositories/organization-members-repository";
import {
  isConversationOwner,
  listConversationParticipants,
} from "@/server/repositories/conversation-participants-repository";

import { ChatPanel } from "@/components/chat/chat-panel";
import { CreateConversationButton } from "@/components/chat/create-conversation-button";
import { AgentConversationsList } from "@/components/chat/agent-conversations-list";
import { RenameConversationForm } from "@/components/chat/rename-conversation-form";
import { ShareConversationPanel } from "@/components/chat/share-conversation-panel";
import { ConversationAgentsPanel } from "@/components/chat/conversation-agents-panel";
import { listAgentsByConversation } from "@/server/repositories/conversation-agents-repository";

type ChatAgentPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    conversation?: string;
  }>;
};

export default async function ChatAgentPage({
  params,
  searchParams,
}: ChatAgentPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const agent = await getAgentBySlug(slug);

  if (!agent) {
    notFound();
  }

  const conversations = await listUserConversationsWithRole(
    user.id,
    agent.id
  );
  const conversationFromUrl = search?.conversation ?? null;

  let selectedConversationId: string;

  if (conversationFromUrl) {
    selectedConversationId = conversationFromUrl;
  } else if (conversations.length > 0) {
    selectedConversationId = conversations[0].id;
    redirect(`/chat/${slug}?conversation=${selectedConversationId}`);
  } else {
    const createdConversation = await createConversationForAgent(user.id, slug);
    redirect(`/chat/${slug}?conversation=${createdConversation.id}`);
  }

  const conversation = await getConversationWithAgent(
    selectedConversationId,
    user.id
  );

  if (conversation.agent_id !== agent.id) {
    notFound();
  }

  const messages = await getMessagesByConversationId(conversation.id);

  const members = await listOrganizationMembersForUser(user.id);
  const participants = await listConversationParticipants(conversation.id);
  const agentsDaConversa = await listAgentsByConversation(conversation.id);
  const owner = await isConversationOwner({
    conversationId: conversation.id,
    userId: user.id,
  });

  const userProfiles = participants.map((participant) => ({
    id: participant.user_id,
    nome: participant.nome,
    email: participant.email,
    avatar_url: participant.avatar_url,
  }));

  const todosAgents = await getAllAgents();

  const agentesFinal =
  agentsDaConversa.length > 0
    ? agentsDaConversa
    : [
        {
          conversation_agent_id: `principal-${agent.id}`,
          ordem: 1,
          id: agent.id,
          nome: agent.nome,
          descricao: agent.descricao,
          prompt_base: agent.prompt_base,
          provider: agent.provider,
          model: agent.model,
          temperature: agent.temperature,
          max_history_messages: agent.max_history_messages,
        },
      ];

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-[360px] shrink-0 border-r border-border/60 bg-card/30 lg:flex lg:flex-col">
        <div className="space-y-4 border-b border-border/60 p-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {agent.nome}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie contextos diferentes com conversas separadas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CreateConversationButton agentSlug={agent.slug} />

            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              Voltar
            </Link>
          </div>

          <ShareConversationPanel
            conversationId={conversation.id}
            agentSlug={agent.slug}
            currentUserId={user.id}
            members={members}
            participants={participants}
            isOwner={owner}
          />
          <ConversationAgentsPanel
            conversationId={conversation.id}
            agentSlug={agent.slug}
            agents={agentesFinal}
            availableAgents={todosAgents}
            isOwner={owner}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <AgentConversationsList
            agentSlug={agent.slug}
            conversations={conversations}
            selectedConversationId={conversation.id}
          />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border/60 bg-card/40 px-4 py-4 backdrop-blur-xl md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/chat"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Home className="h-4 w-4" />
              </Link>

              <div className="min-w-0">
                <RenameConversationForm
                  conversationId={conversation.id}
                  agentSlug={agent.slug}
                  initialTitle={conversation.titulo || agent.nome}
                  isOwner={owner}
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Conversando com {agent.nome}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <CreateConversationButton agentSlug={agent.slug} />

              <ShareConversationPanel
                conversationId={conversation.id}
                agentSlug={agent.slug}
                currentUserId={user.id}
                members={members}
                participants={participants}
                isOwner={owner}
              />
              <ConversationAgentsPanel
                conversationId={conversation.id}
                agentSlug={agent.slug}
                agents={agentesFinal}
                availableAgents={todosAgents}
                isOwner={owner}
              />
            </div>
          </div>
        </header>

        <ChatPanel
          messages={messages}
          agentName={agent.nome}
          conversationId={conversation.id}
          redirectPath={`/chat/${agent.slug}?conversation=${conversation.id}`}
          currentUserId={user.id}
          userProfiles={userProfiles}
        />
        
      </section>
    </main>
  );
}