import { notFound } from "next/navigation";
import { AgentsSidebar } from "@/components/chat/agents-sidebar";
import { ChatHeaderActions } from "@/components/chat/chat-header-actions";
import { ChatPanel } from "@/components/chat/chat-panel";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  getActiveAgents,
  getAgentBySlug,
} from "@/server/repositories/agents-repository";
import { getOrCreateConversationByAgentSlug } from "@/server/repositories/conversations-repository";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";

type ChatAgentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ChatAgentPage({
  params,
}: ChatAgentPageProps) {
  const { slug } = await params;
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const [agents, agent] = await Promise.all([
    getActiveAgents(user.id),
    getAgentBySlug(slug),
  ]);

  if (!agent) {
    notFound();
  }

  const conversation = await getOrCreateConversationByAgentSlug(user.id, slug);
  const messages = await getMessagesByConversationId(conversation.id);

  return (
    <main className="flex h-screen bg-background text-foreground">
      <AgentsSidebar agents={agents} activeSlug={agent.slug} />

      <section className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_30%)]" />

        <header className="relative z-10 border-b border-border/60 bg-card/60 px-4 py-4 backdrop-blur-2xl md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 pl-14 md:pl-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-foreground ring-1 ring-border shadow-sm md:flex">
                  {agent.nome.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {agent.nome}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {agent.descricao ?? "Agente ativo"}
                  </p>
                </div>
              </div>
            </div>

            <ChatHeaderActions />
          </div>
        </header>

        <ChatPanel
          messages={messages}
          agentName={agent.nome}
          conversationId={conversation.id}
          redirectPath={`/chat/${agent.slug}`}
        />
      </section>
    </main>
  );
}