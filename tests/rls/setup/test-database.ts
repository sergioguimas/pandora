// Sobe o banco que a suíte de RLS usa: schema REAL de produção, papéis reais.
//
// Dois modos:
//   - `RLS_DATABASE_URL` no ambiente → usa esse banco (é o caso do CI, que já
//     tem um service container de pé). Não sobe nem derruba nada.
//   - sem a variável → sobe um container aqui (é o caso local).
//
// O schema vem do baseline, o mesmo arquivo que produção tem — verificado pelo
// `scripts/verify-baseline.mjs` (PD-22). Se o baseline divergir de prod, estes
// testes provam a fronteira errada; foi por isso que o PD-04b esperou o PD-22.

import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { IMAGE, readAuthDump, readBootstrap, readBaseline, CREATE_EXTENSIONS } from "../../../scripts/lib/test-db.mjs";

const CONTAINER = "pandora-rls-tests";
const PORT = 54329; // fora da faixa do Supabase CLI (54322) para não colidir
const URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

const docker = (args: string[], opts: object = {}) =>
  execFileSync("docker", args, { encoding: "utf8", ...opts });
const quiet = (args: string[]) => { try { return docker(args, { stdio: "pipe" }); } catch { return null; } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connectWhenReady(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      await client.end();
      return;
    } catch (err) {
      lastErr = err;
      await client.end().catch(() => {});
      await sleep(500);
    }
  }
  throw new Error(`Postgres não respondeu em ${timeoutMs}ms: ${lastErr}`);
}

/** Aplica o schema real e semeia as fixtures. Roda como `postgres` (dono das
 *  tabelas), que não é filtrado por RLS — é assim que se monta o cenário que os
 *  testes depois observam pelos olhos de `authenticated`/`anon`. */
async function applySchema(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { scaffold } = readAuthDump();
    await client.query(readBootstrap());
    await client.query(CREATE_EXTENSIONS);
    await client.query(scaffold);
    // O baseline cria os triggers de auth.users no footer — por isso o scaffold
    // acima entra sem eles. Ver splitAuthDump em scripts/lib/test-db.mjs.
    await client.query(readBaseline());
  } finally {
    await client.end();
  }
}

// Quem subiu o container é quem o derruba. Não dá para descobrir isso olhando
// `RLS_DATABASE_URL` no teardown: o próprio setup a define para repassar a URL
// aos arquivos de teste, então a variável está sempre presente lá na frente.
let startedByUs = false;

export async function startTestDatabase(): Promise<string> {
  const external = process.env.RLS_DATABASE_URL;
  if (external) {
    await connectWhenReady(external);
    await applySchema(external);
    return external;
  }

  quiet(["rm", "-f", CONTAINER]);
  docker(["run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=postgres",
          "-p", `${PORT}:5432`, IMAGE], { stdio: "pipe" });
  startedByUs = true;
  await connectWhenReady(URL);
  await applySchema(URL);
  return URL;
}

export function stopTestDatabase(): void {
  if (!startedByUs) return; // banco de fora (CI): não é nosso para derrubar
  quiet(["rm", "-f", CONTAINER]);
}
