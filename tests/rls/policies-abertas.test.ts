// Nenhuma policy aberta, e nada legível por `anon`.
//
// Este arquivo é o teste do PD-17 e, por acidente feliz, teria pego o PD-22
// sozinho — a policy `agent_knowledge_files_select_authenticated ... USING (true)`
// vivia no baseline enquanto produção já a tinha removido.
//
// Diferente do resto da suíte, aqui não se olha linha nenhuma: pergunta-se ao
// CATÁLOGO como as policies são. É uma asserção estrutural, e é o formato certo
// para "isto nunca mais pode reaparecer".

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { initPool, closePool, asOwner, asAnon } from "./setup/rls";

beforeAll(() => initPool(process.env.RLS_DATABASE_URL!));
afterAll(closePool);

describe("policies abertas", () => {
  it("nenhuma policy de `public` usa USING (true) ou WITH CHECK (true)", async () => {
    // Policies permissivas SOMAM com OR: uma única `USING (true)` esquecida
    // anula o escopo de todas as outras da mesma tabela. Foi o PD-17.
    const abertas = await asOwner(async (c) => {
      const { rows } = await c.query<{ tabela: string; policy: string; qual: string }>(
        `select tablename as tabela, policyname as policy,
                coalesce(qual, '') || ' | ' || coalesce(with_check, '') as qual
           from pg_policies
          where schemaname = 'public'
            and (qual = 'true' or with_check = 'true')
          order by tablename, policyname`
      );
      return rows;
    });

    expect(abertas).toEqual([]);
  });

  it("toda tabela de `public` tem RLS habilitada", async () => {
    // Sem isto, uma policy escopada é decoração: a tabela responde a todo mundo.
    const semRls = await asOwner(async (c) => {
      const { rows } = await c.query<{ tabela: string }>(
        `select c.relname as tabela
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
          order by c.relname`
      );
      return rows.map((r) => r.tabela);
    });

    expect(semRls).toEqual([]);
  });

  it("`anon` não lê agentes — nem o prompt_base", async () => {
    // `anon` é o papel da chave pública, que vai no bundle do browser: qualquer
    // pessoa com a URL do projeto fala como ele. No PD-17 ele lia todos os
    // agentes, prompt_base incluso.
    const linhas = await asAnon(async (c) => {
      const { rows } = await c.query("select id from public.agents");
      return rows;
    });

    expect(linhas).toEqual([]);
  });

  it("`anon` não lê conversas, mensagens nem conhecimento", async () => {
    const vazios = await asAnon(async (c) => {
      const out: Record<string, number> = {};
      for (const t of ["conversations", "messages", "knowledge_documents", "knowledge_chunks", "knowledge_spaces"]) {
        const { rows } = await c.query<{ n: string }>(`select count(*)::text as n from public.${t}`);
        out[t] = Number(rows[0].n);
      }
      return out;
    });

    expect(vazios).toEqual({
      conversations: 0, messages: 0, knowledge_documents: 0, knowledge_chunks: 0, knowledge_spaces: 0,
    });
  });
});
