"use client";

import { useActionState, useMemo, useState } from "react";
import { BookOpen, Loader2, Save } from "lucide-react";
import {
  ingestKnowledgeAction,
  type IngestKnowledgeState,
} from "@/server/actions/knowledge-actions";
import { cn } from "@/lib/utils";

type ConversationOption = {
  id: string;
  titulo: string | null;
};

type KnowledgeScope = "global" | "conversation" | "space";

type KnowledgeSpaceOption = {
  id: string;
  nome: string;
};

type KnowledgeIngestFormProps = {
  agentId: string;
  agentName: string;
  conversations?: ConversationOption[];
  knowledgeSpaces?: KnowledgeSpaceOption[];
  defaultKnowledgeSpaceId?: string | null;
};

function fieldClass() {
  return "w-full rounded-lg border border-white/10 bg-[#020817]/70 px-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50";
}

export function KnowledgeIngestForm({
  agentId,
  agentName,
  conversations = [],
  knowledgeSpaces = [],
  defaultKnowledgeSpaceId = null,
}: KnowledgeIngestFormProps) {
  const initialState: IngestKnowledgeState = {
    success: false,
    error: null,
  };

  const [state, formAction, pending] = useActionState(
    ingestKnowledgeAction,
    initialState
  );
  const [scope, setScope] = useState<KnowledgeScope>("global");

  const hasConversationOptions = useMemo(
    () => conversations.length > 0,
    [conversations]
  );

  return (
    <form
      id={`knowledge-form-${agentId}`}
      action={formAction}
      className="space-y-5 rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
    >
      <input type="hidden" name="agentId" value={agentId} />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-emerald-200">
          <BookOpen className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white">Base de conhecimento</h3>
          <p className="mt-1 text-sm leading-5 text-white/50">
            Adicione conhecimento manual para o agente{" "}
            <span className="font-semibold text-white">{agentName}</span>.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor={`titulo-${agentId}`}
            className="text-sm font-bold text-white"
          >
            Título
          </label>
          <input
            id={`titulo-${agentId}`}
            name="titulo"
            type="text"
            placeholder="Ex.: Tabela de planos 2026"
            className={cn("h-11", fieldClass())}
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`scope-${agentId}`}
            className="text-sm font-bold text-white"
          >
            Tipo de conhecimento
          </label>
          <select
            id={`scope-${agentId}`}
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as KnowledgeScope)}
            className={cn("h-11", fieldClass())}
          >
            <option value="global">Global do agente</option>
            <option value="space">Base do contexto/produto</option>
            <option value="conversation">Específico da conversa</option>
          </select>
        </div>
      </div>

      {scope === "conversation" ? (
        <div className="space-y-2">
          <label
            htmlFor={`conversation-${agentId}`}
            className="text-sm font-bold text-white"
          >
            Conversa vinculada
          </label>
          <select
            id={`conversation-${agentId}`}
            name="conversationId"
            className={cn("h-11", fieldClass())}
            required
            disabled={!hasConversationOptions}
            defaultValue=""
          >
            <option value="">
              {hasConversationOptions
                ? "Selecione uma conversa"
                : "Nenhuma conversa disponível"}
            </option>
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.titulo || conversation.id}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {scope === "space" ? (
        <div className="space-y-2">
          <label
            htmlFor={`knowledge-space-${agentId}`}
            className="text-sm font-bold text-white"
          >
            Espaço de conhecimento
          </label>
          <select
            id={`knowledge-space-${agentId}`}
            name="knowledgeSpaceId"
            className={cn("h-11", fieldClass())}
            required
            disabled={knowledgeSpaces.length === 0}
            defaultValue={defaultKnowledgeSpaceId ?? ""}
          >
            <option value="">
              {knowledgeSpaces.length > 0
                ? "Selecione um espaço"
                : "Nenhum espaço disponível"}
            </option>
            {knowledgeSpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.nome}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor={`content-${agentId}`}
          className="text-sm font-bold text-white"
        >
          Conteúdo
        </label>
        <textarea
          id={`content-${agentId}`}
          name="content"
          rows={8}
          placeholder="Cole aqui o texto que o agente deve saber..."
          className={cn("px-3 py-3", fieldClass())}
          required
        />
        <p className="text-xs leading-5 text-white/45">
          Organize em blocos claros: regras, planos, objeções, perguntas
          frequentes ou contexto do cliente.
        </p>
      </div>

      {state.error ? (
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          Conhecimento ingerido com sucesso.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#020817] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar conhecimento
            </>
          )}
        </button>
      </div>
    </form>
  );
}
