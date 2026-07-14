"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Blocks,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  Search,
  Trash2,
} from "lucide-react";

import { deleteKnowledgeAction } from "@/server/actions/knowledge-actions";
import type { KnowledgeDocumentListItem } from "@/server/repositories/knowledge-repository";
import { cn } from "@/lib/utils";

type KnowledgeDocumentsListProps = {
  documents: KnowledgeDocumentListItem[];
};

type FilterValue =
  | "all"
  | "global"
  | "space"
  | "conversation"
  | "ready"
  | "processing"
  | "error";

function scopeLabel(scope: KnowledgeDocumentListItem["scope"]) {
  switch (scope) {
    case "global":
      return "Agente";
    case "space":
      return "Contexto";
    case "conversation":
      return "Conversa";
    default:
      return scope;
  }
}

function statusLabel(status: KnowledgeDocumentListItem["status"]) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "processing":
      return "Processando";
    case "ready":
      return "Pronto";
    case "error":
      return "Erro";
    default:
      return status;
  }
}

function statusClass(status: KnowledgeDocumentListItem["status"]) {
  switch (status) {
    case "ready":
      return "bg-primary-soft text-primary";
    case "processing":
      return "bg-surface-3 text-muted-foreground";
    case "error":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-surface-3 text-muted-foreground";
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function buildSearchableText(document: KnowledgeDocumentListItem) {
  return [
    document.titulo,
    document.scope,
    document.status,
    document.fonte,
    document.conversation_title,
    document.preview_content,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesFilter(
  document: KnowledgeDocumentListItem,
  filter: FilterValue
) {
  switch (filter) {
    case "global":
      return document.scope === "global";
    case "space":
      return document.scope === "space";
    case "conversation":
      return document.scope === "conversation";
    case "ready":
      return document.status === "ready";
    case "processing":
      return document.status === "processing" || document.status === "pending";
    case "error":
      return document.status === "error";
    default:
      return true;
  }
}

export function KnowledgeDocumentsList({
  documents,
}: KnowledgeDocumentsListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return documents.filter((document) => {
      const filterOk = matchesFilter(document, filter);
      const queryOk = normalizedQuery
        ? buildSearchableText(document).includes(normalizedQuery)
        : true;

      return filterOk && queryOk;
    });
  }, [documents, query, filter]);

  function toggleExpanded(documentId: string) {
    setExpandedIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  }

  function filterButtonClass(value: FilterValue) {
    return cn(
      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
      filter === value
        ? "border-transparent bg-primary text-primary-foreground"
        : "border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface-1 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-primary">
          <BookOpen className="h-4.5 w-4.5" />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Conhecimentos cadastrados
          </h3>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            Visualize e gerencie a base usada pelo agente durante a recuperação
            semântica.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por título, conversa, fonte ou conteúdo…"
          className="h-10 w-full rounded-md border border-input bg-surface-2 py-2 pl-9 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter("all")} className={filterButtonClass("all")}>
          Todos
        </button>
        <button type="button" onClick={() => setFilter("global")} className={filterButtonClass("global")}>
          Globais
        </button>
        <button type="button" onClick={() => setFilter("space")} className={filterButtonClass("space")}>
          Contextos
        </button>
        <button type="button" onClick={() => setFilter("conversation")} className={filterButtonClass("conversation")}>
          Conversas
        </button>
        <button type="button" onClick={() => setFilter("ready")} className={filterButtonClass("ready")}>
          Prontos
        </button>
        <button type="button" onClick={() => setFilter("processing")} className={filterButtonClass("processing")}>
          Processando
        </button>
        <button type="button" onClick={() => setFilter("error")} className={filterButtonClass("error")}>
          Com erro
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum conhecimento cadastrado ainda.
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum resultado encontrado para os filtros atuais.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((document) => {
            const expanded = expandedIds.includes(document.id);
            const preview = document.preview_content ?? "";
            const collapsedPreview =
              preview.length > 220 ? `${preview.slice(0, 220)}…` : preview;

            return (
              <div
                key={document.id}
                className="flex flex-col gap-4 rounded-md border border-border bg-surface-2 p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-3 text-primary">
                        {document.scope === "conversation" ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : document.scope === "space" ? (
                          <Blocks className="h-4 w-4" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium text-foreground">
                          {document.titulo}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {document.scope === "conversation"
                            ? document.conversation_title || "Conversa vinculada"
                            : document.scope === "space"
                              ? "Conhecimento compartilhado do contexto"
                              : "Conhecimento global do agente"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {scopeLabel(document.scope)}
                      </span>

                      <span
                        className={cn(
                          "rounded px-2 py-0.5 font-mono text-[11px]",
                          statusClass(document.status)
                        )}
                      >
                        {statusLabel(document.status)}
                      </span>

                      {document.fonte ? (
                        <span className="rounded bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          fonte: {document.fonte}
                        </span>
                      ) : null}

                      <span className="inline-flex items-center gap-1 rounded bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        <Blocks className="h-3 w-3" />
                        {document.chunks_count ?? 0} chunk
                        {(document.chunks_count ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-subtle-foreground">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {format(new Date(document.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(document.id)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-1 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Recolher
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Preview
                        </>
                      )}
                    </button>

                    <form action={deleteKnowledgeAction}>
                      <input type="hidden" name="documentId" value={document.id} />
                      <button
                        type="submit"
                        aria-label="Excluir conhecimento"
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-1 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </form>
                  </div>
                </div>

                {expanded ? (
                  <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                      {preview || "Nenhum preview disponível para este conhecimento."}
                    </p>
                  </div>
                ) : preview ? (
                  <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {collapsedPreview}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
