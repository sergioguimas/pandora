// Os três escopos de conhecimento são inseríveis, e o `space` exige um espaço.
//
// Este arquivo não é sobre RLS — é sobre INTEGRIDADE (as CHECK constraints).
// Mora aqui porque o harness é o mesmo: um Postgres com o schema real aplicado.
//
// Existe por causa do PD-23: `scope='space'` era rejeitado por uma constraint
// que a migration dos espaços esqueceu de atualizar, e o bug sobreviveu ~3 meses
// porque nada exercitava a combinação. A UI oferecia a opção; o banco recusava.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asOwner } from "./setup/rls";
import { IDS } from "./setup/fixtures";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

// Como `postgres`: aqui a pergunta é o que a CONSTRAINT aceita, não quem pode
// escrever — isso é o resto da suíte que prova.
const insertDoc = (fields: Record<string, unknown>) =>
  asOwner(async (c) => {
    const base = {
      agent_id: IDS.agentA,
      titulo: "doc de teste",
      organization_id: IDS.orgA,
      conversation_id: null,
      knowledge_space_id: null,
      ...fields,
    };
    const cols = Object.keys(base);
    const vals = cols.map((_, i) => `$${i + 1}`);
    const r = await c.query(
      `insert into public.knowledge_documents (${cols.join(", ")}) values (${vals.join(", ")})`,
      Object.values(base)
    );
    return r.rowCount;
  });

describe("os três escopos são inseríveis", () => {
  it("`global` — conhecimento do agente, sem conversa", async () => {
    await expect(insertDoc({ scope: "global" })).resolves.toBe(1);
  });

  it("`space` — conhecimento do espaço, com espaço", async () => {
    // ESTE é o teste do PD-23. Antes da migration `20260717000000`, esta linha
    // batia em `knowledge_documents_scope_conversation_check` e o RAG de espaço
    // era código morto, apesar de a UI oferecer a opção.
    await expect(
      insertDoc({ scope: "space", knowledge_space_id: IDS.spaceA })
    ).resolves.toBe(1);
  });

  it("`conversation` — conhecimento da conversa, com conversa", async () => {
    await expect(
      insertDoc({ scope: "conversation", conversation_id: IDS.convA })
    ).resolves.toBe(1);
  });
});

describe("o invariante do conversation_id", () => {
  it("`conversation` sem conversa é rejeitado", async () => {
    await expect(insertDoc({ scope: "conversation" })).rejects.toThrow(
      /knowledge_documents_scope_conversation_check/
    );
  });

  it("`global` COM conversa é rejeitado", async () => {
    // O outro lado da equivalência. Um doc `global` amarrado a uma conversa é
    // contraditório: o RAG o traria para todas as conversas do agente.
    await expect(
      insertDoc({ scope: "global", conversation_id: IDS.convA })
    ).rejects.toThrow(/knowledge_documents_scope_conversation_check/);
  });

  it("`space` COM conversa é rejeitado", async () => {
    await expect(
      insertDoc({ scope: "space", knowledge_space_id: IDS.spaceA, conversation_id: IDS.convA })
    ).rejects.toThrow(/knowledge_documents_scope_conversation_check/);
  });
});

describe("o invariante do espaço (PD-23)", () => {
  it("`space` SEM espaço é rejeitado", async () => {
    // Sem `knowledge_space_id`, o RPC nunca acha o chunk (ele casa por
    // `kc.knowledge_space_id = p_knowledge_space_id`). Seria dado fantasma:
    // ingerido, chunkado, embeddado — e invisível. É a doença do PD-15, agora
    // barrada pelo banco em vez de depender da validação do server action.
    await expect(insertDoc({ scope: "space" })).rejects.toThrow(
      /knowledge_documents_space_requires_space_id/
    );
  });

  it("um scope desconhecido continua rejeitado", async () => {
    // A constraint nova não enumera escopos, então é o `scope_check` ao lado que
    // guarda o enum. Fecha o par: um não cobre o buraco do outro.
    await expect(insertDoc({ scope: "inventado" })).rejects.toThrow(
      /knowledge_documents_scope_check/
    );
  });
});

describe("chunks seguem as mesmas regras", () => {
  // As duas tabelas carregam constraints gêmeas. O PD-23 nasceu de uma delas
  // divergir da outra, então testar só uma seria repetir o erro.
  const insertChunk = (fields: Record<string, unknown>) =>
    asOwner(async (c) => {
      const base = {
        document_id: IDS.docA,
        agent_id: IDS.agentA,
        chunk_index: 99,
        content: "conteúdo",
        organization_id: IDS.orgA,
        conversation_id: null,
        knowledge_space_id: null,
        ...fields,
      };
      const cols = Object.keys(base);
      const vals = cols.map((_, i) => `$${i + 1}`);
      const r = await c.query(
        `insert into public.knowledge_chunks (${cols.join(", ")}) values (${vals.join(", ")})`,
        Object.values(base)
      );
      return r.rowCount;
    });

  it("`space` com espaço é aceito", async () => {
    await expect(
      insertChunk({ scope: "space", knowledge_space_id: IDS.spaceA })
    ).resolves.toBe(1);
  });

  it("`space` sem espaço é rejeitado", async () => {
    await expect(insertChunk({ scope: "space" })).rejects.toThrow(
      /knowledge_chunks_space_requires_space_id/
    );
  });

  it("`conversation` sem conversa é rejeitado", async () => {
    await expect(insertChunk({ scope: "conversation" })).rejects.toThrow(
      /knowledge_chunks_scope_conversation_check/
    );
  });
});
