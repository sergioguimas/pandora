import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AgentListItem } from "@/types/database";

type AgentsSidebarContentProps = {
  agents: AgentListItem[];
  activeSlug?: string;
  onNavigate?: () => void;
};

export function AgentsSidebarContent({
  agents,
  activeSlug,
  onNavigate,
}: AgentsSidebarContentProps) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-border/60 px-5 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Pandora
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus agentes disponíveis
        </p>
      </div>

      <div className="flex flex-col">
        {agents.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Nenhum agente disponível.
          </div>
        ) : (
          agents.map((agent) => {
            const isActive = activeSlug === agent.slug;

            return (
              <Link
                key={agent.id}
                href={`/chat/${agent.slug}`}
                onClick={onNavigate}
                className={cn(
                  "group relative flex w-full items-start gap-3 border-b border-border/50 px-5 py-4 transition",
                  "hover:bg-accent/70",
                  isActive && "bg-accent/80"
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold shadow-sm ring-1 transition",
                    isActive
                      ? "bg-primary/15 text-primary ring-primary/20"
                      : "bg-secondary text-foreground ring-border"
                  )}
                >
                  {agent.nome.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {agent.nome}
                    </p>

                    <div className="flex items-center gap-2">
                      {agent.last_message_at && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {format(new Date(agent.last_message_at), "HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      )}

                      {isActive && (
                        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_16px_rgba(16,185,129,0.7)]" />
                      )}
                    </div>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {agent.last_message_preview ??
                      agent.descricao ??
                      "Sem descrição."}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}