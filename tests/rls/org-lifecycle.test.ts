// Schema do ciclo de vida da organização (PD-27).
//
// A LÓGICA (ativa de fato, dias restantes) é pura e testada em
// src/lib/org-lifecycle.test.ts. Aqui travamos o SCHEMA: colunas, defaults e a
// constraint de key_mode — que é o que o app assume existir.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asOwner } from "./setup/rls";
import { IDS } from "./setup/fixtures";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

describe("colunas de ciclo de vida em organizations", () => {
  it("uma org nova nasce ativa, sem prazo e em modo 'platform'", async () => {
    const row = await asOwner(async (c) => {
      const { rows } = await c.query<{
        is_active: boolean;
        active_until: string | null;
        key_mode: string;
      }>(
        `insert into public.organizations (name)
         values ('Org de teste lifecycle')
         returning is_active, active_until, key_mode`
      );
      return rows[0];
    });

    expect(row.is_active).toBe(true);
    expect(row.active_until).toBeNull();
    expect(row.key_mode).toBe("platform");
  });

  it("a org do sistema e a Base Geral estão ativas (defaults do PD-27)", async () => {
    const ativos = await asOwner(async (c) => {
      const { rows } = await c.query<{ id: string; is_active: boolean }>(
        "select id, is_active from public.organizations where id = any($1)",
        [[IDS.orgSystem, IDS.orgDefault]]
      );
      return rows;
    });

    expect(ativos.length).toBe(2);
    expect(ativos.every((o) => o.is_active)).toBe(true);
  });

  it("key_mode só aceita 'platform' ou 'own'", async () => {
    await expect(
      asOwner((c) =>
        c.query(
          "insert into public.organizations (name, key_mode) values ('x', 'gratis')"
        )
      )
    ).rejects.toThrow(/organizations_key_mode_check/);
  });

  it("aceita 'own' e um prazo explícito", async () => {
    const row = await asOwner(async (c) => {
      const { rows } = await c.query<{ key_mode: string; active_until: string | null }>(
        `insert into public.organizations (name, key_mode, active_until)
         values ('Org com prazo', 'own', now() + interval '30 days')
         returning key_mode, active_until`
      );
      return rows[0];
    });

    expect(row.key_mode).toBe("own");
    expect(row.active_until).not.toBeNull();
  });
});
