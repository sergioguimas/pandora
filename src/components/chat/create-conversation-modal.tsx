"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Agent = {
  id: string;
  nome: string;
};

export function CreateConversationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data.agents ?? []));
  }, [open]);

  function toggleAgent(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((a) => a !== id)
        : [...prev, id]
    );
  }

  async function handleCreate() {
    if (selected.length === 0) return;

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        agentIds: selected,
      }),
    });

    const data = await res.json();

    router.push(`/chat/${data.primaryAgent.slug}?conversation=${data.conversation.id}`);
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-black p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">
          Nova conversa
        </h2>

        <input
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm"
        />

        <div className="mb-4 max-h-60 overflow-y-auto space-y-2">
          {agents.map((agent) => (
            <label
              key={agent.id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(agent.id)}
                onChange={() => toggleAgent(agent.id)}
              />
              {agent.nome}
            </label>
          ))}
        </div>

        <button
          onClick={handleCreate}
          className="w-full rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
          disabled={selected.length === 0}
        >
          Criar conversa
        </button>
      </div>
    </div>
  );
}