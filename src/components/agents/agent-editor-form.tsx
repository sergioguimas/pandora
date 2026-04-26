"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Agent } from "@/types/database";
import { updateAgent } from "@/server/actions/agents-actions";
import { cn } from "@/lib/utils";
import { Save, Info, Terminal, Settings2, CheckCircle2, AlertCircle } from "lucide-react";

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

// Componente de Botão de Salvar Refinado
function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "group flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all active:scale-95",
        "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-70 disabled:grayscale",
      )}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          Salvando...
        </span>
      ) : (
        <>
          <Save className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
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
    <form action={formAction} className="flex h-full flex-col bg-card/30 backdrop-blur-sm rounded-2xl border border-border/60 overflow-hidden shadow-xl">
      <input type="hidden" name="id" value={agent.id} />

      {/* Cabeçalho do Formulário */}
      <div className="border-b border-border/60 bg-card/50 px-8 py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Settings2 className="h-6 w-6 text-primary" />
              {agent.nome}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="text-foreground/50">ID:</span> {agent.slug}</span>
              <span className="flex items-center gap-1.5"><span className="text-foreground/50">Provider:</span> {agent.provider}</span>
              <span className="flex items-center gap-1.5"><span className="text-foreground/50">Model:</span> {agent.model}</span>
            </div>
          </div>

          {/* Switch de Ativo Estilizado */}
          <label className="relative inline-flex cursor-pointer items-center gap-3 rounded-full border border-border bg-background/50 px-4 py-2 transition-all hover:bg-accent group">
            <input
              name="ativo"
              type="checkbox"
              defaultChecked={agent.ativo}
              className="peer sr-only"
              onChange={(e) => setIsAtivo(e.target.checked)}
            />
            
            {/* O "Track" do Switch */}
            <div className={cn(
              "h-6 w-11 rounded-full transition-all duration-300 ease-in-out",
              "bg-muted peer-checked:bg-primary peer-checked:shadow-[0_0_10px_rgba(16,185,129,0.3)]", // Muda de cinza para verde primário
              "relative after:absolute after:top-[4px] after:left-[4px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-['']",
              "peer-checked:after:translate-x-5 peer-checked:after:bg-white" // Move a "bolinha"
            )} />
            
            <span className="flex flex-col">
              <span className="text-sm font-bold text-foreground transition-colors group-hover:text-primary peer-checked:text-primary">
                {isAtivo ? "Agente Online" : "Agente Offline"}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Status
              </span>
            </span>
          </label>
        </div>

        {/* Abas (Tabs) com Design Moderno */}
        <div className="mt-8 flex gap-1 rounded-xl bg-secondary/50 p-1 w-fit">
          <button
            type="button"
            onClick={() => setTab("geral")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all",
              tab === "geral"
                ? "bg-background text-primary shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <Info className="h-4 w-4" />
            Configuração Geral
          </button>

          <button
            type="button"
            onClick={() => setTab("prompt")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all",
              tab === "prompt"
                ? "bg-background text-primary shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <Terminal className="h-4 w-4" />
            Instruções (Prompt)
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
        <div
          className={cn(
            "max-w-2xl space-y-8",
            tab === "geral"
              ? "block animate-in fade-in slide-in-from-bottom-2 duration-300"
              : "hidden"
          )}
        >
          <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid gap-3">
              <label className="text-sm font-bold text-foreground">Nome do Agente</label>
              <input
                name="nome"
                defaultValue={agent.nome}
                className="h-12 rounded-xl border border-border bg-background/50 px-4 text-sm font-medium text-foreground transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none"
                placeholder="Ex: Assistente de Vendas"
                required
              />
              <p className="text-[13px] text-muted-foreground leading-relaxed italic">
                Este nome será usado para identificar o agente em todas as interações de chat.
              </p>
            </div>

            <div className="grid gap-3">
              <label className="text-sm font-bold text-foreground">Descrição Curta</label>
              <textarea
                name="descricao"
                defaultValue={agent.descricao ?? ""}
                rows={4}
                className="rounded-xl border border-border bg-background/50 px-4 py-3 text-sm font-medium text-foreground transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none"
                placeholder="Para que serve este agente?"
              />
              <p className="text-[13px] text-muted-foreground italic">
                Breve resumo das capacidades para consulta rápida da equipe.
              </p>
            </div>
            <div className="grid gap-3">
              <label className="text-sm font-bold text-foreground">
                Espaço de conhecimento
              </label>

              <select
                name="knowledge_space_id"
                defaultValue={agent.knowledge_space_id ?? ""}
                className="h-12 rounded-xl border border-border bg-background/50 px-4 text-sm font-medium text-foreground outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                <option value="">Sem espaço vinculado</option>

                {knowledgeSpaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.nome}
                  </option>
                ))}
              </select>

              <p className="text-[13px] text-muted-foreground italic">
                Agentes no mesmo espaço podem compartilhar uma base de conhecimento comum.
              </p>
            </div>

            <div className="grid gap-3">
              <label className="text-sm font-bold text-foreground">
                Categoria
              </label>

              <input
                name="category"
                defaultValue={agent.category ?? ""}
                className="h-12 rounded-xl border border-border bg-background/50 px-4 text-sm font-medium text-foreground outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="Ex.: Secullum, Moderno, Comercial, Financeiro"
              />

              <p className="text-[13px] text-muted-foreground italic">
                Use para organizar o catálogo de agentes por produto, área ou função.
              </p>
            </div>

            <div className="grid gap-3">
              <label className="text-sm font-bold text-foreground">
                Tags
              </label>

              <input
                name="tags"
                defaultValue={(agent.tags ?? []).join(", ")}
                className="h-12 rounded-xl border border-border bg-background/50 px-4 text-sm font-medium text-foreground outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="Ex.: vendas, planos, atendimento"
              />

              <p className="text-[13px] text-muted-foreground italic">
                Separe as tags por vírgula.
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "h-full flex-col gap-4",
            tab === "prompt"
              ? "flex animate-in fade-in slide-in-from-bottom-2 duration-300"
              : "hidden"
          )}
        >
          <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-foreground">Prompt do Sistema (System Instructions)</label>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">Modo Engenharia</span>
            </div>

            <textarea
              name="prompt_base"
              defaultValue={agent.prompt_base}
              rows={20}
              className="flex-1 min-h-[400px] rounded-xl border border-border bg-background/80 px-5 py-4 font-mono text-sm leading-7 text-foreground/90 shadow-inner outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
              placeholder="Você é um assistente especializado em..."
              required
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* Rodapé de Ações */}
      <div className="border-t border-border/60 bg-card/50 px-8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {state.error && (
              <div className="flex items-center gap-2 text-sm font-bold text-red-400 bg-red-400/10 px-3 py-2 rounded-lg animate-bounce">
                <AlertCircle className="h-4 w-4" />
                {state.error}
              </div>
            )}
            {state.ok && !state.error && (
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
                Alterações sincronizadas com sucesso!
              </div>
            )}
          </div>

          <SaveButton />
        </div>
      </div>
    </form>
  );
}