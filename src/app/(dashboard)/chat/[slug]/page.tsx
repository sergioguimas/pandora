import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentBySlug } from "@/server/repositories/agents-repository";
import {
  createConversationForAgent,
  getConversationWithAgent,
  listUserConversationsByAgent,
} from "@/server/repositories/conversations-repository";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CreateConversationButton } from "@/components/chat/create-conversation-button";
import { AgentConversationsList } from "@/components/chat/agent-conversations-list";
import { RenameConversationForm } from "@/components/chat/rename-conversation-form";
import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const conversations = await listUserConversationsByAgent(user.id, agent.id);

  let selectedConversationId = search?.conversation ?? null;

  if (!selectedConversationId) {
    if (conversations.length > 0) {
      selectedConversationId = conversations[0].id;
      redirect(`/chat/${slug}?conversation=${selectedConversationId}`);
    }

    const createdConversation = await createConversationForAgent(user.id, slug);
    redirect(`/chat/${slug}?conversation=${createdConversation.id}`);
  }

  const conversation = await getConversationWithAgent(
    selectedConversationId,
    user.id
  );

  const messages = await getMessagesByConversationId(conversation.id);

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
          <div className="flex items-center justify-around">
            <CreateConversationButton agentSlug={agent.slug} />
            <Link
                href="/chat"
                className={cn(
                  "group flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-bold transition-all",
                  "text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95"
                )}
              >
                <Home className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Voltar ao Chat
              </Link>
          </div>
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
            <div className="min-w-0">
              <RenameConversationForm
                conversationId={conversation.id}
                agentSlug={agent.slug}
                initialTitle={conversation.titulo || agent.nome}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Conversando com {agent.nome}
              </p>
            </div>

            <div className="lg:hidden">
              <CreateConversationButton agentSlug={agent.slug} />
            </div>
          </div>
        </header>

        <ChatPanel
          messages={messages}
          agentName={agent.nome}
          conversationId={conversation.id}
          redirectPath={`/chat/${agent.slug}?conversation=${conversation.id}`}
        />
      </section>
    </main>
  );
}