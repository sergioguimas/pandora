import { notFound } from "next/navigation";
import { AgentsSidebar } from "@/components/chat/agents-sidebar";
import {
  getActiveAgents,
  getAgentBySlug,
} from "@/server/repositories/agents-repository";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getOrCreateConversationByAgentSlug } from "@/server/repositories/conversations-repository";
import { getMessagesByConversationId } from "@/server/repositories/messages-repository";
import { sendMessage } from "@/server/actions/chat-actions";
import { ChatHeaderActions } from "@/components/chat/chat-header-actions";

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
    getActiveAgents(),
    getAgentBySlug(slug),
  ]);

  if (!agent) {
    notFound();
  }

  const conversation = await getOrCreateConversationByAgentSlug(user.id, slug);
  const messages = await getMessagesByConversationId(conversation.id);

  return (
    <main className="flex h-screen bg-zinc-950 text-zinc-100">
      <AgentsSidebar agents={agents} activeSlug={agent.slug} />

      <section className="flex flex-1 flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900/60 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-zinc-100">
                    {agent.nome.slice(0, 2).toUpperCase()}
                </div>

                <div>
                    <h2 className="font-semibold text-zinc-100">{agent.nome}</h2>
                    <p className="text-sm text-zinc-400">
                    {agent.descricao ?? "Agente ativo"}
                    </p>
                </div>
                </div>

                <ChatHeaderActions />
            </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.length === 0 ? (
              <div className="self-start rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-3 text-sm text-zinc-100">
                Olá! Esta é o início da sua conversa com {agent.nome}.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "max-w-[80%] self-end rounded-2xl rounded-br-md bg-emerald-600 px-4 py-3 text-sm break-words text-white"
                      : "max-w-[80%] self-start rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-3 text-sm break-words text-zinc-100"
                  }
                >
                  {message.content}
                </div>
              ))
            )}
          </div>
        </div>

        <footer className="border-t border-zinc-800 bg-zinc-900/60 px-6 py-4">
          <form
            action={sendMessage}
            className="mx-auto flex max-w-3xl items-end gap-3"
          >
            <input type="hidden" name="conversationId" value={conversation.id} />
            <input type="hidden" name="redirectPath" value={`/chat/${agent.slug}`} />

            <textarea
              name="content"
              placeholder={`Mensagem para ${agent.nome}...`}
              className="min-h-[52px] flex-1 resize-none rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              required
            />

            <button className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500">
              Enviar
            </button>
          </form>
        </footer>
      </section>
    </main>
  );
}