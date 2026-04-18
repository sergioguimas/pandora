import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/database";

type AgentsSidebarProps = {
  agents: Agent[];
  activeSlug?: string;
};

export function AgentsSidebar({
  agents,
  activeSlug,
}: AgentsSidebarProps) {
  return (
    <aside className="w-full max-w-sm border-r border-zinc-800 bg-zinc-900/80">
      <div className="border-b border-zinc-800 px-4 py-4">
        <h1 className="text-lg font-semibold text-zinc-100">Pandora</h1>
        <p className="text-sm text-zinc-400">Seus agentes disponíveis</p>
      </div>

      <div className="flex flex-col">
        {agents.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-400">
            Nenhum agente disponível.
          </div>
        ) : (
          agents.map((agent) => {
            const isActive = activeSlug === agent.slug;

            return (
              <Link
                key={agent.id}
                href={`/chat/${agent.slug}`}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-zinc-800 px-4 py-4 text-left transition hover:bg-zinc-800/60",
                  isActive && "bg-zinc-800/80"
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-zinc-100">
                  {agent.nome.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-zinc-100">
                      {agent.nome}
                    </p>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                    {agent.descricao ?? "Sem descrição."}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}