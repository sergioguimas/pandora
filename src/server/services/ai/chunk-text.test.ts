import { describe, expect, it } from "vitest";
import { chunkText } from "@/server/services/ai/chunk-text";

describe("chunkText — casos triviais", () => {
  it("devolve vazio para texto vazio ou só espaços", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("texto menor que o chunk vira um chunk só", () => {
    expect(chunkText("conteúdo curto", { chunkSize: 100, overlap: 10 })).toEqual([
      "conteúdo curto",
    ]);
  });

  it("normaliza CR (evita \\r\\n virar lixo no embedding)", () => {
    expect(chunkText("linha 1\r\nlinha 2", { chunkSize: 100 })).toEqual([
      "linha 1\nlinha 2",
    ]);
  });
});

describe("chunkText — fatiamento", () => {
  it("divide respeitando o tamanho e sobrepõe o overlap", () => {
    const texto = "abcdefghij"; // 10 chars
    const chunks = chunkText(texto, { chunkSize: 4, overlap: 2 });

    // 0-4, depois volta 2 → 2-6, 4-8, 6-10
    expect(chunks).toEqual(["abcd", "cdef", "efgh", "ghij"]);
  });

  it("sem overlap, os chunks não se repetem e reconstroem o texto", () => {
    const texto = "abcdefghij";
    const chunks = chunkText(texto, { chunkSize: 5, overlap: 0 });

    expect(chunks).toEqual(["abcde", "fghij"]);
    expect(chunks.join("")).toBe(texto);
  });

  it("cobre todo o conteúdo — nenhum trecho fica de fora", () => {
    const texto = "x".repeat(50) + "AGULHA" + "y".repeat(50);
    const chunks = chunkText(texto, { chunkSize: 30, overlap: 10 });

    // O overlap existe justamente para o termo não se perder na fronteira.
    expect(chunks.some((chunk) => chunk.includes("AGULHA"))).toBe(true);
  });

  it("usa os defaults do pipeline de ingestão (1200/200)", () => {
    const chunks = chunkText("z".repeat(2000));

    expect(chunks[0]).toHaveLength(1200);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("chunkText — regressão de laço infinito", () => {
  it("termina mesmo com overlap >= chunkSize", () => {
    // `start = Math.max(end - overlap, start + 1)` é o que garante progresso.
    // Sem isso, overlap >= chunkSize trava o laço e derruba a ingestão.
    const chunks = chunkText("abcdefghij", { chunkSize: 3, overlap: 5 });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(20);
  });

  it("termina com overlap igual ao chunkSize", () => {
    const chunks = chunkText("abcdefghij", { chunkSize: 4, overlap: 4 });

    expect(chunks.length).toBeLessThan(20);
  });
});
