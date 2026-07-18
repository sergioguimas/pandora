import { describe, expect, it } from "vitest";
import {
  orchestrateConversation,
  type OrchestrationEvent,
  type OrchestratorDeps,
  type RuntimeAgent,
} from "@/server/services/ai/orchestrate-conversation";
import type { Message } from "@/server/services/ai/runtime";

// Estes testes exercitam a rodada inteira (cadeia de agentes, síntese, erro do
// provedor) sem subir request HTTP, sem banco e sem chamar o Gemini — é o que o
// PD-07 destravou ao tirar a orquestração de dentro do route handler.

function makeAgent(overrides: Partial<RuntimeAgent> = {}): RuntimeAgent {
  return {
    id: "agent-1",
    slug: "agente-1",
    nome: "Agente Um",
    descricao: "Primeiro agente",
    prompt_base: "Você é o agente um.",
    provider: "gemini",
    model: "gemini-2.5-flash",
    temperature: 0.7,
    max_history_messages: 12,
    knowledge_space_id: null,
    ordem: 1,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-user-1",
    conversation_id: "conv-1",
    user_id: "user-1",
    role: "user",
    content: "quanto custa o plano?",
    metadata: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Transforma texto em um stream de tokens, como o Gemini faria. */
async function* tokenStream(chunks: string[]) {
  for (const text of chunks) {
    yield { text };
  }
}

// Precisa ter >= 40 chars e marcação balanceada, senão `isProbablyIncompleteAnswer`
// classifica como truncada e a rodada emite um `agent_warning` a mais.
const RESPOSTA_OK = [
  "O plano Essencial custa R$ 100 por mês ",
  "e inclui suporte durante o horário comercial.",
];

type DepsOverrides = Partial<OrchestratorDeps>;

function makeDeps(overrides: DepsOverrides = {}): OrchestratorDeps {
  const saved: Message[] = [];

  return {
    getHistory: async () => [],
    listAgents: async () => [makeAgent()],
    getFallbackAgent: async () => null,
    generateQueryEmbedding: async () => [0.1, 0.2, 0.3],
    matchKnowledge: async () => [],
    saveMessage: async (params) => {
      const message = makeMessage({
        id: `msg-assistant-${saved.length + 1}`,
        user_id: params.userId ?? null,
        role: params.role,
        content: params.content,
        metadata: (params.metadata ?? null) as Message["metadata"],
      });

      saved.push(message);
      return message;
    },
    streamModel: async () => tokenStream(RESPOSTA_OK),
    ...overrides,
  };
}

async function collect(deps: OrchestratorDeps): Promise<OrchestrationEvent[]> {
  const events: OrchestrationEvent[] = [];

  for await (const event of orchestrateConversation(
    {
      conversationId: "conv-1",
      content: "quanto custa o plano?",
      savedUserMessage: makeMessage(),
    },
    deps
  )) {
    events.push(event);
  }

  return events;
}

const typesOf = (events: OrchestrationEvent[]) => events.map((e) => e.type);

describe("orchestrateConversation — agente único", () => {
  it("emite saved_user, tokens e final, sem plano de orquestração", async () => {
    const events = await collect(makeDeps());

    expect(typesOf(events)).toEqual(["saved_user", "token", "token", "final"]);
    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "orchestration_plan" })
    );
  });

  it("persiste a resposta como completed e não-retryable", async () => {
    const events = await collect(makeDeps());
    const final = events.find((e) => e.type === "final");

    const metadata = (final as { message: Message }).message.metadata as Record<
      string,
      unknown
    >;

    expect(metadata.status).toBe("completed");
    expect(metadata.retryable).toBe(false);
    expect(metadata.original_user_message_id).toBe("msg-user-1");
  });

  it("usa o agente principal quando a conversa não tem agentes vinculados", async () => {
    const events = await collect(
      makeDeps({
        listAgents: async () => [],
        getFallbackAgent: async () => makeAgent({ nome: "Principal" }),
      })
    );

    expect(typesOf(events)).toContain("final");
    expect(typesOf(events)).not.toContain("error");
  });

  it("emite error quando não há nenhum agente disponível", async () => {
    const events = await collect(
      makeDeps({ listAgents: async () => [], getFallbackAgent: async () => null })
    );

    expect(typesOf(events)).toEqual(["saved_user", "error"]);
  });
});

