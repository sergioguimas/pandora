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
  return "w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";
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
      className="space-y-5 rounded-lg border border-border bg-surface-1 p-5"
    >
      <input type="hidden" name="agentId" value={agentId} />

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-primary">
          <BookOpen className="h-4.5 w-4.5" />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Base de conhecimento
          </h3>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            Adicione conhecimento manual para o agente{" "}
            <span className="font-medium text-foreground">{agentName}</span>.
          </p>
        </div>
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
            className={cn("h-11", fieldClass())}
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
            className="text-sm font-medium text-foreground"
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
            className="text-sm font-medium text-foreground"
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
          className="text-sm font-medium text-foreground"
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
        <p className="text-xs leading-5 text-muted-foreground">
          Organize em blocos claros: regras, planos, objeções, perguntas
          frequentes ou contexto do cliente.
        </p>
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {state.error}
        </div>
      ) : null}

      {state.success ? (
        <div className="rounded-md border border-primary/25 bg-primary-soft px-4 py-3 text-sm font-medium text-primary">
          Conhecimento ingerido com sucesso.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando…
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
