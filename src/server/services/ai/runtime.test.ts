import { describe, expect, it } from "vitest";
import {
  classifyModelError,
  isProbablyIncompleteAnswer,
  removeActionJson,
  withRetryBeforeStreaming,
  withTimeout,
} from "@/server/services/ai/runtime";

describe("isProbablyIncompleteAnswer — respostas completas", () => {
  it("não acusa resposta curta que termina de forma conclusiva (PD-19)", () => {
    // O caso do bug: antes, QUALQUER resposta < 40 chars virava `partial`,
    // disparava aviso e mostrava "tentar novamente" ao usuário.
    expect(isProbablyIncompleteAnswer("Sim, o plano custa R$ 100.")).toBe(false);
    expect(isProbablyIncompleteAnswer("Não temos esse dado.")).toBe(false);
    expect(isProbablyIncompleteAnswer("Claro!")).toBe(false);
    expect(isProbablyIncompleteAnswer("Qual plano você quer comparar?")).toBe(false);
  });

  it("não acusa resposta longa e bem formada", () => {
    expect(
      isProbablyIncompleteAnswer(
        "O plano Essencial custa R$ 100 por mês e inclui suporte comercial."
      )
    ).toBe(false);
  });

  it("aceita markdown balanceado", () => {
    expect(
      isProbablyIncompleteAnswer(
        "O plano **Essencial** custa R$ 100 por mês, com suporte incluso."
      )
    ).toBe(false);
  });
});

describe("isProbablyIncompleteAnswer — respostas truncadas", () => {
  it("acusa vazio", () => {
    expect(isProbablyIncompleteAnswer("")).toBe(true);
    expect(isProbablyIncompleteAnswer("   ")).toBe(true);
  });

  it("acusa resposta curta cortada no meio, sem pontuação", () => {
    // O piso de 40 chars ainda protege — só que agora exige o segundo sinal.
    expect(isProbablyIncompleteAnswer("O plano Essencial")).toBe(true);
  });

  it("acusa terminação pendurada", () => {
    expect(
      isProbablyIncompleteAnswer(
        "Seguem os valores atualizados de cada plano disponível: R$"
      )
    ).toBe(true);

    expect(
      isProbablyIncompleteAnswer(
        "| Plano | Valor |\n| --- | --- |\n| Essencial | R$ 100 |\n|"
      )
    ).toBe(true);
  });

  it("acusa markdown desbalanceado mesmo em resposta longa", () => {
    expect(
      isProbablyIncompleteAnswer(
        "Segue a tabela completa com todos os valores que voce pediu **Essencial"
      )
    ).toBe(true);

    expect(
      isProbablyIncompleteAnswer(
        "Segue o exemplo de configuracao para o seu caso de uso:\n```json\n{ }"
      )
    ).toBe(true);
  });
});

describe("classifyModelError", () => {
  it("503 e sobrecarga são retryable", () => {
    const porStatus = classifyModelError(
      Object.assign(new Error("boom"), { status: 503 })
    );
    expect(porStatus.code).toBe("MODEL_TEMPORARILY_UNAVAILABLE");
    expect(porStatus.retryable).toBe(true);

    const porMensagem = classifyModelError(new Error("model is overloaded"));
    expect(porMensagem.code).toBe("MODEL_TEMPORARILY_UNAVAILABLE");
  });

  it("429 vira rate limit retryable", () => {
    const erro = classifyModelError(
      Object.assign(new Error("too many"), { status: 429 })
    );
    expect(erro.code).toBe("MODEL_RATE_LIMITED");
    expect(erro.retryable).toBe(true);
  });

  it("timeout é retryable", () => {
    expect(classifyModelError(new Error("Tempo limite excedido.")).code).toBe(
      "MODEL_TIMEOUT"
    );
    expect(
      classifyModelError(Object.assign(new Error("x"), { name: "AbortError" })).code
    ).toBe("MODEL_TIMEOUT");
  });

  it("erro desconhecido NÃO é retryable e preserva a mensagem", () => {
    const erro = classifyModelError(new Error("prompt bloqueado por safety"));

    expect(erro.code).toBe("MODEL_UNKNOWN_ERROR");
    expect(erro.retryable).toBe(false);
    expect(erro.message).toBe("prompt bloqueado por safety");
  });
});

describe("withRetryBeforeStreaming", () => {
  // delaysMs zerado para não pagar os 800/2000ms reais no teste.
  const semEspera = { retries: 2, delaysMs: [0, 0] };

  it("não retenta quando dá certo de primeira", async () => {
    let calls = 0;

    const resultado = await withRetryBeforeStreaming(async () => {
      calls += 1;
      return "ok";
    }, semEspera);

    expect(resultado).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retenta erro retryable e devolve o sucesso seguinte", async () => {
    let calls = 0;

    const resultado = await withRetryBeforeStreaming(async () => {
      calls += 1;
      if (calls < 3) {
        throw Object.assign(new Error("indisponível"), { status: 503 });
      }
      return "ok";
    }, semEspera);

    expect(resultado).toBe("ok");
    expect(calls).toBe(3);
  });

  it("NÃO retenta erro não-retryable — falha na primeira", async () => {
    let calls = 0;

    await expect(
      withRetryBeforeStreaming(async () => {
        calls += 1;
        throw new Error("prompt bloqueado por safety");
      }, semEspera)
    ).rejects.toThrow("prompt bloqueado por safety");

    // Reenviar um prompt bloqueado só queimaria cota.
    expect(calls).toBe(1);
  });

  it("desiste após esgotar as tentativas e propaga o último erro", async () => {
    let calls = 0;

    await expect(
      withRetryBeforeStreaming(async () => {
        calls += 1;
        throw Object.assign(new Error("rate limit"), { status: 429 });
      }, semEspera)
    ).rejects.toThrow("rate limit");

    // 1 tentativa + 2 retries
    expect(calls).toBe(3);
  });
});

describe("withTimeout", () => {
  it("passa o valor quando resolve a tempo", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });

  it("rejeita com a mensagem informada ao estourar", async () => {
    const lenta = new Promise((resolve) => setTimeout(resolve, 50));

    await expect(withTimeout(lenta, 1, "estourou")).rejects.toThrow("estourou");
  });
});

describe("removeActionJson", () => {
  it("remove o JSON de chamada de agente do texto exibido", () => {
    const texto =
      'Preciso de ajuda do financeiro.\n{"action":"call_agent","agent":"Financeiro","reason":"valores"}';

    expect(removeActionJson(texto)).toBe("Preciso de ajuda do financeiro.");
  });

  it("não mexe em texto sem o JSON", () => {
    expect(removeActionJson("Resposta normal.")).toBe("Resposta normal.");
  });

  it("preserva JSON que não seja call_agent", () => {
    const texto = 'Exemplo de payload: {"chave":"valor"}';

    expect(removeActionJson(texto)).toBe(texto);
  });
});
