import { AgentsSidebar } from "@/components/chat/agents-sidebar";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getActiveAgents } from "@/server/repositories/agents-repository";

export default async function ChatPage() {
  const user = await getCurrentUser();
  const agents = await getActiveAgents(user?.id);

  return (
    <main className="flex h-screen bg-background text-foreground">
      <AgentsSidebar agents={agents} />

      <section className="relative hidden flex-1 items-center justify-center overflow-hidden md:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_30%)]" />

        <div className="relative z-10 max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-lg font-semibold text-primary ring-1 ring-primary/20">
            PA
          </div>

          <h2 className="text-3xl font-semibold tracking-tight">
            Bem-vindo à Pandora
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Selecione um agente na lateral para iniciar uma conversa, consultar
            informações e centralizar sua rotina operacional em um único lugar.
          </p>
        </div>
      </section>
    </main>
  );
}