describe("orchestrateConversation — cadeia multi-agente", () => {
  const doisAgentes = () =>
    makeDeps({
      listAgents: async () => [
        makeAgent({ id: "agent-1", nome: "Agente Um", ordem: 1 }),
        makeAgent({ id: "agent-2", nome: "Agente Dois", ordem: 2 }),
      ],
    });

  it("anuncia o plano e roda a síntese ao final", async () => {
    const events = await collect(doisAgentes());

    expect(typesOf(events)[0]).toBe("saved_user");
    expect(typesOf(events)[1]).toBe("orchestration_plan");

    const finais = events.filter((e) => e.type === "final");

    // um final por agente + um da síntese
    expect(finais).toHaveLength(3);

    const sintese = finais[2] as { message: Message };
    const metadata = sintese.message.metadata as Record<string, unknown>;

    expect(metadata.agent_id).toBe("pandora-synthesis");
    expect(
      (metadata.orchestration as Record<string, unknown>).mode
    ).toBe("synthesis");
  });

  it("não roda síntese quando só um agente respondeu", async () => {
    const events = await collect(makeDeps());

    const finais = events.filter((e) => e.type === "final");
    expect(finais).toHaveLength(1);
  });
});

describe("orchestrateConversation — falha do provedor", () => {
  it("classifica 503 como retryable e ainda persiste a mensagem", async () => {
    const events = await collect(
      makeDeps({
        streamModel: async () => {
          throw Object.assign(new Error("service unavailable"), { status: 503 });
        },
      })
    );

    const erro = events.find((e) => e.type === "agent_error") as
      | Extract<OrchestrationEvent, { type: "agent_error" }>
      | undefined;

    expect(erro?.code).toBe("MODEL_TEMPORARILY_UNAVAILABLE");
    expect(erro?.retryable).toBe(true);

    // A rodada não aborta: a falha vira mensagem persistida e retryable,
    // que é o que habilita o botão "tentar novamente" na UI.
    const final = events.find((e) => e.type === "final") as
      | { message: Message }
      | undefined;

    const metadata = final?.message.metadata as Record<string, unknown>;
    expect(metadata.status).toBe("failed");
    expect(metadata.retryable).toBe(true);
  });

  it("marca como partial quando o stream corta no meio", async () => {
    const events = await collect(
      makeDeps({
        streamModel: async () =>
          (async function* () {
            yield { text: "Começou a responder mas " };
            throw new Error("socket hang up");
          })(),
      })
    );

    const erro = events.find((e) => e.type === "agent_error") as
      | Extract<OrchestrationEvent, { type: "agent_error" }>
      | undefined;

    expect(erro?.code).toBe("MODEL_STREAM_INTERRUPTED");
    expect(erro?.partial).toBe(true);

    const final = events.find((e) => e.type === "final") as
      | { message: Message }
      | undefined;

    const metadata = final?.message.metadata as Record<string, unknown>;

    // Precedência do status: `failed` vence `partial`. Quando o stream corta com
    // exceção, houve falha E conteúdo parcial — o metadata registra "failed", e é
    // o campo `partial` do evento agent_error que carrega a nuance. O status
    // "partial" fica reservado para quando NÃO houve exceção e só a heurística
    // `isProbablyIncompleteAnswer` acusou truncamento (ver teste abaixo).
    expect(metadata.status).toBe("failed");
    expect(metadata.retryable).toBe(true);

    // O conteúdo parcial é preservado junto do aviso, em vez de descartado.
    expect(final?.message.content).toContain("Começou a responder mas");
  });

  it("não deixa falha da base de conhecimento derrubar a rodada", async () => {
    const events = await collect(
      makeDeps({
        matchKnowledge: async () => {
          throw new Error("pgvector fora do ar");
        },
      })
    );

    expect(typesOf(events)).toEqual(["saved_user", "token", "token", "final"]);
  });
});

describe("orchestrateConversation — modo de resposta (PD-10)", () => {
  /** Captura os `maxOutputTokens` de cada chamada ao modelo. */
  function spyTokens() {
    const calls: number[] = [];

    return {
      calls,
      streamModel: async (params: { maxOutputTokens: number }) => {
        calls.push(params.maxOutputTokens);
        return tokenStream(RESPOSTA_OK);
      },
    };
  }

  it("aplica o teto do modo configurado no agente", async () => {
    const spy = spyTokens();

    await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ modo_resposta: "alto" })],
        streamModel: spy.streamModel,
      })
    );

    expect(spy.calls).toEqual([8000]);
  });

  it("usa o padrão (2000) quando o agente não define modo", async () => {
    const spy = spyTokens();

    await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ modo_resposta: null })],
        streamModel: spy.streamModel,
      })
    );

    expect(spy.calls).toEqual([2000]);
  });

  it("cada agente da cadeia usa o próprio teto; a síntese segue o primeiro", async () => {
    const spy = spyTokens();

    await collect(
      makeDeps({
        listAgents: async () => [
          makeAgent({ id: "agent-1", nome: "Um", modo_resposta: "alto" }),
          makeAgent({ id: "agent-2", nome: "Dois", modo_resposta: "leve" }),
        ],
        streamModel: spy.streamModel,
      })
    );

    // agente 1 (alto), agente 2 (leve), síntese (segue o primeiro → alto)
    expect(spy.calls).toEqual([8000, 800, 8000]);
  });
});

