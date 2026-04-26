"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Save,
  Settings2,
  Terminal,
} from "lucide-react";
import type { Agent } from "@/types/database";
import { updateAgent } from "@/server/actions/agents-actions";
import { cn } from "@/lib/utils";

type KnowledgeSpaceOption = {
  id: string;
  nome: string;
};

type AgentEditorFormProps = {
  agent: Agent;
  knowledgeSpaces?: KnowledgeSpaceOption[];
};

const initialState = {
  ok: false,
  error: undefined as string | undefined,
};

type Tab = "geral" | "prompt";

function fieldClass() {
  return "w-full rounded-lg border border-white/10 bg-[#020817]/70 px-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-300/10";
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#020817] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#020817]/25 border-t-[#020817]" />
          Salvando...
        </>
      ) : (
        <>
          <Save className="h-4 w-4" />
          Salvar alterações
        </>
      )}
    </button>
  );
}

export function AgentEditorForm({
  agent,
  knowledgeSpaces = [],
}: AgentEditorFormProps) {
  const [state, formAction] = useActionState(updateAgent, initialState);
  const [tab, setTab] = useState<Tab>("geral");
  const [isAtivo, setIsAtivo] = useState(agent.ativo);

  return (
    <form action={formAction} className="flex flex-col">
      <input type="hidden" name="id" value={agent.id} />

      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
              <Settings2 className="h-5 w-5 text-emerald-200" />
              {agent.nome}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
              <span>Slug: {agent.slug}</span>
              <span>Provider: {agent.provider}</span>
              <span>Model: {agent.model}</span>
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.06]">
            <input
              name="ativo"
              type="checkbox"
              defaultChecked={agent.ativo}
              className="peer sr-only"
              onChange={(event) => setIsAtivo(event.target.checked)}
            />
            <div
              className={cn(
                "relative h-6 w-11 rounded-full bg-white/15 transition peer-checked:bg-emerald-300",
                "after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition after:content-[''] peer-checked:after:translate-x-5"
              )}
            />

            <span className="flex flex-col">
              <span className="text-sm font-bold text-white">
                {isAtivo ? "Agente online" : "Agente offline"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Status
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 inline-grid grid-cols-2 rounded-lg border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setTab("geral")}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition",
              tab === "geral"
                ? "bg-white text-[#020817]"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            <Info className="h-4 w-4" />
            Geral
          </button>

          <button
            type="button"
            onClick={() => setTab("prompt")}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition",
              tab === "prompt"
                ? "bg-white text-[#020817]"
                : "text-white/55 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            <Terminal className="h-4 w-4" />
            Prompt
          </button>
        </div>
      </div>

      <div className="px-5 py-5">
        <div
          className={cn(
            "max-w-3xl space-y-5",
            tab === "geral" ? "block animate-in fade-in" : "hidden"
          )}
        >
          <div className="grid gap-2">
            <label className="text-sm font-bold text-white">Nome do agente</label>
            <input
              name="nome"
              defaultValue={agent.nome}
              className={cn("h-11", fieldClass())}
              placeholder="Ex.: Assistente de vendas"
              required
            />
            <p className="text-xs leading-5 text-white/45">
              Nome usado para identificar o agente em conversas e seleções.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-bold text-white">Descrição curta</label>
            <textarea
              name="descricao"
              defaultValue={agent.descricao ?? ""}
              rows={4}
              className={cn("resize-none px-3 py-3", fieldClass())}
              placeholder="Para que serve este agente?"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-bold text-white">
                Espaço de conhecimento
              </label>
              <select
                name="knowledge_space_id"
                defaultValue={agent.knowledge_space_id ?? ""}
                className={cn("h-11", fieldClass())}
              >
                <option value="">Sem espaço vinculado</option>
                {knowledgeSpaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-bold text-white">Categoria</label>
              <input
                name="category"
                defaultValue={agent.category ?? ""}
                className={cn("h-11", fieldClass())}
                placeholder="Ex.: Comercial, Financeiro"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-bold text-white">Tags</label>
            <input
              name="tags"
              defaultValue={(agent.tags ?? []).join(", ")}
              className={cn("h-11", fieldClass())}
              placeholder="Ex.: vendas, planos, atendimento"
            />
            <p className="text-xs leading-5 text-white/45">
              Separe as tags por vírgula.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "space-y-3",
            tab === "prompt" ? "block animate-in fade-in" : "hidden"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-bold text-white">
              Prompt do sistema
            </label>
            <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100">
              Engenharia
            </span>
          </div>

          <textarea
            name="prompt_base"
            defaultValue={agent.prompt_base}
            rows={20}
            className="min-h-[420px] w-full rounded-lg border border-white/10 bg-[#020817]/70 px-4 py-4 font-mono text-sm leading-7 text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-300/10"
            placeholder="Você é um assistente especializado em..."
            required
            spellCheck={false}
          />
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center">
            {state.error ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-bold text-red-200">
                <AlertCircle className="h-4 w-4" />
                {state.error}
              </div>
            ) : null}

            {state.ok && !state.error ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                Alterações sincronizadas.
              </div>
            ) : null}
          </div>

          <SaveButton />
        </div>
      </div>
    </form>
  );
}
