// Isolamento entre organizações — o coração do multi-tenant (PD-06).
//
// Alice é da org A, Dan é da org B. Nenhum dos dois pode ver nem tocar no que é
// do outro. Cada teste afirma os DOIS lados: que o estranho não vê, e que o dono
// vê. Só o primeiro passaria num banco quebrado; o par prova que a policy filtra,
// em vez de simplesmente bloquear tudo.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asUser, idsOf } from "./setup/rls";
import { IDS } from "./setup/fixtures";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

describe("agentes", () => {
  it("cada org vê o próprio agente e não o da outra", async () => {
    const daAlice = await asUser(IDS.alice, (c) =>
      idsOf(c, "select id from public.agents where organization_id = $1", [IDS.orgA])
    );
    const doDan = await asUser(IDS.dan, (c) =>
      idsOf(c, "select id from public.agents where organization_id = $1", [IDS.orgA])
    );

    expect(daAlice).toEqual([IDS.agentA]);
    expect(doDan).toEqual([]); // org B não enxerga agente da org A
  });

  it("o prompt_base do agente da outra org não vaza", async () => {
    // O prompt_base é o ativo do produto — foi o que o PD-17 expôs.
    const linhas = await asUser(IDS.dan, async (c) => {
      const { rows } = await c.query("select prompt_base from public.agents where id = $1", [IDS.agentA]);
      return rows;
    });

    expect(linhas).toEqual([]);
  });

  it("não dá para criar agente numa org de que não se é membro", async () => {
    await expect(
      asUser(IDS.dan, (c) =>
        c.query(
          `insert into public.agents (slug, nome, prompt_base, organization_id)
           values ('invasor', 'Invasor', 'x', $1)`,
          [IDS.orgA]
        )
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("não dá para alterar agente de outra org", async () => {
    // UPDATE sem permissão não estoura: a linha simplesmente não é visível, e o
    // update afeta 0 linhas. É por isso que se afirma o rowCount, não o erro.
    const afetadas = await asUser(IDS.dan, async (c) => {
      const r = await c.query("update public.agents set nome = 'sequestrado' where id = $1", [IDS.agentA]);
      return r.rowCount;
    });

    expect(afetadas).toBe(0);
  });

  it("não dá para apagar agente de outra org", async () => {
    const afetadas = await asUser(IDS.dan, async (c) => {
      const r = await c.query("delete from public.agents where id = $1", [IDS.agentA]);
      return r.rowCount;
    });

    expect(afetadas).toBe(0);
  });
});

describe("conhecimento", () => {
  it("espaços, documentos e chunks não cruzam a fronteira da org", async () => {
    const visto = await asUser(IDS.dan, async (c) => ({
      spaces: await idsOf(c, "select id from public.knowledge_spaces where organization_id = $1", [IDS.orgA]),
      docs: await idsOf(c, "select id from public.knowledge_documents where organization_id = $1", [IDS.orgA]),
      chunks: await idsOf(c, "select id from public.knowledge_chunks where organization_id = $1", [IDS.orgA]),
    }));

    expect(visto).toEqual({ spaces: [], docs: [], chunks: [] });
  });

  it("e o dono continua vendo o que é dele", async () => {
    const visto = await asUser(IDS.alice, async (c) => ({
      spaces: await idsOf(c, "select id from public.knowledge_spaces where organization_id = $1", [IDS.orgA]),
      docs: await idsOf(c, "select id from public.knowledge_documents where organization_id = $1", [IDS.orgA]),
      chunks: await idsOf(c, "select id from public.knowledge_chunks where organization_id = $1", [IDS.orgA]),
    }));

    expect(visto).toEqual({ spaces: [IDS.spaceA], docs: [IDS.docA], chunks: [IDS.chunkA] });
  });

  it("o conteúdo do chunk da outra org não vaza", async () => {
    // O chunk é o texto bruto da base de conhecimento: o vazamento mais direto.
    const linhas = await asUser(IDS.dan, async (c) => {
      const { rows } = await c.query("select content from public.knowledge_chunks where content like '%org A%'");
      return rows;
    });

    expect(linhas).toEqual([]);
  });

  it("não dá para injetar conhecimento na org alheia", async () => {
    await expect(
      asUser(IDS.dan, (c) =>
        c.query(
          `insert into public.knowledge_documents (agent_id, titulo, scope, organization_id)
           values ($1, 'injetado', 'global', $2)`,
          [IDS.agentA, IDS.orgA]
        )
      )
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("conversas", () => {
  it("conversa de outra org é invisível", async () => {
    const vistas = await asUser(IDS.dan, (c) => idsOf(c, "select id from public.conversations"));
    expect(vistas).toEqual([]);
  });

  it("mensagem de conversa de outra org é invisível", async () => {
    const vistas = await asUser(IDS.dan, (c) => idsOf(c, "select id from public.messages"));
    expect(vistas).toEqual([]);
  });
});
