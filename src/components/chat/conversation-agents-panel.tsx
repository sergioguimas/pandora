"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  addConversationAgentAction,
  moveConversationAgentAction,
  removeConversationAgentAction,
} from "@/server/actions/chat-actions";

type Agent = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem?: number;
  conversation_agent_id?: string;
};

type Props = {
  conversationId: string;
  agentSlug: string;
  agents: Agent[];
  availableAgents: Agent[];
  isOwner: boolean;
};

function shortDescription(text: string | null) {
  if (!text) return "Sem descrição configurada.";
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

export function ConversationAgentsPanel({
  conversationId,
  agentSlug,
  agents,
  availableAgents,
  isOwner,
}: Props) {
  const [query, setQuery] = useState("");

  const orderedAgentIds = agents.map((agent) => agent.id).join(",");

  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return availableAgents;

    return availableAgents.filter((agent) => {
      return (
        agent.nome.toLowerCase().includes(normalized) ||
        (agent.descricao ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [availableAgents, query]);

  return (
    <div className="space-y-5 rounded-3xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background">
          <Bot className="h-5 w-5 text-primary" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-foreground">
            Agentes da conversa
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Defina quais especialistas participam e a ordem de resposta.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {agents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum agente configurado.
          </div>
        ) : (
          agents.map((agent, index) => {
            const isFirst = index === 0;
            const isLast = index === agents.length - 1;
            const isFallback = agent.conversation_agent_id?.startsWith("principal-");

            return (
              <div
                key={agent.id}
                className="rounded-2xl border border-border/60 bg-background/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                        #{index + 1}
                      </span>

                      {index === 0 ? (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                          Primeiro
                        </span>
                      ) : null}
                    </div>

                    <p className="truncate text-sm font-bold text-foreground">
                      {agent.nome}
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {shortDescription(agent.descricao)}
                    </p>
                  </div>

                  {isOwner ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <form action={moveConversationAgentAction}>
                        <input type="hidden" name="conversationId" value={conversationId} />
                        <input type="hidden" name="agentSlug" value={agentSlug} />
                        <input type="hidden" name="agentId" value={agent.id} />
                        <input type="hidden" name="direction" value="up" />
                        <input type="hidden" name="orderedAgentIds" value={orderedAgentIds} />
                        <button
                          type="submit"
                          disabled={isFirst}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Mover agente para cima"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                      </form>

                      <form action={moveConversationAgentAction}>
                        <input type="hidden" name="conversationId" value={conversationId} />
                        <input type="hidden" name="agentSlug" value={agentSlug} />
                        <input type="hidden" name="agentId" value={agent.id} />
                        <input type="hidden" name="direction" value="down" />
                        <input type="hidden" name="orderedAgentIds" value={orderedAgentIds} />
                        <button
                          type="submit"
                          disabled={isLast}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Mover agente para baixo"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </form>

                      {!isFallback ? (
                        <form action={removeConversationAgentAction}>
                          <input type="hidden" name="conversationId" value={conversationId} />
                          <input type="hidden" name="agentSlug" value={agentSlug} />
                          <input type="hidden" name="agentId" value={agent.id} />
                          <button
                            type="submit"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 transition hover:bg-red-500/15"
                            aria-label="Remover agente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isOwner ? (
        <div className="space-y-4 border-t border-border/60 pt-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Adicionar agente
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha outros especialistas para participar da resposta.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar agente..."
              className="w-full rounded-2xl border border-border bg-background px-10 py-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {filteredAgents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum agente encontrado.
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const alreadyAdded = agents.some((item) => item.id === agent.id);

                return (
                  <form key={agent.id} action={addConversationAgentAction}>
                    <input type="hidden" name="conversationId" value={conversationId} />
                    <input type="hidden" name="agentSlug" value={agentSlug} />
                    <input type="hidden" name="agentId" value={agent.id} />

                    <button
                      type="submit"
                      disabled={alreadyAdded}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition",
                        alreadyAdded
                          ? "cursor-not-allowed opacity-35"
                          : "hover:border-border/60 hover:bg-accent/60"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {agent.nome}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {shortDescription(agent.descricao)}
                        </p>
                      </div>

                      {!alreadyAdded ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card">
                          <Plus className="h-4 w-4 text-primary" />
                        </div>
                      ) : (
                        <span className="shrink-0 rounded-full border border-border/60 px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                          Adicionado
                        </span>
                      )}
                    </button>
                  </form>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card/40 px-4 py-4 text-xs leading-relaxed text-muted-foreground">
          Apenas o dono da conversa pode gerenciar os agentes.
        </div>
      )}
    </div>
  );
}