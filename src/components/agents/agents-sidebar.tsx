import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/database";

type AgentsSidebarProps = {
  agents: Agent[];
  selectedSlug?: string;
};

export function AgentsSidebar({
  agents,
  selectedSlug,
}: AgentsSidebarProps) {
  return (
    <aside className="w-full max-w-sm border-r border-border bg-card">
      <div className="border-b border-border px-5 py-5">
        <p className="text-sm font-medium text-primary">Configuração</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Agentes
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Selecione um agente para editar descrição e prompt base.
        </p>
      </div>

      <div className="flex flex-col">
        {agents.map((agent) => {
          const isActive = agent.slug === selectedSlug;

          return (
            <Link
              key={agent.id}
              href={`/agentes?slug=${agent.slug}`}
              className={cn(
                "flex items-start gap-3 border-b border-border px-5 py-4 transition hover:bg-accent",
                isActive && "bg-accent"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ring-1",
                  isActive
                    ? "bg-primary/15 text-primary ring-primary/20"
                    : "bg-secondary text-foreground ring-border"
                )}
              >
                {agent.nome.slice(0, 2).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {agent.nome}
                  </p>

                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      agent.ativo ? "bg-emerald-500" : "bg-zinc-400"
                    )}
                  />
                </div>

                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {agent.descricao ?? "Sem descrição."}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}