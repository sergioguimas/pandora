"use client";

import { useState, useMemo } from "react";
import { Bot, Plus, Trash2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { addConversationAgentAction, removeConversationAgentAction } from "@/server/actions/chat-actions";

type Agent = {
  id: string;
  nome: string;
  descricao: string | null;
};

type Props = {
  conversationId: string;
  agentSlug: string;
  agents: Agent[];
  availableAgents: Agent[];
  isOwner: boolean;
};

function displayName(agent: Agent) {
  return agent.nome;
}

export function ConversationAgentsPanel({
  conversationId,
  agentSlug,
  agents,
  availableAgents,
  isOwner,
}: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [query, setQuery] = useState("");

  const filteredAgents = useMemo(() => {
    const normalized = query.toLowerCase();

    return availableAgents.filter((agent) => {
      return (
        agent.nome.toLowerCase().includes(normalized) ||
        (agent.descricao ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [availableAgents, query]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Agentes da conversa
        </h3>
        <p className="text-xs text-muted-foreground">
          {agents.length} agente(s) ativo(s)
        </p>
      </div>

      {/* LISTA ATUAL */}
      <div className="space-y-2">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum agente configurado.
          </p>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <Bot className="h-4 w-4 text-primary" />

                <div>
                  <p className="text-sm font-medium">
                    {displayName(agent)}
                  </p>
                  {agent.descricao ? (
                    <p className="text-xs text-muted-foreground">
                      {agent.descricao}
                    </p>
                  ) : null}
                </div>
              </div>

              {isOwner ? (
                <form action={removeConversationAgentAction}>
                  <input
                    type="hidden"
                    name="conversationId"
                    value={conversationId}
                  />
                  <input type="hidden" name="agentSlug" value={agentSlug} />
                  <input
                    type="hidden"
                    name="agentId"
                    value={agent.id}
                  />

                  <button
                    type="submit"
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* ADICIONAR */}
      {isOwner ? (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Adicionar agente
          </p>

          {/* BUSCA */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar agente..."
              className="w-full rounded-xl border border-border bg-background px-9 py-2 text-sm"
            />
          </div>

          {/* LISTA */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredAgents.map((agent) => {
              const alreadyAdded = agents.some((a) => a.id === agent.id);

              return (
                <form
                  key={agent.id}
                  action={addConversationAgentAction}
                >
                  <input
                    type="hidden"
                    name="conversationId"
                    value={conversationId}
                  />
                  <input
                    type="hidden"
                    name="agentId"
                    value={agent.id}
                  />

                  <button
                    type="submit"
                    disabled={alreadyAdded}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                      alreadyAdded
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent"
                    )}
                  >
                    <div>
                      <p className="font-medium">{agent.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {agent.descricao}
                      </p>
                    </div>

                    {!alreadyAdded ? (
                      <Plus className="h-4 w-4" />
                    ) : null}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Apenas o dono da conversa pode gerenciar os agentes.
        </p>
      )}
    </div>
  );
}