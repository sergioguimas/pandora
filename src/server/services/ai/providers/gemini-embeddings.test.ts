import { beforeEach, describe, expect, it, vi } from "vitest";

const embedContent = vi.fn();

vi.mock("@/lib/gemini/client", () => ({
  getGeminiClient: () => ({ models: { embedContent } }),
}));

const { generateQueryEmbedding, generateDocumentEmbedding, EMBEDDING_DIMENSIONS } =
  await import("@/server/services/ai/providers/gemini-embeddings");

function respostaOk() {
  return { embeddings: [{ values: Array(768).fill(0.1) }] };
}

beforeEach(() => {
  embedContent.mockReset();
  embedContent.mockResolvedValue(respostaOk());
});

describe("taskType — o par que mantém query e documento comparáveis (PD-11)", () => {
  it("query usa RETRIEVAL_QUERY", async () => {
    await generateQueryEmbedding("quanto custa o plano?");

    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ taskType: "RETRIEVAL_QUERY" }),
      })
    );
  });

  it("documento usa RETRIEVAL_DOCUMENT", async () => {
    await generateDocumentEmbedding("O plano Essencial custa R$ 100.");

    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ taskType: "RETRIEVAL_DOCUMENT" }),
      })
    );
  });

  it("os dois taskTypes são diferentes — se empatarem, o par quebrou", async () => {
    await generateQueryEmbedding("pergunta");
    await generateDocumentEmbedding("documento");

    const [q] = embedContent.mock.calls[0];
    const [d] = embedContent.mock.calls[1];

    expect(q.config.taskType).not.toBe(d.config.taskType);
  });
});

describe("configuração do modelo", () => {
  it("ambos usam o mesmo modelo e a mesma dimensão", async () => {
    await generateQueryEmbedding("pergunta");
    await generateDocumentEmbedding("documento");

    const [q] = embedContent.mock.calls[0];
    const [d] = embedContent.mock.calls[1];

    expect(q.model).toBe(d.model);

    // 768 é obrigatório: a coluna é vector(768). Divergir aqui quebra o insert.
    expect(q.config.outputDimensionality).toBe(EMBEDDING_DIMENSIONS);
    expect(d.config.outputDimensionality).toBe(EMBEDDING_DIMENSIONS);
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });
});

describe("respostas inválidas", () => {
  it("erro claro quando o Gemini não devolve embedding", async () => {
    embedContent.mockResolvedValue({ embeddings: [] });

    await expect(generateQueryEmbedding("x")).rejects.toThrow("Embedding vazio");
  });

  it("erro claro quando a resposta não é objeto", async () => {
    embedContent.mockResolvedValue(null);

    await expect(generateQueryEmbedding("x")).rejects.toThrow("Resposta inválida");
  });
});
