import { chunkText } from "@/server/services/ai/chunk-text";
import {
  createKnowledgeDocument,
  insertKnowledgeChunks,
  markKnowledgeDocumentReady,
} from "@/server/repositories/knowledge-repository";
import { generateDocumentEmbedding } from "@/server/services/ai/providers/gemini-embeddings";

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
  const document = await createKnowledgeDocument({
    agentId: params.agentId,
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