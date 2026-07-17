// Acesso por PARTICIPANTE, não por dono — a origem do PD-05.
//
// A Era 1 do produto autorizava por `conversations.user_id = auth.uid()`: só o
// dono. Quando a conversa virou multi-participante, sobraram checagens por dono
// espalhadas — o retry dava 404 para o convidado que acabara de conversar ali.
//
// O cenário: Alice é dona da conversa, Bob é participante convidado, Carol é da
// MESMA organização mas não foi convidada. Carol é a peça que importa: sem ela,
// um teste passaria mesmo se a policy filtrasse só por org.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asUser, idsOf } from "./setup/rls";
import { IDS } from "./setup/fixtures";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

describe("participante convidado (Bob)", () => {
  it("enxerga a conversa da qual participa, sem ser dono", async () => {
    const vistas = await asUser(IDS.bob, (c) => idsOf(c, "select id from public.conversations"));
    expect(vistas).toEqual([IDS.convA]);
  });

  it("não é o dono da conversa — o acesso não vem daí", async () => {
    // Prova que o teste acima não passou por acidente de titularidade.
    const dono = await asUser(IDS.alice, async (c) => {
      const { rows } = await c.query<{ user_id: string }>(
        "select user_id from public.conversations where id = $1", [IDS.convA]
      );
      return rows[0].user_id;
    });

    expect(dono).toBe(IDS.alice);
    expect(dono).not.toBe(IDS.bob);
  });

  it("lê as mensagens da conversa", async () => {
    const vistas = await asUser(IDS.bob, (c) => idsOf(c, "select id from public.messages"));
    expect(vistas).toEqual([IDS.msgA]);
  });

  it("escreve mensagem na conversa", async () => {
    // É o que o convidado faz o tempo todo: conversar. Se isto falhar, o produto
    // não funciona para ele.
    const inseridas = await asUser(IDS.bob, async (c) => {
      const r = await c.query(
        `insert into public.messages (conversation_id, role, content, user_id)
         values ($1, 'user', 'oi, sou o Bob', $2)`,
        [IDS.convA, IDS.bob]
      );
      return r.rowCount;
    });

    expect(inseridas).toBe(1);
  });

  it("enxerga os participantes da conversa", async () => {
    const vistos = await asUser(IDS.bob, async (c) => {
      const { rows } = await c.query<{ user_id: string }>(
        "select user_id from public.conversation_participants where conversation_id = $1", [IDS.convA]
      );
      return rows.map((r) => r.user_id).sort();
    });

    expect(vistos).toEqual([IDS.alice, IDS.bob].sort());
  });
});

describe("membro da mesma org que NÃO participa (Carol)", () => {
  // Carol é a peça central: mesma org da Alice, mas fora da conversa. Sem ela,
  // uma policy que filtrasse só por organização passaria por participante.
  it("não enxerga a conversa", async () => {
    const vistas = await asUser(IDS.carol, (c) => idsOf(c, "select id from public.conversations"));
    expect(vistas).toEqual([]);
  });

  it("não lê as mensagens", async () => {
    const vistas = await asUser(IDS.carol, (c) => idsOf(c, "select id from public.messages"));
    expect(vistas).toEqual([]);
  });

  it("não escreve na conversa alheia", async () => {
    await expect(
      asUser(IDS.carol, (c) =>
        c.query(
          `insert into public.messages (conversation_id, role, content, user_id)
           values ($1, 'user', 'entrei sem ser convidada', $2)`,
          [IDS.convA, IDS.carol]
        )
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("não enxerga os participantes", async () => {
    const vistos = await asUser(IDS.carol, async (c) => {
      const { rows } = await c.query("select user_id from public.conversation_participants");
      return rows;
    });

    expect(vistos).toEqual([]);
  });

  it("estar na mesma org não basta — mas ela ESTÁ na mesma org", async () => {
    // Fecha o argumento: Carol enxerga o agente da org A, então o vínculo com a
    // organização existe e está funcionando. O que a barra da conversa é a
    // ausência de participação, não a falta de org.
    const agentes = await asUser(IDS.carol, (c) =>
      idsOf(c, "select id from public.agents where organization_id = $1", [IDS.orgA])
    );

    expect(agentes).toEqual([IDS.agentA]);
  });
});
