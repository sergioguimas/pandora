// Peças compartilhadas por quem monta um Postgres de teste com o schema real:
// `scripts/verify-baseline.mjs` (PD-22) e o harness de RLS (PD-04b).
//
// Só o que é comum de verdade — as funções puras e os caminhos. A orquestração
// do container fica em cada consumidor, porque os dois querem coisas diferentes
// (o verificador sobe dois bancos e compara; o harness sobe um e semeia).

import { readFileSync } from "node:fs";

// `pgvector/pgvector:pg17` (~450 MB) e não `supabase/postgres` (~4 GB, cujo pull
// falha nesta máquina com `unexpected EOF`). Mesma major de produção (17.6).
// O que a imagem do Supabase daria pronto está explícito em test-db-bootstrap.sql.
export const IMAGE = "pgvector/pgvector:pg17";

export const PATHS = {
  baseline: "supabase/migrations/20260716000000_baseline_schema.sql",
  authDump: "supabase/schema/20260716_schema_auth.sql",
  bootstrap: "scripts/sql/test-db-bootstrap.sql",
};

// Os dumps saem do pg_dump 18: trazem os meta-comandos `\restrict`, que o psql
// 17 não entende, e um `CREATE SCHEMA public` que colide com o schema que já
// existe num banco novo. O baseline já nasce sem os dois (build-baseline.mjs);
// nos dumps crus, removemos na aplicação.
const DROP_LINE = [
  /^\\restrict /,
  /^\\unrestrict /,
  /^CREATE SCHEMA public;$/,
  /^ALTER SCHEMA public OWNER TO pg_database_owner;$/,
];

export function stripForPsql(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !DROP_LINE.some((re) => re.test(line)))
    .join("\n");
}

/**
 * OS DUMPS DE `public` E `auth` SÃO CIRCULARES ENTRE SI.
 * `public` referencia `auth.users` por FK; e `auth` referencia `public` de volta
 * em exatamente duas linhas — os triggers `on_auth_user_created*`, que executam
 * funções nossas. Nenhuma ordem de aplicação crua funciona.
 *
 * É por isso que o footer do baseline cria esses triggers: o baseline é o dono
 * deles. Aqui separamos as duas metades para poder aplicar numa ordem que
 * existe: andaime do auth → schema public → (triggers, se a fonte não os criar).
 */
export function splitAuthDump(text) {
  const isTrigger = (l) => /^CREATE TRIGGER \S+ AFTER INSERT ON auth\.users/.test(l);
  const lines = stripForPsql(text).split("\n");
  const triggers = lines.filter(isTrigger);
  if (triggers.length !== 2) {
    throw new Error(
      `esperava 2 triggers em auth.users no dump de auth, achei ${triggers.length}. ` +
        `Se o produto ganhou/perdeu um trigger, ajuste aqui e no footer do baseline.`
    );
  }
  return { scaffold: lines.filter((l) => !isTrigger(l)).join("\n"), triggers: triggers.join("\n") };
}

export const readAuthDump = () => splitAuthDump(readFileSync(PATHS.authDump, "utf8"));
export const readBootstrap = () => readFileSync(PATHS.bootstrap, "utf8");

// CRLF→LF também aqui, e não só nos dumps. O corpo de uma função PL/pgSQL é
// guardado VERBATIM em `pg_proc.prosrc`: aplicar o baseline com CRLF põe `\r`
// dentro das funções no banco, e aí ele diverge de um banco construído a partir
// do dump (que passa por `stripForPsql`). A assimetria fez o verificador acusar
// divergência contra produção quando a única diferença era fim de linha —
// depois de um `git checkout` converter o arquivo (ver .gitattributes).
//
// O `.gitattributes` resolve na origem; isto aqui garante que o verificador meça
// SCHEMA e não espaço em branco, mesmo se o arquivo chegar torto por outra via.
export const readBaseline = () => readFileSync(PATHS.baseline, "utf8").replace(/\r\n/g, "\n");

export const CREATE_EXTENSIONS = `
  create extension if not exists pgcrypto with schema extensions;
  create extension if not exists vector   with schema extensions;
`;
