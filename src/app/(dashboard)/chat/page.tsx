import { AgentsSidebar } from "@/components/chat/agents-sidebar";
import { getActiveAgents } from "@/server/repositories/agents-repository";

export default async function ChatPage() {
  const agents = await getActiveAgents();

  return (
    <main className="flex h-screen bg-zinc-950 text-zinc-100">
      <AgentsSidebar agents={agents} />

      <section className="hidden flex-1 items-center justify-center md:flex">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-semibold">Pandora</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Selecione um agente para iniciar uma conversa.
          </p>
        </div>
      </section>
    </main>
  );
}