import { chunkText } from "@/server/services/ai/chunk-text";
import {
  createKnowledgeDocument,
  insertKnowledgeChunks,
  markKnowledgeDocumentError,
  markKnowledgeDocumentReady,
} from "@/server/repositories/knowledge-repository";
import { generateDocumentEmbedding } from "@/server/services/ai/providers/gemini-embeddings";

type KnowledgeScope = "global" | "conversation";

export async function ingestAgentKnowledge(params: {
  agentId: string;
  scope: KnowledgeScope;
  titulo: string;
  content: string;
  conversationId?: string | null;
  fonte?: string | null;
  mimeType?: string | null;
}) {
  const document = await createKnowledgeDocument({
    agentId: params.agentId,
    scope: params.scope,
    conversationId:
      params.scope === "conversation" ? params.conversationId ?? null : null,
    titulo: params.titulo,
    fonte: params.fonte,
    mimeType: params.mimeType,
    metadata: null,
  });

  try {
    const chunks = chunkText(params.content, {
      chunkSize: 1200,
      overlap: 200,
    });

    if (chunks.length === 0) {
      throw new Error("O conteúdo informado não gerou chunks válidos.");
    }

    const rows: Array<{
      chunkIndex: number;
      content: string;
      embedding: number[];
      metadata: Record<string, unknown> | null;
    }> = [];

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
          fonte: params.fonte ?? null,
        },
      });
    }

    await insertKnowledgeChunks({
      documentId: document.id,
      agentId: params.agentId,
      scope: params.scope,
      conversationId:
        params.scope === "conversation" ? params.conversationId ?? null : null,
      chunks: rows,
    });

    await markKnowledgeDocumentReady(document.id);

    return {
      document,
      chunkCount: rows.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao ingerir conhecimento.";

    await markKnowledgeDocumentError(document.id, message);

    throw error;
  }
}