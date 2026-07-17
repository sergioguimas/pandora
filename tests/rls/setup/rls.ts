// Como se olha o banco pelos olhos de um usuário, sem PostgREST e sem token.
//
// `auth.uid()` do Supabase é, literalmente:
//   coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
//            (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
// (conferido no dump real de `auth`, não suposto.)
//
// Ou seja: o "JWT forjado" é uma linha de `set_config`. Não há nada para assinar,
// e o PostgREST não participa da decisão — ele só escolhe o papel e preenche
// esse setting. Quem decide acesso é a policy, e é exatamente ela que testamos.
//
// Cada teste roda numa transação que termina em ROLLBACK: as fixtures ficam
// intactas, os testes não se enxergam e a suíte não depende de ordem.

import { Pool, type PoolClient } from "pg";

// `postgres` é dono das tabelas e não é filtrado por RLS — use só para montar
// cenário e para inspecionar o catálogo, nunca para afirmar acesso.
const ROLES = ["anon", "authenticated", "service_role", "postgres"] as const;
export type Role = (typeof ROLES)[number];

let pool: Pool | undefined;

export function initPool(connectionString: string): void {
  pool = new Pool({ connectionString, max: 8 });
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

function requirePool(): Pool {
  if (!pool) throw new Error("pool não inicializado — o globalSetup rodou?");
  return pool;
}

type Options = { role?: Role; userId?: string | null };

/**
 * Roda `fn` numa transação, com o papel e o `auth.uid()` pedidos, e desfaz tudo
 * no fim.
 */
export async function as<T>(
  { role = "authenticated", userId = null }: Options,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  // `set role` não aceita parâmetro — o nome do papel entra por interpolação.
  // A allowlist é o que impede isso de virar injeção.
  if (!ROLES.includes(role)) throw new Error(`papel desconhecido: ${role}`);

  const client = await requirePool().connect();
  try {
    await client.query("begin");
    // Precisa vir ANTES do `set role`: depois de virar `anon`, o papel pode não
    // ter permissão de mexer no setting.
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      userId ? JSON.stringify({ sub: userId, role }) : "",
    ]);
    await client.query(`set local role ${role}`);
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

/** Atalho: um usuário autenticado. */
export const asUser = <T>(userId: string, fn: (c: PoolClient) => Promise<T>) =>
  as({ role: "authenticated", userId }, fn);

/** Atalho: `anon` — o papel da chave pública, que vai no bundle do browser.
 *  É o papel do PD-17: qualquer pessoa com a URL do projeto fala como ele. */
export const asAnon = <T>(fn: (c: PoolClient) => Promise<T>) =>
  as({ role: "anon", userId: null }, fn);

/** Sem RLS. Só para catálogo e montagem de cenário. */
export const asOwner = <T>(fn: (c: PoolClient) => Promise<T>) =>
  as({ role: "postgres", userId: null }, fn);

/** Ids visíveis numa query — o formato que quase todo teste daqui compara. */
export async function idsOf(client: PoolClient, sql: string, params: unknown[] = []): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(sql, params);
  return rows.map((r) => r.id).sort();
}
