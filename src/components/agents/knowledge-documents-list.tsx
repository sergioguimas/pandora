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
      return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
    case "processing":
      return "border-amber-300/20 bg-amber-300/10 text-amber-100";
    case "error":
      return "border-red-400/20 bg-red-400/10 text-red-200";
    default:
      return "border-white/10 bg-white/[0.04] text-white/45";
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
      "rounded-md border px-3 py-1.5 text-xs font-bold transition",
      filter === value
        ? "border-white bg-white text-[#020817]"
        : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.08] hover:text-white"
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-emerald-200">
          <BookOpen className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white">
            Conhecimentos cadastrados
          </h3>
          <p className="mt-1 text-sm leading-5 text-white/50">
            Visualize e gerencie a base usada pelo agente durante a recuperação
            semântica.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por título, conversa, fonte ou conteúdo..."
          className="h-11 w-full rounded-lg border border-white/10 bg-[#020817]/70 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-emerald-300/40 focus:ring-4 focus:ring-emerald-300/10"
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
        <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/45">
          Nenhum conhecimento cadastrado ainda.
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/45">
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
                className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[#020817]/55 p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                        {document.scope === "conversation" ? (
                          <MessageSquare className="h-4 w-4 text-emerald-200" />
                        ) : document.scope === "space" ? (
                          <Blocks className="h-4 w-4 text-emerald-200" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-emerald-200" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-bold text-white">
                          {document.titulo}
                        </h4>
                        <p className="text-xs text-white/45">
                          {document.scope === "conversation"
                            ? document.conversation_title || "Conversa vinculada"
                            : document.scope === "space"
                              ? "Conhecimento compartilhado do contexto"
                              : "Conhecimento global do agente"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-white/55">
                        {scopeLabel(document.scope)}
                      </span>

                      <span
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[11px] font-bold",
                          statusClass(document.status)
                        )}
                      >
                        {statusLabel(document.status)}
                      </span>

                      {document.fonte ? (
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-white/55">
                          Fonte: {document.fonte}
                        </span>
                      ) : null}

                      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-white/55">
                        <Blocks className="h-3.5 w-3.5" />
                        {document.chunks_count ?? 0} chunk
                        {(document.chunks_count ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/45">
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
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
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
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/15"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </form>
                  </div>
                </div>

                {expanded ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-white/80">
                      {preview || "Nenhum preview disponível para este conhecimento."}
                    </p>
                  </div>
                ) : preview ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/50">
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
