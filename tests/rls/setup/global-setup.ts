// Sobe o banco e semeia as fixtures UMA vez para toda a suíte de RLS.
// Cada teste depois roda em transação com rollback, então o cenário semeado aqui
// sobrevive intacto do primeiro ao último teste.

import { Client } from "pg";
import { startTestDatabase, stopTestDatabase } from "./test-database";
import { seedFixtures } from "./fixtures";

export async function setup(): Promise<void> {
  const url = await startTestDatabase();

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await seedFixtures(client);
    await assertMundoMontado(client);
  } finally {
    await client.end();
  }

  // Os arquivos de teste rodam noutro processo — a URL viaja por env.
  process.env.RLS_DATABASE_URL = url;
}

export async function teardown(): Promise<void> {
  stopTestDatabase();
}

/**
 * Falha alto se o mundo não estiver montado.
 *
 * Vários testes desta suíte afirmam AUSÊNCIA — "anon não lê agente nenhum",
 * "nenhuma policy é aberta". Num banco vazio, todos passam, e passam por
 * vergonha: não há o que ler nem policy para ser aberta. O verde diria "a
 * fronteira está de pé" quando na verdade diz "não há fronteira".
 *
 * É o mesmo vício que produziu o PD-22 (verificação que só podia dar verde).
 * Aqui a suíte se recusa a rodar se o cenário não existir.
 */
async function assertMundoMontado(client: Client): Promise<void> {
  // Exato para o que ESTA suíte possui (as fixtures), frouxo para o que ela não
  // possui (o schema). Fixar aqui a contagem de policies seria dar dois donos à
  // mesma asserção: a fidelidade do schema é do `scripts/verify-baseline.mjs`
  // (PD-22). Com dois donos, somar uma policy legítima quebraria esta suíte com
  // um erro que não tem nada a ver com RLS.
  const checagens: Array<[string, string, (n: number) => boolean, string]> = [
    ["schema aplicado", "pg_tables where schemaname = 'public'", (n) => n > 0, "> 0"],
    ["policies existem", "pg_policies where schemaname = 'public'", (n) => n > 0, "> 0"],
    ["fixture: agentes", "public.agents", (n) => n === 3, "3"],
    ["fixture: usuários", "auth.users", (n) => n === 4, "4"],
    ["fixture: conversas", "public.conversations", (n) => n === 1, "1"],
    ["fixture: participantes", "public.conversation_participants", (n) => n === 2, "2"],
  ];

  const erros: string[] = [];
  for (const [rotulo, from, ok, esperado] of checagens) {
    const { rows } = await client.query<{ n: string }>(`select count(*)::text as n from ${from}`);
    const n = Number(rows[0].n);
    if (!ok(n)) erros.push(`  ${rotulo} (${from}): esperava ${esperado}, achei ${n}`);
  }

  if (erros.length > 0) {
    throw new Error(
      "o banco de teste não está montado como a suíte espera:\n" + erros.join("\n") +
        "\n\nSem isto, os testes que afirmam ausência passam num banco vazio."
    );
  }
}
