// A chave de API do tenant é ilegível pela RLS — para todo mundo (PD-26).
//
// Aqui a régua é outra. No resto da suíte, um furo vaza CONTEÚDO. Nesta tabela,
// um furo vaza DINHEIRO: a chave é crédito, e a fatura é do cliente. Por isso a
// tabela não tem policy nenhuma — nem para o dono da organização.
//
// Não é esquecimento, é a decisão: o acesso mais fino que a RLS oferece é por
// LINHA, e o que precisamos negar é uma COLUNA (`chave_cifrada`). RLS é a
// ferramenta errada para isso. A resposta certa é não dar acesso nenhum e mediar
// no servidor, que lê pelo client admin e devolve só `provider` e `ultimos_4`.
// Mesma escolha do PD-09.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asOwner, asUser, asAnon } from "./setup/rls";
import { IDS } from "./setup/fixtures";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

// A org A JÁ TEM uma chave semeada nas fixtures (`seedFixtures`), de propósito.
//
// A primeira versão deste arquivo semeava a chave dentro de cada teste — e cada
// teste roda numa transação que termina em rollback, então a linha era desfeita
// antes da asserção. Os testes de "ninguém lê a chave" passavam NO VAZIO: não
// havia chave para ler. Só apareceu porque os testes de duplicata e de delete
// falharam e denunciaram o helper.
//
// Fica o registro porque é o vício que este projeto persegue desde o PD-22:
// verde que não podia ser vermelho não prova nada.
const chaveExiste = () =>
  asOwner(async (c) => {
    const { rows } = await c.query<{ n: string }>(
      "select count(*)::text as n from public.organization_provider_keys where organization_id = $1",
      [IDS.orgA]
    );
    return Number(rows[0].n);
  });

describe("a tabela é fail-closed", () => {
  it("não tem policy nenhuma — de propósito", async () => {
    const policies = await asOwner(async (c) => {
      const { rows } = await c.query<{ policyname: string }>(
        `select policyname from pg_policies
          where schemaname = 'public' and tablename = 'organization_provider_keys'`
      );
      return rows.map((r) => r.policyname);
    });

    expect(policies).toEqual([]);
  });

  it("mas tem RLS habilitada — sem isso, 'sem policy' significaria acesso livre", async () => {
    // A dupla que importa: RLS ligada + zero policies = ninguém entra. RLS
    // desligada + zero policies = todo mundo entra. A diferença é tudo.
    const ligada = await asOwner(async (c) => {
      const { rows } = await c.query<{ relrowsecurity: boolean }>(
        `select c.relrowsecurity from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'organization_provider_keys'`
      );
      return rows[0]?.relrowsecurity;
    });

    expect(ligada).toBe(true);
  });
});

describe("ninguém lê a chave pelo banco", () => {
  it("a chave existe de verdade — senão o resto deste arquivo passa no vazio", async () => {
    // Guard. Todos os testes abaixo afirmam AUSÊNCIA de leitura; sem uma linha
    // lá dentro, todos passam por vergonha.
    expect(await chaveExiste()).toBe(1);
  });

  it("o DONO da organização não lê a própria chave", async () => {
    // Alice é `owner` da org A e foi quem configurou a chave. Ela não pode
    // relê-la. É a exigência do produto — "após incluir, nem mesmo o dono vê" —
    // e aqui é propriedade do banco, não promessa da UI.
    const lido = await asUser(IDS.alice, async (c) => {
      const { rows } = await c.query("select * from public.organization_provider_keys");
      return rows;
    });

    expect(lido).toEqual([]);
  });

  it("um `member` da organização também não lê", async () => {
    // Bob é `member` da org A. Se lesse, exfiltraria a chave da empresa dele.
    const lido = await asUser(IDS.bob, async (c) => {
      const { rows } = await c.query("select chave_cifrada from public.organization_provider_keys");
      return rows;
    });

    expect(lido).toEqual([]);
  });

  it("outra organização não lê", async () => {
    const lido = await asUser(IDS.dan, async (c) => {
      const { rows } = await c.query("select * from public.organization_provider_keys");
      return rows;
    });

    expect(lido).toEqual([]);
  });

  it("`anon` não lê", async () => {
    const lido = await asAnon(async (c) => {
      const { rows } = await c.query("select * from public.organization_provider_keys");
      return rows;
    });

    expect(lido).toEqual([]);
  });
});

describe("ninguém escreve a chave pelo banco", () => {
  it("nem o dono da organização insere direto", async () => {
    // A escrita passa por server action, que autoriza e cifra. Se desse para
    // inserir direto, daria para gravar a chave em claro.
    await expect(
      asUser(IDS.alice, (c) =>
        c.query(
          `insert into public.organization_provider_keys
             (organization_id, provider, chave_cifrada, ultimos_4)
           values ($1, 'gemini', 'em-claro', '1234')`,
          [IDS.orgA]
        )
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("nem apaga", async () => {
    // DELETE sem policy não estoura: a linha simplesmente não é visível, e o
    // comando afeta 0 linhas. Afirmar o rowCount é o que prova de verdade —
    // esperar exceção aqui era erro meu, e o teste denunciou.
    const afetadas = await asUser(IDS.alice, async (c) => {
      const r = await c.query("delete from public.organization_provider_keys");
      return r.rowCount;
    });

    expect(afetadas).toBe(0);
    expect(await chaveExiste()).toBe(1); // e a chave continua lá
  });
});

describe("a forma da tabela", () => {
  it("uma chave por (organização, provider)", async () => {
    await expect(
      asOwner((c) =>
        c.query(
          `insert into public.organization_provider_keys
             (organization_id, provider, chave_cifrada, ultimos_4)
           values ($1, 'gemini', 'outra', '9999')`,
          [IDS.orgA]
        )
      )
    ).rejects.toThrow(/uq_organization_provider/);
  });

  it("provider desconhecido é rejeitado", async () => {
    // Espelha a constraint de `agents.provider` (PD-12): a porta multi-provider
    // fica aberta, mas só para provider que existe.
    await expect(
      asOwner((c) =>
        c.query(
          `insert into public.organization_provider_keys
             (organization_id, provider, chave_cifrada, ultimos_4)
           values ($1, 'inventado', 'x', '1234')`,
          [IDS.orgA]
        )
      )
    ).rejects.toThrow(/organization_provider_keys_provider_check/);
  });
});
