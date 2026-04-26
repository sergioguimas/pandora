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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#020817] text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-bold">Nova conversa</h2>
            <p className="mt-1 text-xs text-white/55">
              Combine um ou mais agentes na mesma rodada.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
              Título
            </span>
            <input
              placeholder="Ex.: Proposta para cliente Pro"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-300/10"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                Agentes
              </span>
              <span className="text-xs font-semibold text-white/55">
                {selected.length} selecionado{selected.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar agentes..."
                className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-300/10"
              />
            </div>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredAgents.map((agent) => {
              const checked = selected.includes(agent.id);

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition",
                    checked
                      ? "border-emerald-300/35 bg-emerald-300/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      checked
                        ? "border-emerald-300 bg-emerald-300 text-[#020817]"
                        : "border-white/20 text-transparent"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {agent.nome}
                  </span>
                </button>
              );
            })}

            {filteredAgents.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
                Nenhum agente encontrado.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={selected.length === 0 || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#020817] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
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
