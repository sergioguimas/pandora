import { describe, expect, it } from "vitest";
import {
  extractSearchTerms,
  scoreKeywordMatch,
} from "@/server/repositories/knowledge-repository";

// Fallback textual do RAG: usado quando a busca semântica não retorna nada.
// É a rede de segurança do conhecimento — se ele erra, o agente responde
// "não tenho essa informação" mesmo com o dado na base.

describe("extractSearchTerms", () => {
  it("descarta acentos e caixa", () => {
    expect(extractSearchTerms("Preço MENSAL")).toEqual(["preco", "mensal"]);
  });

  it("descarta pontuação", () => {
    expect(extractSearchTerms("qual o valor do plano?")).toEqual([
      "qual",
      "valor",
      "plano",
    ]);
  });

  it("descarta termos com menos de 4 caracteres", () => {
    // "o", "do" são ruído. Mas siglas curtas do domínio também caem —
    // ver a regressão documentada abaixo.
    expect(extractSearchTerms("o valor do kit")).toEqual(["valor"]);
  });

  it("limita a 8 termos", () => {
    const termos = extractSearchTerms(
      "alpha bravo charlie delta echo foxtrot golf hotel india juliett"
    );

    expect(termos).toHaveLength(8);
    expect(termos[0]).toBe("alpha");
  });

  it("devolve vazio quando nada sobrevive ao filtro", () => {
    expect(extractSearchTerms("o de a e")).toEqual([]);
    expect(extractSearchTerms("???")).toEqual([]);
  });

  it("comportamento conhecido: siglas de 3 letras são descartadas", () => {
    // Documenta uma limitação real, não um acerto: "NFe", "ISS", "CPF" somem
    // do fallback. Só afeta o caminho textual (a busca semântica continua).
    // Se o domínio fiscal passar a depender disso, revisar o piso de 4 chars.
    expect(extractSearchTerms("emitir NFe hoje")).toEqual(["emitir", "hoje"]);
  });

  it("comportamento conhecido: 'R$100' vira o termo 'r100'", () => {
    // O `$` some, mas o `r` fica colado no número — o termo buscado é "r100",
    // que só casa em conteúdo escrito exatamente como "R$100". Se a base
    // escrever "R$ 100" (com espaço), o fallback não acha.
    expect(extractSearchTerms("custa R$100 mensais")).toEqual([
      "custa",
      "r100",
      "mensais",
    ]);

    // Com espaço, o "100" isolado tem 3 chars e é descartado:
    expect(extractSearchTerms("custa R$ 100 mensais")).toEqual(["custa", "mensais"]);
  });
});

describe("scoreKeywordMatch", () => {
  it("conta quantos termos aparecem no conteúdo", () => {
    const conteudo = "O plano Essencial custa R$ 100 por mês.";

    expect(scoreKeywordMatch(conteudo, ["plano", "essencial"])).toBe(2);
    expect(scoreKeywordMatch(conteudo, ["plano", "inexistente"])).toBe(1);
    expect(scoreKeywordMatch(conteudo, ["inexistente"])).toBe(0);
  });

  it("ignora acento e caixa do conteúdo", () => {
    // O termo já vem normalizado do extractSearchTerms; o conteúdo, não.
    expect(scoreKeywordMatch("Preço do Plano MENSAL", ["preco", "mensal"])).toBe(2);
  });

  it("casa termo dentro de palavra maior", () => {
    // Substring, não palavra inteira: "plano" casa em "planos".
    expect(scoreKeywordMatch("temos vários planos", ["plano"])).toBe(1);
  });

  it("não conta o mesmo termo duas vezes", () => {
    // A pontuação é "quantos termos bateram", não "quantas ocorrências".
    expect(scoreKeywordMatch("plano plano plano", ["plano"])).toBe(1);
  });

  it("sem termos, pontuação zero", () => {
    expect(scoreKeywordMatch("qualquer conteúdo", [])).toBe(0);
  });
});

describe("fallback — ranqueamento ponta a ponta", () => {
  it("chunk com mais termos da pergunta pontua mais", () => {
    const pergunta = "qual o valor do plano essencial?";
    const termos = extractSearchTerms(pergunta);

    const relevante = "O plano Essencial custa R$ 100. Esse é o valor mensal.";
    const irrelevante = "Nosso horário de atendimento é das 9h às 18h.";

    const scoreRelevante = scoreKeywordMatch(relevante, termos);
    const scoreIrrelevante = scoreKeywordMatch(irrelevante, termos);

    expect(scoreRelevante).toBeGreaterThan(scoreIrrelevante);
    expect(scoreIrrelevante).toBe(0);
  });

  it("similarity é normalizada pelo total de termos (0..1)", () => {
    // O matchKnowledge usa `keywordScore / terms.length` e descarta score 0.
    const termos = extractSearchTerms("valor plano essencial");
    const score = scoreKeywordMatch("o plano essencial tem esse valor", termos);

    expect(score / termos.length).toBe(1);
  });
});
