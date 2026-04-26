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
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
            <Bot className="h-5 w-5 text-emerald-200" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-white">
              Agentes da conversa
            </h3>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Defina especialistas e ordem da rodada.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/45">
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
                className="rounded-lg border border-white/10 bg-white/[0.035] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-200">
                        #{index + 1}
                      </span>

                      {index === 0 ? (
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-white/55">
                          Primeiro
                        </span>
                      ) : null}
                    </div>

                    <p className="truncate text-sm font-bold text-white">
                      {agent.nome}
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
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
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/50 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/50 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-red-400/20 bg-red-400/10 text-red-200 transition hover:bg-red-400/15"
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
        <div className="space-y-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              Adicionar agente
            </p>
            <p className="mt-1 text-xs text-white/45">
              Escolha outros especialistas para a resposta.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar agente..."
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-10 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-300/10"
            />
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {filteredAgents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/45">
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
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition",
                        alreadyAdded
                          ? "cursor-not-allowed border-transparent opacity-35"
                          : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {agent.nome}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
                          {shortDescription(agent.descricao)}
                        </p>
                      </div>

                      {!alreadyAdded ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                          <Plus className="h-4 w-4 text-emerald-200" />
                        </div>
                      ) : (
                        <span className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-white/45">
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
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-4 text-xs leading-5 text-white/45">
          Apenas o dono da conversa pode gerenciar os agentes.
        </div>
      )}
    </div>
  );
}
