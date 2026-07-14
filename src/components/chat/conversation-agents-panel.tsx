"use client";

import { useMemo, useState } from "react";
import {
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
  if (!text) return "Sem descricao configurada.";
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
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Agentes da conversa
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Defina especialistas e a ordem da rodada.
        </p>
      </div>

      <div className="space-y-2">
        {agents.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
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
                className="rounded-md border border-border bg-surface-2 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                        #{index + 1}
                      </span>

                      {index === 0 ? (
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          primeiro
                        </span>
                      ) : null}
                    </div>

                    <p className="truncate text-sm font-medium text-foreground">
                      {agent.nome}
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
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
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
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
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
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
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
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
        <div className="space-y-3 border-t border-border pt-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            adicionar agente
          </p>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar agente…"
              className="h-10 w-full rounded-md border border-input bg-surface-2 px-9 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {filteredAgents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
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
                        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        alreadyAdded
                          ? "cursor-not-allowed opacity-40"
                          : "hover:bg-surface-2"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {agent.nome}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">
                          {shortDescription(agent.descricao)}
                        </p>
                      </div>

                      {!alreadyAdded ? (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-primary">
                          <Plus className="h-4 w-4" />
                        </div>
                      ) : (
                        <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">
                          adicionado
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
        <div className="rounded-md border border-border bg-surface-2 px-4 py-3 text-xs leading-5 text-muted-foreground">
          Apenas o dono da conversa pode gerenciar os agentes.
        </div>
      )}
    </div>
  );
}
