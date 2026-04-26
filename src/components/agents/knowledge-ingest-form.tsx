"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  ingestKnowledgeAction,
  type IngestKnowledgeState,
} from "@/server/actions/knowledge-actions";

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

  useEffect(() => {
    if (!state.success) return;

    const form = document.getElementById(
      `knowledge-form-${agentId}`
    ) as HTMLFormElement | null;

    form?.reset();
    setScope("global");
  }, [state.success, agentId]);

  return (
    <form
      id={`knowledge-form-${agentId}`}
      action={formAction}
      className="space-y-5 rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-xl"
    >
      <input type="hidden" name="agentId" value={agentId} />

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Base de conhecimento
        </h3>
        <p className="text-sm text-muted-foreground">
          Adicione conhecimento manual para o agente{" "}
          <span className="font-medium text-foreground">{agentName}</span>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor={`titulo-${agentId}`}
            className="text-sm font-medium text-foreground"
          >
            Título
          </label>
          <input
            id={`titulo-${agentId}`}
            name="titulo"
            type="text"
            placeholder="Ex.: Tabela de planos 2026"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`scope-${agentId}`}
            className="text-sm font-medium text-foreground"
          >
            Tipo de conhecimento
          </label>
          <select
            id={`scope-${agentId}`}
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as KnowledgeScope)}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
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
            className="text-sm font-medium text-foreground"
          >
            Conversa vinculada
          </label>
          <select
            id={`conversation-${agentId}`}
            name="conversationId"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
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

          <p className="text-xs text-muted-foreground">
            Use esse modo para guardar contexto específico de um atendimento ou
            cliente.
          </p>
        </div>
      ) : null}

      {scope === "space" ? (
        <div className="space-y-2">
          <label
            htmlFor={`knowledge-space-${agentId}`}
            className="text-sm font-medium text-foreground"
          >
            Espaço de conhecimento
          </label>

          <select
            id={`knowledge-space-${agentId}`}
            name="knowledgeSpaceId"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
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

          <p className="text-xs text-muted-foreground">
            Use esse modo para compartilhar conhecimento entre vários agentes do mesmo produto,
            fornecedor ou contexto.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor={`content-${agentId}`}
          className="text-sm font-medium text-foreground"
        >
          Conteúdo
        </label>
        <textarea
          id={`content-${agentId}`}
          name="content"
          rows={8}
          placeholder="Cole aqui o texto que o agente deve saber..."
          className="w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          required
        />
        <p className="text-xs text-muted-foreground">
          Para melhores resultados, organize em blocos claros, como regras,
          planos, objeções, perguntas frequentes ou contexto do cliente.
        </p>
      </div>

      {state.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          Conhecimento ingerido com sucesso.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Processando..." : "Salvar conhecimento"}
        </button>
      </div>
    </form>
  );
}