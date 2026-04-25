import { getGeminiClient } from "@/lib/gemini/client";

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

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const ai = getGeminiClient();

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  return extractEmbedding(response);
}

export async function generateDocumentEmbedding(text: string): Promise<number[]> {
  const ai = getGeminiClient();

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  return extractEmbedding(response);
}