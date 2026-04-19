"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Trash2,
  BookOpen,
  FileText,
  MessageSquare,
  Search,
  ChevronDown,
  ChevronUp,
  Blocks,
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
  | "conversation"
  | "ready"
  | "processing"
  | "error";

function scopeLabel(scope: KnowledgeDocumentListItem["scope"]) {
  return scope === "global" ? "Global" : "Conversa";
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
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
    case "processing":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600";
    case "error":
      return "border-red-500/20 bg-red-500/10 text-red-500";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
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
      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
      filter === value
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
    );
  }

  return (
    <section className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-xl">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Conhecimentos cadastrados
        </h3>
        <p className="text-sm text-muted-foreground">
          Visualize e gerencie a base usada pelo agente durante a recuperação semântica.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por título, conversa, fonte ou conteúdo..."
          className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={filterButtonClass("all")}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setFilter("global")}
          className={filterButtonClass("global")}
        >
          Globais
        </button>
        <button
          type="button"
          onClick={() => setFilter("conversation")}
          className={filterButtonClass("conversation")}
        >
          Conversas
        </button>
        <button
          type="button"
          onClick={() => setFilter("ready")}
          className={filterButtonClass("ready")}
        >
          Prontos
        </button>
        <button
          type="button"
          onClick={() => setFilter("processing")}
          className={filterButtonClass("processing")}
        >
          Processando
        </button>
        <button
          type="button"
          onClick={() => setFilter("error")}
          className={filterButtonClass("error")}
        >
          Com erro
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum conhecimento cadastrado ainda.
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum resultado encontrado para os filtros atuais.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((document) => {
            const expanded = expandedIds.includes(document.id);
            const preview = document.preview_content ?? "";
            const collapsedPreview =
              preview.length > 220 ? `${preview.slice(0, 220)}...` : preview;

            return (
              <div
                key={document.id}
                className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/70 p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card">
                        {document.scope === "global" ? (
                          <BookOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-primary" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-foreground">
                          {document.titulo}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {document.scope === "conversation"
                            ? document.conversation_title || "Conversa vinculada"
                            : "Conhecimento global do agente"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {scopeLabel(document.scope)}
                      </span>

                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          statusClass(document.status)
                        )}
                      >
                        {statusLabel(document.status)}
                      </span>

                      {document.fonte ? (
                        <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          Fonte: {document.fonte}
                        </span>
                      ) : null}

                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        <Blocks className="h-3.5 w-3.5" />
                        {document.chunks_count ?? 0} chunk
                        {(document.chunks_count ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Criado em{" "}
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
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
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
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/15"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </form>
                  </div>
                </div>

                {expanded ? (
                  <div className="rounded-2xl border border-border/60 bg-card/50 px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">
                      {preview || "Nenhum preview disponível para este conhecimento."}
                    </p>
                  </div>
                ) : preview ? (
                  <div className="rounded-2xl border border-border/40 bg-card/30 px-4 py-3">
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