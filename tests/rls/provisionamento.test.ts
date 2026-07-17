// Um usuário nasce SEM organização (PD-25).
//
// Até a migration `20260717010000`, o trigger
// `on_auth_user_created_add_default_organization` inseria TODO usuário novo na
// org `11111111-…` ("Base Geral"). Com o `/cadastro` público, isso significava:
// qualquer pessoa cria conta e vira colega de organização do dono do produto —
// lendo todos os agentes, `prompt_base` incluso, e todo o conhecimento.
//
// A RLS nunca esteve errada. Ela isolava organizações perfeitamente — só que
// havia UMA organização, e o formulário de cadastro era a porta dela. É o PD-17
// de novo, trocando "basta a URL do projeto" por "basta um cadastro grátis".
//
// Estes testes travam o comportamento novo. Se alguém recriar o trigger, ou
// apontar o cadastro para uma org fixa de novo, eles falham.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asOwner, asUser } from "./setup/rls";
import { IDS } from "./setup/fixtures";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

describe("o trigger da organização padrão não existe mais", () => {
  it("auth.users tem só o trigger que cria o profile", async () => {
    const triggers = await asOwner(async (c) => {
      const { rows } = await c.query<{ tgname: string }>(
        `select tgname from pg_trigger
          where tgrelid = 'auth.users'::regclass and not tgisinternal
          order by tgname`
      );
      return rows.map((r) => r.tgname);
    });

    // `handle_new_user` (cria o profiles) é legítimo e fica: ele não decide
    // pertencimento a organização, que era o problema.
    expect(triggers).toEqual(["on_auth_user_created"]);
  });

  it("a função `handle_new_user_default_organization` foi removida", async () => {
    const existe = await asOwner(async (c) => {
      const { rows } = await c.query<{ n: string }>(
        `select count(*)::text as n from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'handle_new_user_default_organization'`
      );
      return Number(rows[0].n) > 0;
    });

    expect(existe).toBe(false);
  });
});

describe("um usuário novo nasce sem organização", () => {
  const NOVO = "e5555555-5555-4555-8555-555555555555";

  it("ganha profile, mas nenhuma associação de organização", async () => {
    const resultado = await asOwner(async (c) => {
      await c.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, 'novo@teste.local', jsonb_build_object('name', 'Novo'))`,
        [NOVO]
      );
      const perfis = await c.query<{ n: string }>(
        "select count(*)::text as n from public.profiles where id = $1", [NOVO]
      );
      const orgs = await c.query<{ n: string }>(
        "select count(*)::text as n from public.organization_members where user_id = $1", [NOVO]
      );
      return { profiles: Number(perfis.rows[0].n), orgs: Number(orgs.rows[0].n) };
    });

    expect(resultado).toEqual({ profiles: 1, orgs: 0 });
  });

  it("sem organização, enxerga SÓ os agentes universais — nenhum de empresa", async () => {
    // O fecho do argumento, e uma correção: eu esperava zero agentes. São os
    // universais.
    //
    // `can_read_org()` é `is_system_org(org) OR is_org_member(org, uid)`, e o
    // `is_system_org()` NÃO OLHA O USUÁRIO — a org do sistema é legível por
    // qualquer um, inclusive por quem não é membro de organização nenhuma. É o
    // desenho do PD-06b levado ao limite, e está correto: os universais são
    // públicos para autenticados, por definição.
    //
    // O que importa é o outro lado: sem organização, os agentes DE EMPRESA
    // somem. Antes do PD-25, este mesmo usuário leria todos os da Base Geral,
    // `prompt_base` incluso.
    const agentes = await asUser("f6666666-6666-4666-8666-666666666666", async (c) => {
      const { rows } = await c.query<{ id: string; organization_id: string }>(
        "select id, organization_id from public.agents"
      );
      return rows;
    });

    expect(agentes.map((a) => a.id)).toEqual([IDS.agentUniversal]);
    expect(agentes.every((a) => a.organization_id === IDS.orgSystem)).toBe(true);
  });
});

describe("o admin de plataforma é uma flag, não um membro da org do sistema", () => {
  it("`profiles.is_platform_admin` existe e nasce falso", async () => {
    const padrao = await asOwner(async (c) => {
      const { rows } = await c.query<{ is_platform_admin: boolean }>(
        "select is_platform_admin from public.profiles where id = $1", [IDS.alice]
      );
      return rows[0]?.is_platform_admin;
    });

    expect(padrao).toBe(false);
  });

  it("a flag NÃO dá nenhum poder via RLS", async () => {
    // O admin de plataforma age pelo client admin (service_role), fora da RLS.
    // A flag não pode virar atalho dentro dela: se um dia alguém escrever uma
    // policy `... or is_platform_admin`, a parede passa a ter uma porta e este
    // teste falha.
    const podeVerAgenteDaOutraOrg = await asOwner(async (c) => {
      await c.query("update public.profiles set is_platform_admin = true where id = $1", [IDS.dan]);
      return null;
    });
    expect(podeVerAgenteDaOutraOrg).toBeNull();

    const agentesDaOrgA = await asUser(IDS.dan, (c) =>
      c.query("select id from public.agents where organization_id = $1", [IDS.orgA])
    );

    // Dan virou admin de plataforma e continua sem enxergar a org A.
    expect(agentesDaOrgA.rows).toEqual([]);
  });
});
