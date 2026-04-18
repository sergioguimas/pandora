import { getActiveAgents } from "@/server/repositories/agents-repository";

export default async function ChatPage() {
  const agents = await getActiveAgents();

  return (
    <main className="flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="w-full max-w-sm border-r border-zinc-800 bg-zinc-900/80">
        <div className="border-b border-zinc-800 px-4 py-4">
          <h1 className="text-lg font-semibold">Pandora</h1>
          <p className="text-sm text-zinc-400">
            Seus agentes disponíveis
          </p>
        </div>

        <div className="flex flex-col">
          {agents.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400">
              Nenhum agente disponível.
            </div>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                className="flex w-full items-start gap-3 border-b border-zinc-800 px-4 py-4 text-left transition hover:bg-zinc-800/60"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold">
                  {agent.nome.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{agent.nome}</p>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                    {agent.descricao ?? "Sem descrição."}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

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