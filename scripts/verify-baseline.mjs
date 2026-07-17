// Verifica que o baseline reproduz produção — SEM circularidade.
//
//   node scripts/verify-baseline.mjs [dump-de-prod]
//
// A IDEIA
// Sobe um Postgres limpo e constrói DOIS bancos, do mesmo andaime:
//   db_baseline  ← aplica supabase/migrations/  (o artefato)
//   db_prod      ← aplica o dump de produção    (a fonte da verdade, independente)
// Dumpa os dois com o MESMO pg_dump e diffa. Igual = o baseline reproduz prod.
//
// POR QUE ASSIM
// A verificação do PD-18 comparava o baseline com o dump de que ele foi gerado:
// circular, verde por construção, e foi assim que o PD-22 passou batido. Aqui o
// lado direito vem de produção e o esquerdo do artefato — se divergirem, o diff
// aponta onde. Dumpar os dois lados com o mesmo binário elimina ruído de
// formato/versão, que é o motivo de a checagem antiga ter recorrido a CONTAGENS.
// Contagem é fraca: `43 = 43` bate mesmo se o CORPO de uma policy mudar — e o
// corpo é exatamente onde mora a fronteira de segurança.
//
// Prova de quebra o que o PD-18 prometia e nunca foi reconferido para este
// arquivo: que o baseline APLICA num banco limpo, do zero, sem erro.
//
// Em Node, não em bash: o Git Bash desta máquina quebra com erro de fork
// (`cygheap read copy failed`) ao encadear muitos `docker exec`.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const IMAGE = "pgvector/pgvector:pg17"; // mesma major de prod (17.6)
const CID = "pandora-verify-baseline";
const BASELINE = "supabase/migrations/20260716000000_baseline_schema.sql";
const AUTH_DUMP = "supabase/schema/20260716_schema_auth.sql";
const BOOTSTRAP = "scripts/sql/test-db-bootstrap.sql";
const PROD_DUMP = process.argv[2] ?? "supabase/schema/20260716_schema_public.sql";

for (const f of [BASELINE, AUTH_DUMP, BOOTSTRAP, PROD_DUMP]) {
  if (!existsSync(f)) { console.error(`não achei ${f}`); process.exit(1); }
}

const docker = (args, opts = {}) =>
  execFileSync("docker", args, { encoding: "utf8", ...opts });

const quiet = (args, opts = {}) => { try { return docker(args, { stdio: "pipe", ...opts }); } catch { return null; } };

// Os dumps do pg_dump 18 trazem meta-comandos \restrict que o psql 17 não
// entende; e `CREATE SCHEMA public` colide com o schema que já existe num banco
// novo. O baseline já nasce sem os dois (ver build-baseline.mjs); nos dumps
// crus, tiramos aqui.
const DROP = [/^\\restrict /, /^\\unrestrict /, /^CREATE SCHEMA public;$/, /^ALTER SCHEMA public OWNER TO pg_database_owner;$/];
const strip = (path) =>
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").split("\n")
    .filter((l) => !DROP.some((re) => re.test(l))).join("\n");