describe("orchestrateConversation — chave do tenant (PD-26/27)", () => {
  /** Captura o `apiKey` de cada chamada ao modelo. */
  function spyApiKey() {
    const keys: Array<string | undefined> = [];
    return {
      keys,
      streamModel: async (params: { apiKey?: string }) => {
        keys.push(params.apiKey);
        return tokenStream(RESPOSTA_OK);
      },
    };
  }

  it("modo 'own': injeta a chave do tenant quando existe para o provider", async () => {
    const spy = spyApiKey();

    await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ provider: "gemini" })],
        getTenantApiKeys: async () => ({ keyMode: "own", keys: { gemini: "chave-do-tenant" } }),
        streamModel: spy.streamModel,
      })
    );

    expect(spy.keys).toEqual(["chave-do-tenant"]);
  });

  it("sem resolução (padrão), apiKey indefinido (plataforma)", async () => {
    const spy = spyApiKey();

    await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ provider: "gemini" })],
        // getTenantApiKeys ausente — o padrão antes do BYOK.
        streamModel: spy.streamModel,
      })
    );

    expect(spy.keys).toEqual([undefined]);
  });

  it("modo 'platform' IGNORA a chave da org (sempre plataforma)", async () => {
    // A decisão do PD-27: 'platform' = usa a chave da plataforma, mesmo que a org
    // tenha uma chave cadastrada. É como o preço do tier 'sistema' se sustenta.
    const spy = spyApiKey();

    await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ provider: "gemini" })],
        getTenantApiKeys: async () => ({ keyMode: "platform", keys: { gemini: "ignorada" } }),
        streamModel: spy.streamModel,
      })
    );

    expect(spy.keys).toEqual([undefined]);
  });

  it("modo 'own' SEM chave para o provider → erro claro, não-retryable", async () => {
    // Enforcement do PD-27: a org optou por trazer a própria chave e não
    // cadastrou a do provider do agente. Não pode rodar na conta da plataforma
    // em silêncio — falha com aviso, e reenviar não resolve.
    const spy = spyApiKey();

    const events = await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ provider: "gemini" })],
        getTenantApiKeys: async () => ({ keyMode: "own", keys: { openai: "so-openai" } }),
        streamModel: spy.streamModel,
      })
    );

    const erro = events.find((e) => e.type === "agent_error") as
      | Extract<OrchestrationEvent, { type: "agent_error" }>
      | undefined;

    expect(erro?.message).toContain("própria chave");
    expect(erro?.retryable).toBe(false);
    // O modelo nunca foi chamado — a falha é antes do streaming.
    expect(spy.keys).toEqual([]);
  });
});

describe("orchestrateConversation — provider do agente (PD-12)", () => {
  it("repassa o provider configurado no agente", async () => {
    const providers: string[] = [];

    await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ provider: "gemini" })],
        streamModel: async (params: { provider: string }) => {
          providers.push(params.provider);
          return tokenStream(RESPOSTA_OK);
        },
      })
    );

    // Antes do PD-12 o provider era ignorado: um agente 'openai' gerava com
    // Gemini em silêncio. Agora ele chega ao despacho.
    expect(providers).toEqual(["gemini"]);
  });

  it("provider sem implementação vira erro não-retryable, não fallback silencioso", async () => {
    const events = await collect(
      makeDeps({
        listAgents: async () => [makeAgent({ provider: "openai" })],
        // deps real: despacha de verdade e rejeita provider não implementado
        streamModel: (await import("@/server/services/ai/providers/stream"))
          .streamModel,
      })
    );

    const erro = events.find((e) => e.type === "agent_error") as
      | Extract<OrchestrationEvent, { type: "agent_error" }>
      | undefined;

    expect(erro?.message).toContain("não implementado");
    // Reenviar não resolveria — não faz sentido oferecer "tentar novamente".
    expect(erro?.retryable).toBe(false);
  });
});

describe("orchestrateConversation — resposta truncada", () => {
  it("avisa quando a resposta termina em marcação aberta", async () => {
    const events = await collect(
      makeDeps({
        // markdown com ** não fechado + termina em ':' → heurística acusa
        streamModel: async () =>
          tokenStream([
            "Segue a tabela de preços com todos os detalhes que voce pediu **Plano:",
          ]),
      })
    );

    const aviso = events.find((e) => e.type === "agent_warning") as
      | Extract<OrchestrationEvent, { type: "agent_warning" }>
      | undefined;

    expect(aviso?.code).toBe("MODEL_STREAM_INTERRUPTED");
    expect(aviso?.retryable).toBe(true);

    const final = events.find((e) => e.type === "final") as
      | { message: Message }
      | undefined;

    expect((final?.message.metadata as Record<string, unknown>).status).toBe(
      "partial"
    );
  });
});
