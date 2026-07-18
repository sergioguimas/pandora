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
import {
  DEFAULT_RESPONSE_MODE,
  RESPONSE_MODE_LABELS,
  RESPONSE_MODE_MAX_TOKENS,
  RESPONSE_MODES,
} from "@/lib/response-mode";
import { modelsFor } from "@/lib/model-catalog";
import type { Provider } from "@/lib/provider-keys";
import { cn } from "@/lib/utils";

type KnowledgeSpaceOption = {
  id: string;
  nome: string;
};

type AgentEditorFormProps = {
  agent: Agent;
  knowledgeSpaces?: KnowledgeSpaceOption[];
  /** Providers que a org pode usar (#4). Gemini sempre; openai só com chave. */
  availableProviders?: Provider[];
};

const initialState = {
  ok: false,
  error: undefined as string | undefined,
};

type Tab = "geral" | "prompt";

function fieldClass() {
  return "w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/25 border-t-primary-foreground" />
          Salvando…
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
  availableProviders = ["gemini"],
}: AgentEditorFormProps) {
  const [state, formAction] = useActionState(updateAgent, initialState);
  const [tab, setTab] = useState<Tab>("geral");
  const [isAtivo, setIsAtivo] = useState(agent.ativo);

  // Provider/modelo controlados: trocar o provider troca a lista de modelos.
  // Se o provider atual do agente não está mais disponível (ex.: a org tinha
  // chave OpenAI e removeu), cai para o primeiro disponível.
  const initialProvider = (
    availableProviders.includes(agent.provider as Provider) ? agent.provider : availableProviders[0]
  ) as Provider;
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const modelos = modelsFor(provider);
  const [model, setModel] = useState<string>(
    modelos.some((m) => m.id === agent.model) ? agent.model : (modelos[0]?.id ?? "")
  );

  return (
    <form action={formAction} className="flex flex-col">
      <input type="hidden" name="id" value={agent.id} />

      <div className="border-b border-border px-5 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <Settings2 className="h-4 w-4 text-primary" />
              {agent.nome}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-subtle-foreground">
              <span>slug: {agent.slug}</span>
            </div>

            {/* Provider + modelo (#4). OpenAI só aparece se a org tem a chave. */}
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                Provider
                <select
                  name="provider"
                  value={provider}
                  onChange={(e) => {
                    const p = e.target.value as Provider;
                    setProvider(p);
                    setModel(modelsFor(p)[0]?.id ?? "");
                  }}
                  className={cn("h-9 w-40", fieldClass())}
                >
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>
                      {p === "gemini" ? "Google Gemini" : "OpenAI"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                Modelo
                <select
                  name="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={cn("h-9 w-56", fieldClass())}
                >
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {availableProviders.length === 1 && (
              <p className="pt-1 text-[11px] text-subtle-foreground">
                Para usar modelos OpenAI, cadastre a chave OpenAI da organização em
                Configurações → Chaves de API.
              </p>
            )}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-3">
            <input
              name="ativo"
              type="checkbox"
              defaultChecked={agent.ativo}
              className="peer sr-only"
              onChange={(event) => setIsAtivo(event.target.checked)}
            />
            <div
              className={cn(
                "relative h-6 w-11 rounded-full bg-border-strong transition peer-checked:bg-primary",
                "after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-surface-1 after:transition after:content-[''] peer-checked:after:translate-x-5"
              )}
            />

            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {isAtivo ? "Agente online" : "Agente offline"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-subtle-foreground">
                status
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 inline-grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setTab("geral")}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors",
              tab === "geral"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Info className="h-4 w-4" />
            Geral
          </button>

          <button
            type="button"
            onClick={() => setTab("prompt")}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors",
              tab === "prompt"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
            <label className="text-sm font-medium text-foreground">Nome do agente</label>
            <input
              name="nome"
              defaultValue={agent.nome}
              className={cn("h-11", fieldClass())}
              placeholder="Ex.: Assistente de vendas"
              required
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Nome usado para identificar o agente em conversas e seleções.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Descrição curta</label>
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
              <label className="text-sm font-medium text-foreground">
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
              <label className="text-sm font-medium text-foreground">Categoria</label>
              <input
                name="category"
                defaultValue={agent.category ?? ""}
                className={cn("h-11", fieldClass())}
                placeholder="Ex.: Comercial, Financeiro"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Tags</label>
            <input
              name="tags"
              defaultValue={(agent.tags ?? []).join(", ")}
              className={cn("h-11", fieldClass())}
              placeholder="Ex.: vendas, planos, atendimento"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Separe as tags por vírgula.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">
              Tamanho da resposta
            </label>

            <select
              name="modo_resposta"
              defaultValue={agent.modo_resposta ?? DEFAULT_RESPONSE_MODE}
              className={cn("h-11", fieldClass())}
            >
              {RESPONSE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {RESPONSE_MODE_LABELS[mode]}
                </option>
              ))}
            </select>

            <p className="text-xs leading-5 text-muted-foreground">
              Limite de saída do modelo:{" "}
              {RESPONSE_MODES.map(
                (mode, index) =>
                  `${mode} ${RESPONSE_MODE_MAX_TOKENS[mode].toLocaleString("pt-BR")}${
                    index < RESPONSE_MODES.length - 1 ? " · " : ""
                  }`
              ).join("")}{" "}
              tokens. Use <strong>alto</strong> em agentes que respondem com
              tabelas longas — no <strong>médio</strong> elas podem ser cortadas.
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
            <label className="text-sm font-medium text-foreground">
              Prompt do sistema
            </label>
            <span className="rounded bg-primary-soft px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-primary">
              engenharia
            </span>
          </div>

          <textarea
            name="prompt_base"
            defaultValue={agent.prompt_base}
            rows={20}
            className="min-h-[420px] w-full rounded-md border border-input bg-surface-2 px-4 py-3 font-mono text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            placeholder="Você é um assistente especializado em…"
            required
            spellCheck={false}
          />
        </div>
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center">
            {state.error ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                {state.error}
              </div>
            ) : null}

            {state.ok && !state.error ? (
              <div className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary-soft px-3 py-2 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Alterações salvas.
              </div>
            ) : null}
          </div>

          <SaveButton />
        </div>
      </div>
    </form>
  );
}
