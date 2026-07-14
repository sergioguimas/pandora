"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Agent = {
  id: string;
  nome: string;
};

type CreateConversationResponse = {
  conversation: {
    id: string;
  };
  primaryAgent: {
    slug: string;
  };
};

export function CreateConversationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    let active = true;

    fetch("/api/agents")
      .then((res) => res.json())
      .then((data: { agents?: Agent[] }) => {
        if (active) {
          setAgents(data.agents ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setAgents([]);
        }
      });

    return () => {
      active = false;
    };
  }, [open]);

  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return agents;

    return agents.filter((agent) =>
      agent.nome.toLowerCase().includes(normalized)
    );
  }, [agents, query]);

  function toggleAgent(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((agentId) => agentId !== id)
        : [...prev, id]
    );
  }

  async function handleCreate() {
    if (selected.length === 0 || loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          agentIds: selected,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar conversa.");
      }

      const data = (await response.json()) as CreateConversationResponse;

      router.push(
        `/chat/${data.primaryAgent.slug}?conversation=${data.conversation.id}`
      );
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface-1 text-foreground shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Nova conversa</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Combine um ou mais agentes na mesma rodada.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Título
            </span>
            <input
              placeholder="Ex.: Proposta para cliente Pro"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Agentes
              </span>
              <span className="font-mono text-[11px] text-subtle-foreground">
                {selected.length} selecionado{selected.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar agentes…"
                className="h-10 w-full rounded-md border border-input bg-surface-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredAgents.map((agent) => {
              const checked = selected.includes(agent.id);

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    checked
                      ? "border-primary/40 bg-primary-soft"
                      : "border-border bg-surface-2 hover:bg-surface-3"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong text-transparent"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {agent.nome}
                  </span>
                </button>
              );
            })}

            {filteredAgents.length === 0 ? (
              <div className="rounded-md border border-border bg-surface-2 px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum agente encontrado.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={selected.length === 0 || loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Criar conversa
          </button>
        </div>
      </div>
    </div>
  );
}
