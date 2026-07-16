import { getGeminiClient } from "@/lib/gemini/client";

// Embeddings do RAG (PD-11).
//
// `taskType` NÃO é cosmético: a doc do Gemini é explícita — "mismatching these
// produces incomparable embeddings". Documento e query precisam do par
// RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY para viverem no mesmo espaço vetorial.
//
// ⚠️ Chunks embeddados ANTES do PD-11 saíram sem `taskType` (cujo default a doc
// não especifica), logo estão num espaço diferente e não são comparáveis com as
// queries atuais. Ao mudar qualquer coisa aqui, os chunks existentes precisam ser
// regerados: `npm run reembed:knowledge`.

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768; // casa com vector(768) em knowledge_chunks

function extractEmbedding(response: unknown): number[] {
  if (!response || typeof response !== "object") {
    throw new Error("Resposta inválida do Gemini.");
  }

  const value = response as {
    embeddings?: Array<{ values?: number[] }>;
  };

  const values = value.embeddings?.[0]?.values;

  if (!values || values.length === 0) {
    throw new Error("Embedding vazio retornado pelo Gemini.");
  }

  return values;
}

/** Embedding da pergunta do usuário. Par de `generateDocumentEmbedding`. */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const ai = getGeminiClient();

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  return extractEmbedding(response);
}

/** Embedding de um chunk da base. Par de `generateQueryEmbedding`. */
export async function generateDocumentEmbedding(text: string): Promise<number[]> {
  const ai = getGeminiClient();

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  return extractEmbedding(response);
}
