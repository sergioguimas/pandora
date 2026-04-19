import { createClient } from "@/lib/supabase/server";

type KnowledgeScope = "global" | "conversation";

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