"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Agent } from "@/types/database";
import { updateAgent } from "@/server/actions/agents-actions";

type AgentEditorFormProps = {
  agent: Agent;
};

const initialState = {
  ok: false,
  error: undefined as string | undefined,
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : "Salvar alterações"}
    </button>
  );
}

export function AgentEditorForm({ agent }: AgentEditorFormProps) {
  const [state, formAction] = useActionState(updateAgent, initialState);

  return (
    <form action={formAction} className="flex h-full flex-col">
      <input type="hidden" name="id" value={agent.id} />

      <div className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {agent.nome}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
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

          <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
            <input
              name="ativo"
              type="checkbox"
              defaultChecked={agent.ativo}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Ativo
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">
              Descrição
            </label>
            <textarea
              name="descricao"
              defaultValue={agent.descricao ?? ""}
              rows={4}
              className="min-h-[110px] rounded-xl border border-border bg-white/70 px-4 py-3 text-sm leading-6 text-black outline-none transition focus:border-primary/50"
              placeholder="Descreva a função do agente..."
            />
            <p className="text-xs text-muted-foreground">
              Resumo curto exibido na interface e usado como contexto auxiliar.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">
              Prompt base
            </label>
            <textarea
              name="prompt_base"
              defaultValue={agent.prompt_base}
              rows={18}
              className="min-h-[420px] rounded-xl border border-border bg-white/70 px-4 py-3 font-mono text-sm leading-6 text-black outline-none transition focus:border-primary/50"
              placeholder="Defina as instruções principais do agente..."
              required
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Instrução principal do agente. Seja claro sobre função, limites,
              tom de voz e comportamento esperado.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {state.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}
            {state.ok && !state.error && (
              <p className="text-sm text-emerald-400">
                Alterações salvas com sucesso.
              </p>
            )}
          </div>

          <SaveButton />
        </div>
      </div>
    </form>
  );
}