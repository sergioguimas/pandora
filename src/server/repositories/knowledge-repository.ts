import { createClient } from "@/lib/supabase/server";

export type KnowledgeScope = "global" | "conversation" | "space";
type KnowledgeStatus = "pending" | "processing" | "ready" | "error";

export type KnowledgeDocumentListItem = {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  knowledge_space_id: string | null;
  scope: KnowledgeScope;
  titulo: string;
  fonte: string | null;
  mime_type: string | null;
  status: KnowledgeStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  conversation_title?: string | null;
  preview_content?: string | null;
  chunks_count?: number;
};

export type KnowledgeMatch = {
  id: string;
  document_id: string;
  agent_id: string;
  conversation_id: string | null;
  knowledge_space_id: string | null;
  scope: KnowledgeScope;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

type MatchKnowledgeRow = Omit<KnowledgeMatch, "metadata"> & {
  metadata: unknown;
};

type KnowledgeChunkPreviewRow = {
  document_id: string;
  content: string;
  chunk_index: number;
};

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function listKnowledgeDocumentsByAgent(
  agentId: string
): Promise<KnowledgeDocumentListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(`
      id,
      agent_id,
      conversation_id,
      knowledge_space_id,
      scope,
      titulo,
      fonte,
      mime_type,
      status,
      metadata,
      created_at,
      updated_at,
      conversations (
        titulo
      )
    `)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar conhecimentos: ${error.message}`);
  }

  const documents = (data ?? []).map((row: any) => ({
    id: row.id,
    agent_id: row.agent_id,
    conversation_id: row.conversation_id,
    knowledge_space_id: row.knowledge_space_id,
    scope: row.scope,
    titulo: row.titulo,
    fonte: row.fonte,
    mime_type: row.mime_type,
    status: row.status,
    metadata: normalizeMetadata(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
    conversation_title: Array.isArray(row.conversations)
      ? row.conversations[0]?.titulo ?? null
      : row.conversations?.titulo ?? null,
    preview_content: null,
    chunks_count: 0,
  })) as KnowledgeDocumentListItem[];

  if (documents.length === 0) {
    return documents;
  }

  const documentIds = documents.map((document) => document.id);

  const { data: chunksData, error: chunksError } = await supabase
    .from("knowledge_chunks")
    .select("document_id, content, chunk_index")
    .in("document_id", documentIds)
    .order("chunk_index", { ascending: true });

  if (chunksError) {
    throw new Error(
      `Erro ao buscar preview dos conhecimentos: ${chunksError.message}`
    );
  }

  const firstChunkMap = new Map<string, string>();
  const chunkCountMap = new Map<string, number>();

  for (const row of (chunksData ?? []) as KnowledgeChunkPreviewRow[]) {
    if (!firstChunkMap.has(row.document_id)) {
      firstChunkMap.set(row.document_id, row.content);
    }

    chunkCountMap.set(
      row.document_id,
      (chunkCountMap.get(row.document_id) ?? 0) + 1
    );
  }

  return documents.map((document) => ({
    ...document,
    preview_content: firstChunkMap.get(document.id) ?? null,
    chunks_count: chunkCountMap.get(document.id) ?? 0,
  }));
}

export async function createKnowledgeDocument(params: {
  agentId: string;
  conversationId?: string | null;
  knowledgeSpaceId?: string | null;
  scope: KnowledgeScope;
  titulo: string;
  fonte?: string | null;
  mimeType?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      agent_id: params.agentId,
      conversation_id: params.conversationId ?? null,
      knowledge_space_id: params.knowledgeSpaceId ?? null,
      scope: params.scope,
      titulo: params.titulo,
      fonte: params.fonte ?? null,
      mime_type: params.mimeType ?? null,
      metadata: params.metadata ?? null,
      status: "processing",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Erro ao criar documento de conhecimento: ${error?.message ?? "sem dados"}`
    );
  }

  return data;
}

export async function insertKnowledgeChunks(params: {
  documentId: string;
  agentId: string;
  conversationId?: string | null;
  knowledgeSpaceId?: string | null;
  scope: KnowledgeScope;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown> | null;
  }>;
}) {
  const supabase = await createClient();

  const payload = params.chunks.map((chunk) => ({
    document_id: params.documentId,
    agent_id: params.agentId,
    conversation_id: params.conversationId ?? null,
    knowledge_space_id: params.knowledgeSpaceId ?? null,
    scope: params.scope,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: chunk.embedding,
    metadata: chunk.metadata ?? null,
  }));

  const { error } = await supabase.from("knowledge_chunks").insert(payload);

  if (error) {
    throw new Error(`Erro ao salvar chunks de conhecimento: ${error.message}`);
  }
}

export async function markKnowledgeDocumentReady(documentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_documents")
    .update({
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Erro ao atualizar status do documento: ${error.message}`);
  }
}

export async function markKnowledgeDocumentError(documentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_documents")
    .update({
      status: "error",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Erro ao marcar documento com erro: ${error.message}`);
  }
}

export async function deleteKnowledgeDocument(documentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    throw new Error(`Erro ao remover conhecimento: ${error.message}`);
  }
}

function extractSearchTerms(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter((term) => term.length >= 4)
    .slice(0, 8);
}

function scoreKeywordMatch(content: string, terms: string[]) {
  const normalized = content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return terms.reduce((score, term) => {
    return normalized.includes(term) ? score + 1 : score;
  }, 0);
}

export async function matchKnowledge(params: {
  agentId: string;
  conversationId: string;
  embedding: number[];
  query?: string;
  threshold?: number;
  count?: number;
}) {
  const supabase = await createClient();

  const matchCount = params.count ?? 8;

  const { data, error } = await supabase.rpc("match_agent_knowledge", {
    p_agent_id: params.agentId,
    p_conversation_id: params.conversationId,
    p_query_embedding: params.embedding,
    p_match_threshold: params.threshold ?? 0.35,
    p_match_count: matchCount,
  });

  if (error) {
    throw new Error("Erro ao buscar contexto semântico.");
  }

  const semanticMatches = ((data ?? []) as MatchKnowledgeRow[]).map((row) => ({
    ...row,
    metadata: normalizeMetadata(row.metadata),
  }));

  if (semanticMatches.length > 0 || !params.query?.trim()) {
    return semanticMatches;
  }

  const terms = extractSearchTerms(params.query);

  if (terms.length === 0) {
    return semanticMatches;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("knowledge_chunks")
    .select(
      `
      id,
      document_id,
      agent_id,
      conversation_id,
      scope,
      chunk_index,
      content,
      metadata,
      knowledge_documents!inner (
        status,
        titulo
      )
    `
    )
    .eq("agent_id", params.agentId)
    .or(
      `scope.eq.global,and(scope.eq.conversation,conversation_id.eq.${params.conversationId})`
    )
    .eq("knowledge_documents.status", "ready")
    .limit(80);

  if (fallbackError) {
    throw new Error("Erro ao buscar fallback textual da base de conhecimento.");
  }

  return ((fallbackData ?? []) as any[])
    .map((row) => {
      const keywordScore = scoreKeywordMatch(row.content, terms);

      return {
        id: row.id,
        document_id: row.document_id,
        agent_id: row.agent_id,
        conversation_id: row.conversation_id,
        scope: row.scope,
        chunk_index: row.chunk_index,
        content: row.content,
        metadata: normalizeMetadata({
          ...(row.metadata ?? {}),
          titulo: row.knowledge_documents?.titulo ?? null,
          fallback: true,
        }),
        similarity: keywordScore / terms.length,
      };
    })
    .filter((row) => row.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}