// Agentes universais: legíveis por qualquer org, read-only pelo app (PD-06b).
//
// O desenho escolhido não foi uma flag no agente, e sim uma ORGANIZAÇÃO DO
// SISTEMA. As duas metades caem de graça:
//   - leitura: `can_read_org()` = org do sistema OU membro → todos veem;
//   - escrita: `is_org_member()` → como a org do sistema não tem membros,
//     ninguém escreve nela pelo app. A ausência de membros É o mecanismo.
// O último teste deste arquivo trava justamente essa premissa: se alguém um dia
// adicionar um membro à org do sistema, o read-only cai em silêncio — e aqui
// passa a falhar alto.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asUser, asOwner, idsOf } from "./setup/rls";
import { IDS } from "./setup/fixtures";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

describe("leitura", () => {
  it("aparece para as duas organizações, sem clonagem", async () => {
    const paraAlice = await asUser(IDS.alice, (c) =>
      idsOf(c, "select id from public.agents where organization_id = $1", [IDS.orgSystem])
    );
    const paraDan = await asUser(IDS.dan, (c) =>
      idsOf(c, "select id from public.agents where organization_id = $1", [IDS.orgSystem])
    );

    expect(paraAlice).toEqual([IDS.agentUniversal]);
    expect(paraDan).toEqual([IDS.agentUniversal]);
  });

  it("cada org vê o universal + o seu, e nada mais", async () => {
    // A soma importa: se a org do sistema abrisse demais, o agente da org B
    // apareceria para a Alice aqui.
    const daAlice = await asUser(IDS.alice, (c) => idsOf(c, "select id from public.agents"));
    const doDan = await asUser(IDS.dan, (c) => idsOf(c, "select id from public.agents"));

    expect(daAlice).toEqual([IDS.agentA, IDS.agentUniversal].sort());
    expect(doDan).toEqual([IDS.agentB, IDS.agentUniversal].sort());
  });
});

describe("read-only pelo app", () => {
  it("ninguém altera o agente universal", async () => {
    for (const usuario of [IDS.alice, IDS.dan]) {
      const afetadas = await asUser(usuario, async (c) => {
        const r = await c.query("update public.agents set nome = 'sequestrado' where id = $1", [
          IDS.agentUniversal,
        ]);
        return r.rowCount;
      });
      expect(afetadas).toBe(0);
    }
  });

  it("ninguém apaga o agente universal", async () => {
    for (const usuario of [IDS.alice, IDS.dan]) {
      const afetadas = await asUser(usuario, async (c) => {
        const r = await c.query("delete from public.agents where id = $1", [IDS.agentUniversal]);
        return r.rowCount;
      });
      expect(afetadas).toBe(0);
    }
  });

  it("ninguém cria agente na org do sistema", async () => {
    await expect(
      asUser(IDS.alice, (c) =>
        c.query(
          `insert into public.agents (slug, nome, prompt_base, organization_id)
           values ('falso-universal', 'Falso Universal', 'x', $1)`,
          [IDS.orgSystem]
        )
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("ninguém injeta conhecimento `global` nos universais", async () => {
    // O risco concreto do PD-06b: se desse para escrever conhecimento na org do
    // sistema, uma org envenenaria o Agente 0 de todas as outras.
    await expect(
      asUser(IDS.dan, (c) =>
        c.query(
          `insert into public.knowledge_documents (agent_id, titulo, scope, organization_id)
           values ($1, 'veneno', 'global', $2)`,
          [IDS.agentUniversal, IDS.orgSystem]
        )
      )
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("a premissa do desenho", () => {
  it("a org do sistema não tem membros — é o que torna o universal read-only", async () => {
    // Se este teste falhar, o read-only dos universais caiu, mesmo que todos os
    // testes acima continuem verdes por outros motivos. A garantia não está numa
    // policy de escrita: está na ausência de membros.
    const membros = await asOwner(async (c) => {
      const { rows } = await c.query<{ n: string }>(
        "select count(*)::text as n from public.organization_members where organization_id = $1",
        [IDS.orgSystem]
      );
      return Number(rows[0].n);
    });

    expect(membros).toBe(0);
  });

  it("e a org do sistema está de fato marcada como is_system", async () => {
    const isSystem = await asOwner(async (c) => {
      const { rows } = await c.query<{ is_system: boolean }>(
        "select is_system from public.organizations where id = $1", [IDS.orgSystem]
      );
      return rows[0]?.is_system;
    });

    expect(isSystem).toBe(true);
  });
});
