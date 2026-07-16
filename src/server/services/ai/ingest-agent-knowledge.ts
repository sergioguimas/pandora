import { createClient } from "@/lib/supabase/server";
import { chunkText } from "@/server/services/ai/chunk-text";
import {
  createKnowledgeDocument,
  insertKnowledgeChunks,
  markKnowledgeDocumentReady,
} from "@/server/repositories/knowledge-repository";
import { generateDocumentEmbedding } from "@/server/services/ai/providers/gemini-embeddings";

// Resolve a organização dona do conhecimento, na mesma ordem de procedência do
// backfill da migration: conversa > space > agente. Roda sob RLS, então só
// enxerga o que o usuário pode ver.
async function resolveOrganizationId(params: {
  agentId: string;
  conversationId?: string | null;
  knowledgeSpaceId?: string | null;
}): Promise<string> {
  const supabase = await createClient();

  if (params.conversationId) {
    const { data } = await supabase
      .from("conversations")
      .select("organization_id")
      .eq("id", params.conversationId)
      .maybeSingle();

    if (data?.organization_id) return data.organization_id as string;
  }

  if (params.knowledgeSpaceId) {
    const { data } = await supabase
      .from("knowledge_spaces")
      .select("organization_id")
      .eq("id", params.knowledgeSpaceId)
      .maybeSingle();

    if (data?.organization_id) return data.organization_id as string;
  }

  const { data } = await supabase
    .from("agents")
    .select("organization_id")
    .eq("id", params.agentId)
    .maybeSingle();

  if (!data?.organization_id) {
    throw new Error("Não foi possível resolver a organização do conhecimento.");
  }

  return data.organization_id as string;
}

export async function ingestAgentKnowledge(params: {
  agentId: string;
  conversationId?: string | null;
  knowledgeSpaceId?: string | null;
  scope: "global" | "conversation" | "space";
  titulo: string;
  content: string;
  fonte?: string | null;
  mimeType?: string | null;
}) {
  const organizationId = await resolveOrganizationId({
    agentId: params.agentId,
    conversationId: params.conversationId,
    knowledgeSpaceId: params.knowledgeSpaceId,
  });

  const document = await createKnowledgeDocument({
    agentId: params.agentId,
    organizationId,
    conversationId: params.conversationId ?? null,
    knowledgeSpaceId: params.knowledgeSpaceId ?? null,
    scope: params.scope,
    titulo: params.titulo,
    fonte: params.fonte,
    mimeType: params.mimeType,
    metadata: null,
  });

  const chunks = chunkText(params.content, {
    chunkSize: 1200,
    overlap: 200,
  });

  const rows = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = await generateDocumentEmbedding(chunk);

    rows.push({
      chunkIndex: index,
      content: chunk,
      embedding,
      metadata: {
        titulo: params.titulo,
        scope: params.scope,
      },
    });
  }

  await insertKnowledgeChunks({
    documentId: document.id,
    agentId: params.agentId,
    organizationId,
    conversationId: params.conversationId ?? null,
    knowledgeSpaceId: params.knowledgeSpaceId ?? null,
    scope: params.scope,
    chunks: rows,
  });

  await markKnowledgeDocumentReady(document.id);

  return {
    document,
    chunkCount: rows.length,
  };
}
