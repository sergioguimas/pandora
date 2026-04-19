import { createClient } from "@/lib/supabase/server";

type KnowledgeScope = "global" | "conversation";
type KnowledgeStatus = "pending" | "processing" | "ready" | "error";

export type KnowledgeDocumentListItem = {
  id: string;
  agent_id: string;
  conversation_id: string | null;
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

type KnowledgeChunkPreviewRow = {
  document_id: string;
  content: string;
};

type KnowledgeChunkCountRow = {
  document_id: string;
};

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
    throw new Error("Erro ao listar conhecimentos.");
  }

  const documents = (data ?? []).map((row: any) => ({
    id: row.id,
    agent_id: row.agent_id,
    conversation_id: row.conversation_id,
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
    throw new Error("Erro ao buscar preview dos conhecimentos.");
  }

  const firstChunkMap = new Map<string, string>();
  const chunkCountMap = new Map<string, number>();

  for (const row of (chunksData ?? []) as Array<
    KnowledgeChunkPreviewRow & { chunk_index: number }
  >) {
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

type MatchKnowledgeRow = {
  id: string;
  document_id: string;
  agent_id: string;
  conversation_id: string | null;
  scope: KnowledgeScope;
  chunk_index: number;
  content: string;
  metadata: unknown;
  similarity: number;
};

function normalizeMetadata(
  value: unknown
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}


export async function createKnowledgeDocument(params: {
  agentId: string;
  scope: KnowledgeScope;
  titulo: string;
  conversationId?: string | null;
  fonte?: string | null;
  mimeType?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      agent_id: params.agentId,
      conversation_id:
        params.scope === "conversation" ? params.conversationId ?? null : null,
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
    throw new Error("Erro ao criar documento de conhecimento.");
  }

  return data;
}

export async function insertKnowledgeChunks(params: {
  documentId: string;
  agentId: string;
  scope: KnowledgeScope;
  conversationId?: string | null;
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
    conversation_id:
      params.scope === "conversation" ? params.conversationId ?? null : null,
    scope: params.scope,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    embedding: chunk.embedding,
    metadata: chunk.metadata ?? null,
  }));

  const { error } = await supabase.from("knowledge_chunks").insert(payload);

  if (error) {
    throw new Error("Erro ao salvar chunks de conhecimento.");
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
    throw new Error("Erro ao atualizar status do documento.");
  }
}

export async function markKnowledgeDocumentError(
  documentId: string,
  reason?: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_documents")
    .update({
      status: "error",
      metadata: reason ? { error: reason } : { error: true },
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    throw new Error("Erro ao atualizar documento com falha.");
  }
}

export async function matchKnowledge(params: {
  agentId: string;
  conversationId: string;
  embedding: number[];
  threshold?: number;
  count?: number;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("match_agent_knowledge", {
    p_agent_id: params.agentId,
    p_conversation_id: params.conversationId,
    p_query_embedding: params.embedding,
    p_match_threshold: params.threshold ?? 0.45,
    p_match_count: params.count ?? 6,
  });

  if (error) {
    throw new Error("Erro ao buscar contexto semântico.");
  }

  return ((data ?? []) as MatchKnowledgeRow[]).map((row) => ({
    ...row,
    metadata: normalizeMetadata(row.metadata),
  }));
}

export async function deleteKnowledgeDocument(documentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    throw new Error("Erro ao excluir conhecimento.");
  }
}
