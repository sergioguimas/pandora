import { describe, expect, it } from "vitest";
import {
  findTargetAgent,
  shouldIncludeHistoryMessageForAgent,
  tryParseAgentAction,
  type RuntimeAgent,
} from "@/server/services/ai/orchestrate-conversation";
import type { Message } from "@/server/services/ai/runtime";

function msg(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    conversation_id: "c1",
    user_id: "u1",
    role: "user",
    content: "oi",
    metadata: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const base = {
  currentAgentId: "agent-1",
  currentUserMessageId: "msg-atual",
  isMultiAgentChain: false,
};

describe("shouldIncludeHistoryMessageForAgent — higiene do histórico", () => {
  it("exclui a mensagem atual do usuário (já entra no fim do prompt)", () => {
    const incluir = shouldIncludeHistoryMessageForAgent({
      ...base,
      message: msg({ id: "msg-atual", role: "user" }),
    });

    expect(incluir).toBe(false);
  });

  it("inclui mensagens anteriores do usuário", () => {
    expect(
      shouldIncludeHistoryMessageForAgent({
        ...base,
        message: msg({ id: "m-antiga", role: "user" }),
      })
    ).toBe(true);
  });

  it.each(["failed", "partial", "superseded", "streaming"])(
    "exclui mensagem com status %s",
    (status) => {
      const incluir = shouldIncludeHistoryMessageForAgent({
        ...base,
        message: msg({
          id: "m-ruim",
          role: "assistant",
          metadata: { status, agent_id: "agent-1" },
        }),
      });

      // Realimentar uma resposta falha/truncada envenena a próxima rodada.
      expect(incluir).toBe(false);
    }
  );

  it("exclui mensagens de sistema (ex.: avisos de chamada de agente)", () => {
    expect(
      shouldIncludeHistoryMessageForAgent({
        ...base,
        message: msg({ id: "m-sys", role: "system", content: "X chamou Y" }),
      })
    ).toBe(false);
  });
});

describe("shouldIncludeHistoryMessageForAgent — isolamento entre agentes", () => {
  const respostaDeOutroAgente = msg({
    id: "m-outro",
    role: "assistant",
    metadata: { status: "completed", agent_id: "agent-2" },
  });

  const respostaDoMesmoAgente = msg({
    id: "m-meu",
    role: "assistant",
    metadata: { status: "completed", agent_id: "agent-1" },
  });

  it("agente único: mantém só as próprias respostas anteriores", () => {
    expect(
      shouldIncludeHistoryMessageForAgent({
        ...base,
        message: respostaDoMesmoAgente,
      })
    ).toBe(true);

    // Evita que um agente assuma como sua a informação de outro.
    expect(
      shouldIncludeHistoryMessageForAgent({
        ...base,
        message: respostaDeOutroAgente,
      })
    ).toBe(false);
  });

  it("cadeia: descarta TODA resposta antiga de assistente, inclusive a própria", () => {
    // Em cadeia, o contexto da rodada atual já vem via chainContext. Reaproveitar
    // rodadas antigas é o que fazia um agente citar valores de outro.
    expect(
      shouldIncludeHistoryMessageForAgent({
        ...base,
        isMultiAgentChain: true,
        message: respostaDoMesmoAgente,
      })
    ).toBe(false);

    expect(
      shouldIncludeHistoryMessageForAgent({
        ...base,
        isMultiAgentChain: true,
        message: respostaDeOutroAgente,
      })
    ).toBe(false);
  });

  it("cadeia: mensagens do usuário continuam passando", () => {
    expect(
      shouldIncludeHistoryMessageForAgent({
        ...base,
        isMultiAgentChain: true,
        message: msg({ id: "m-antiga", role: "user" }),
      })
    ).toBe(true);
  });
});

describe("tryParseAgentAction", () => {
  it("extrai a chamada de agente do fim da resposta", () => {
    const acao = tryParseAgentAction(
      'Preciso do financeiro.\n{"action":"call_agent","agent":"Financeiro","reason":"valores"}'
    );

    expect(acao).toEqual({
      action: "call_agent",
      agent: "Financeiro",
      reason: "valores",
    });
  });

  it("aceita chamada sem motivo", () => {
    const acao = tryParseAgentAction('{"action":"call_agent","agent":"Suporte"}');

    expect(acao?.agent).toBe("Suporte");
    expect(acao?.reason).toBeUndefined();
  });

  it("devolve null para texto sem JSON", () => {
    expect(tryParseAgentAction("Resposta normal, sem chamada.")).toBeNull();
  });

  it("devolve null para JSON malformado (não pode derrubar a rodada)", () => {
    expect(tryParseAgentAction('{"action":"call_agent",,,}')).toBeNull();
  });

  it("ignora JSON de outra ação ou sem nome de agente", () => {
    expect(tryParseAgentAction('{"action":"outra_coisa","agent":"X"}')).toBeNull();
    expect(tryParseAgentAction('{"action":"call_agent","agent":"   "}')).toBeNull();
  });
});

describe("findTargetAgent", () => {
  const agentes: RuntimeAgent[] = [
    {
      id: "agent-1",
      nome: "Consultor Comercial",
      descricao: "Vendas",
      prompt_base: "",
      provider: "gemini",
      model: "gemini-2.5-flash",
      temperature: 0.7,
      max_history_messages: 12,
    },
    {
      id: "agent-2",
      nome: "Valores Secullum Ponto",
      descricao: "Tabela de preços",
      prompt_base: "",
      provider: "gemini",
      model: "gemini-2.5-flash",
      temperature: 0.7,
      max_history_messages: 12,
    },
  ];

  it("encontra por nome exato", () => {
    const alvo = findTargetAgent({
      requestedAgent: "Valores Secullum Ponto",
      availableAgents: agentes,
      currentAgentId: "agent-1",
    });

    expect(alvo?.id).toBe("agent-2");
  });

  it("encontra por nome parcial e sem acento/caixa", () => {
    expect(
      findTargetAgent({
        requestedAgent: "valores",
        availableAgents: agentes,
        currentAgentId: "agent-1",
      })?.id
    ).toBe("agent-2");
  });

  it("encontra pela descrição", () => {
    expect(
      findTargetAgent({
        requestedAgent: "tabela de preços",
        availableAgents: agentes,
        currentAgentId: "agent-1",
      })?.id
    ).toBe("agent-2");
  });

  it("nunca devolve o próprio agente (evita laço)", () => {
    const alvo = findTargetAgent({
      requestedAgent: "Consultor Comercial",
      availableAgents: agentes,
      currentAgentId: "agent-1",
    });

    expect(alvo).toBeNull();
  });

  it("devolve null para agente inexistente (não inventa)", () => {
    expect(
      findTargetAgent({
        requestedAgent: "Jurídico",
        availableAgents: agentes,
        currentAgentId: "agent-1",
      })
    ).toBeNull();
  });
});