const psql = (db, sql) =>
  docker(["exec", "-i", CID, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-d", db],
         { input: sql });

// OS DOIS DUMPS SÃO CIRCULARES ENTRE SI.
// `public` referencia `auth.users` por FK; e `auth` referencia `public` de volta,
// por exatamente duas linhas: os triggers `on_auth_user_created*`, que executam
// funções nossas. Nenhuma das duas ordens de aplicação funciona crua.
// É justamente por isso que o footer do baseline cria esses triggers — o
// baseline é o dono deles. Aqui separamos as duas metades para poder aplicar
// numa ordem que existe, e para comparar os dois lados simetricamente:
//   db_baseline: andaime → baseline (o footer cria os triggers)
//   db_prod:     andaime → dump de public → triggers do dump de auth
const isAuthUsersTrigger = (l) => /^CREATE TRIGGER \S+ AFTER INSERT ON auth\.users/.test(l);
const authLines = strip(AUTH_DUMP).split("\n");
const AUTH_SCAFFOLD = authLines.filter((l) => !isAuthUsersTrigger(l)).join("\n");
const AUTH_TRIGGERS = authLines.filter(isAuthUsersTrigger).join("\n");
if (AUTH_TRIGGERS.split("\n").filter(Boolean).length !== 2) {
  console.error("esperava 2 triggers em auth.users no dump de auth; achei " +
                AUTH_TRIGGERS.split("\n").filter(Boolean).length + ". Confira o dump.");
  process.exit(1);
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

quiet(["rm", "-f", CID]);
process.on("exit", () => quiet(["rm", "-f", CID]));

console.log(`==> subindo ${IMAGE}`);
docker(["run", "-d", "--name", CID, "-e", "POSTGRES_PASSWORD=postgres", IMAGE], { stdio: "pipe" });

process.stdout.write("==> esperando o Postgres");
let up = false;
for (let i = 0; i < 90 && !up; i++) {
  up = quiet(["exec", CID, "pg_isready", "-U", "postgres", "-q"]) !== null;
  if (!up) { process.stdout.write("."); sleep(1000); }
}
console.log(up ? " ok" : "");
if (!up) { console.error(docker(["logs", "--tail", "30", CID])); process.exit(1); }

for (const db of ["db_baseline", "db_prod"]) {
  console.log(`==> ${db}: andaime (papéis, extensões, schema auth de prod)`);
  docker(["exec", CID, "createdb", "-U", "postgres", db], { stdio: "pipe" });
  psql(db, readFileSync(BOOTSTRAP, "utf8"));
  psql(db, `create extension if not exists pgcrypto with schema extensions;
            create extension if not exists vector   with schema extensions;`);
  psql(db, AUTH_SCAFFOLD);
}

console.log(`==> db_prod     ← ${PROD_DUMP} + triggers de auth.users`);
psql("db_prod", strip(PROD_DUMP));
psql("db_prod", AUTH_TRIGGERS);

console.log(`==> db_baseline ← ${BASELINE}`);
psql("db_baseline", readFileSync(BASELINE, "utf8"));
console.log("    aplicou do zero sem erro (ON_ERROR_STOP=1) ✓");

console.log("==> dumpando os dois com o mesmo pg_dump");
const dumps = {};
for (const db of ["db_baseline", "db_prod"]) {
  // O `\restrict <token>` é aleatório a cada invocação do pg_dump — é ruído, não
  // conteúdo. Sem tirá-lo, os dois lados nunca batem.
  dumps[db] = docker(["exec", CID, "pg_dump", "-U", "postgres", "--schema=public", "--schema-only", db])
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("--") && !/^\\(un)?restrict /.test(l))
    .join("\n");
  writeFileSync(`${process.env.TEMP ?? "/tmp"}/${db}.sql`, dumps[db]);
}

// Os triggers de `auth.users` não aparecem num dump de `public`, mas são parte
// do produto (o footer do baseline os cria). Compara-os pelo catálogo.
// `-t -A`: só as tuplas, sem cabeçalho/rodapé — senão a contagem vira número de
// linhas da tabela formatada do psql, não de triggers.
const triggersOf = (db) =>
  docker(["exec", "-i", CID, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-d", db],
    { input: `select tgname || ' :: ' || pg_get_triggerdef(oid)
              from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal
              order by tgname;` }).trim();
const trg = { db_baseline: triggersOf("db_baseline"), db_prod: triggersOf("db_prod") };

const count = (re) => (dumps.db_baseline.match(re) ?? []).length;
console.log("\n================ RESULTADO ================");
if (trg.db_baseline !== trg.db_prod) {
  console.log("❌ Os triggers de auth.users divergem:");
  console.log("  - prod:     " + trg.db_prod.replace(/\n/g, "\n              "));
  console.log("  + baseline: " + trg.db_baseline.replace(/\n/g, "\n              "));
  process.exit(1);
}
if (dumps.db_baseline === dumps.db_prod) {
  console.log("✅ IDÊNTICOS — o baseline reproduz produção.");
  console.log(`   conferido: ${count(/^CREATE TABLE /gm)} tabelas · ${count(/^CREATE POLICY /gm)} policies · ` +
              `${count(/^CREATE FUNCTION /gm)} funções · ${count(/^CREATE (UNIQUE )?INDEX /gm)} índices` +
              ` · ${trg.db_baseline.split("\n").length} triggers em auth.users`);
  console.log(`   policies abertas (USING (true)): ${count(/USING \(true\)/g)}`);
} else {
  console.log("❌ DIVERGEM. Primeiras linhas que diferem (- prod / + baseline):");
  const a = dumps.db_prod.split("\n"), b = dumps.db_baseline.split("\n");
  let shown = 0;
  for (let i = 0; i < Math.max(a.length, b.length) && shown < 40; i++) {
    if (a[i] !== b[i]) { console.log(`  - ${a[i] ?? "(fim)"}`); console.log(`  + ${b[i] ?? "(fim)"}`); shown += 2; }
  }
  process.exit(1);
}
