import Link from "next/link";
import { Bot, Clock3, MessageSquare, Settings2 } from "lucide-react";
import { AgentsSidebar } from "@/components/chat/agents-sidebar";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getActiveAgents } from "@/server/repositories/agents-repository";
import type { AgentListItem } from "@/types/database";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function buildAgentHref(agent: AgentListItem) {
  if (agent.last_conversation_id) {
    return `/chat/${agent.slug}?conversation=${agent.last_conversation_id}`;
  }

  return `/chat/${agent.slug}`;
}

export default async function ChatPage() {
  const user = await getCurrentUser();
  const agents = await getActiveAgents(user?.id);
  const recentAgents = agents.filter((agent) => agent.last_conversation_id);

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <AgentsSidebar agents={agents} />

      <section className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-10 pt-20 md:px-8 md:pt-8">
          <header className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Pandora
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                Agentes disponíveis
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Inicie uma conversa individual ou retome o último contexto de
                cada agente.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/agentes"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 text-sm font-semibold transition hover:bg-accent"
              >
                <Settings2 className="h-4 w-4" />
                Gerenciar
              </Link>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-card/45 px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bot className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Agentes
                </span>
              </div>
              <p className="mt-2 text-2xl font-black">{agents.length}</p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card/45 px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Retomáveis
                </span>
              </div>
              <p className="mt-2 text-2xl font-black">{recentAgents.length}</p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card/45 px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Status
                </span>
              </div>
              <p className="mt-2 text-sm font-bold">Pronto para conversar</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => {
              const label =
                agent.category ||
                (agent.tags.length > 0 ? agent.tags[0] : null) ||
                "Agente";

              return (
                <Link
                  key={agent.id}
                  href={buildAgentHref(agent)}
                  className="group rounded-lg border border-border/70 bg-card/45 p-4 transition hover:border-primary/40 hover:bg-card/80"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-sm font-black text-primary">
                      {getInitials(agent.nome) || <Bot className="h-5 w-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold">
                            {agent.nome}
                          </h2>
                          <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                            {label}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {agent.last_conversation_id ? "Retomar" : "Novo"}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {agent.last_message_preview ||
                          agent.descricao ||
                          "Pronto para iniciar uma nova conversa."}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
