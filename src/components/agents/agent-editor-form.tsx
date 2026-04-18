"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Agent } from "@/types/database";
import { updateAgent } from "@/server/actions/agents-actions";
import { cn } from "@/lib/utils";

type AgentEditorFormProps = {
  agent: Agent;
};

const initialState = {
  ok: false,
  error: undefined as string | undefined,
};

type Tab = "geral" | "prompt";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-70"
    >
      {pending ? "Salvando..." : "Salvar alterações"}
    </button>
  );
}

export function AgentEditorForm({ agent }: AgentEditorFormProps) {
  const [state, formAction] = useActionState(updateAgent, initialState);
  const [tab, setTab] = useState<Tab>("geral");

  return (
    <form action={formAction} className="flex h-full flex-col">
      <input type="hidden" name="id" value={agent.id} />

      <div className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold text-foreground">
              {agent.nome}
            </h2>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">Slug:</span>{" "}
                {agent.slug}
              </span>
              <span>
                <span className="font-medium text-foreground">Provider:</span>{" "}
                {agent.provider}
              </span>
              <span>
                <span className="font-medium text-foreground">Model:</span>{" "}
                {agent.model}
              </span>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <input
              name="ativo"
              type="checkbox"
              defaultChecked={agent.ativo}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Ativo
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("geral")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              tab === "geral"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            Geral
          </button>

          <button
            type="button"
            onClick={() => setTab("prompt")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              tab === "prompt"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            Prompt
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === "geral" && (
          <div className="grid gap-6">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nome</label>
              <input
                name="nome"
                defaultValue={agent.nome}
                className="h-12 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-primary/50"
                placeholder="Nome do agente"
                required
              />
              <p className="text-xs text-muted-foreground">
                Nome exibido na interface e usado como identidade principal do agente.
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Slug</label>
              <input
                value={agent.slug}
                disabled
                className="h-12 rounded-xl border border-border bg-muted px-4 text-sm text-muted-foreground outline-none"
              />
              <p className="text-xs text-muted-foreground">
                O slug está somente leitura por enquanto para evitar quebrar rotas e referências.
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Descrição</label>
              <textarea
                name="descricao"
                defaultValue={agent.descricao ?? ""}
                rows={4}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/50"
                placeholder="Descreva o papel do agente..."
              />
              <p className="text-xs text-muted-foreground">
                Usado para exibição e contexto leve.
              </p>
            </div>
          </div>
        )}

        {tab === "prompt" && (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Prompt base</label>

            <textarea
              name="prompt_base"
              defaultValue={agent.prompt_base}
              rows={20}
              className="min-h-[480px] rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-primary/50"
              placeholder="Defina o comportamento do agente..."
              required
              spellCheck={false}
            />

            <p className="text-xs text-muted-foreground">
              Defina claramente função, limites, tom de voz e regras do agente.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {state.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}
            {state.ok && !state.error && (
              <p className="text-sm text-emerald-400">
                Alterações salvas.
              </p>
            )}
          </div>

          <SaveButton />
        </div>
      </div>
    </form>
  );
}