// Gera o baseline de `supabase/migrations/` a partir de um dump do schema `public`.
//
//   node scripts/build-baseline.mjs supabase/schema/20260716_schema_public.sql
//
// POR QUE ISTO É UM SCRIPT E NÃO UM ARQUIVO EDITADO À MÃO
// O PD-22 nasceu de um baseline gerado de um dump defasado, com um cabeçalho
// afirmando uma procedência que não era verdade. Enquanto a transformação for
// mecânica e reprodutível, o baseline não pode divergir do dump por engano: se
// houver dúvida, rode de novo e diffe. Um arquivo mantido à mão não tem essa
// propriedade.
//
// COMO REGERAR (quando produção mudar)
//   1. pg_dump do schema `public` de produção (via pgAdmin: botão direito NO NÓ
//      `public` → Backup; a aba Objects é ignorada se disparada do nó do banco).
//      Sem `--no-owner` e sem `--no-privileges`: os GRANTs para `anon` são parte
//      da fronteira de segurança (PD-17) e precisam estar no baseline.
//   2. node scripts/build-baseline.mjs <caminho-do-dump>
//   3. Verifique aplicando num Postgres limpo e comparando com o dump de prod.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("uso: node scripts/build-baseline.mjs <dump-do-schema-public.sql>");
  process.exit(1);
}

// UM DUMP DE CADA VEZ.
// O PD-22 nasceu de dois dumps convivendo na pasta: geraram o baseline do
// errado, e o certo estava logo ao lado. Ao redumpar, SUBSTITUA — não acumule.
const publicDumps = readdirSync("supabase/schema").filter((f) => /_schema_public\.sql$/.test(f));
if (publicDumps.length > 1) {
  console.error(
    `há ${publicDumps.length} dumps de public em supabase/schema/:\n` +
      publicDumps.map((f) => `  - ${f}`).join("\n") +
      `\n\nDeixe só o atual. Dump velho parado é como o PD-22 aconteceu:\n` +
      `o baseline saiu do defasado enquanto o bom estava na mesma pasta.`
  );
  process.exit(1);
}

const OUT = "supabase/migrations/20260716000000_baseline_schema.sql";

// O nome do arquivo NÃO muda ao regerar. Produção já tem este timestamp
// registrado como aplicado (`migration repair`); renomear faria a CLI tentar
// aplicar o baseline por cima de um schema que já existe.

const raw = readFingerprintedDump(dumpPath);

function readFingerprintedDump(path) {
  const text = readFileSync(path, "utf8");
  if (!/^CREATE TABLE public\./m.test(text)) {
    throw new Error(`${path} não parece um dump do schema public (nenhum CREATE TABLE public.)`);
  }
  const foreign = [...text.matchAll(/^CREATE TABLE (?!public\.)([a-z_]+)\./gm)].map((m) => m[1]);
  if (foreign.length > 0) {
    throw new Error(
      `${path} contém outros schemas (${[...new Set(foreign)].join(", ")}). ` +
        `Dispare o backup a partir do nó \`public\`, não do nó do banco.`
    );
  }
  return text;
}

// Data de captura, direto do cabeçalho do pg_dump — não do relógio de agora.
// A procedência tem que vir do artefato, senão volta a ser afirmação.
const startedOn = raw.match(/^-- Started on (.+)$/m)?.[1]?.trim();
if (!startedOn) throw new Error("dump sem `-- Started on`: não dá para atestar a data de captura.");

const HEADER = `-- ============================================================================
-- BASELINE — schema completo do Pandora (PD-18)
--
-- ⚠️  ARQUIVO GERADO. Não edite à mão — rode \`node scripts/build-baseline.mjs\`.
--
-- Substitui as migrations 1–20, arquivadas em \`supabase/schema/archive/\`.
--
-- PROCEDÊNCIA
--   Fonte:    supabase/schema/${basename(dumpPath)}
--   Capturado: ${startedOn} (do cabeçalho do próprio pg_dump)
--
-- POR QUE EXISTE
-- As migrations antigas não reproduziam o banco. Comprovado aplicando-as num
-- Postgres limpo: 17 passaram e a 18ª (multitenant) abortou, porque dependia de
-- DADOS de produção — procurava os agentes \`Agente 0\` e \`Oráculo\`, que só
-- existem no banco real. A migration #2 ainda semeava 3 agentes que foram
-- renomeados/removidos pela UI e não existem mais em produção. Somava-se a isso
-- o drift: objetos vivos que nenhuma migration criava.
--
-- REGRAS DESTE ARQUIVO
--   - Só SCHEMA. Nenhum seed de dado de negócio: um banco novo nasce vazio.
--   - Nenhum passo dependente de dados. Migrações de dados são eventos únicos e
--     pertencem ao histórico, não a um arquivo que precisa ser replayável.
--
-- HISTÓRICO DE UMA CILADA (PD-22)
-- A primeira versão deste baseline saiu de um dump anterior às migrations
-- \`150000\` (PD-09) e \`160000\` (PD-10) — faltavam a policy escopada de
-- \`agent_knowledge_files\` e a coluna \`modo_resposta\`, que o app lê. Passou
-- despercebido porque a verificação comparava o baseline com o dump de que ele
-- foi gerado: circular, sempre verde. Ao verificar, a fonte da verdade precisa
-- ser INDEPENDENTE do artefato verificado.
--
-- EM PRODUÇÃO ESTE ARQUIVO NÃO DEVE SER EXECUTADO — o schema já está aplicado.
-- Registre-o como aplicado:
--   npx supabase migration repair --status applied 20260716000000
-- ============================================================================

-- Extensões (o dump do schema \`public\` não as inclui)
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
`;

const FOOTER = `
-- ============================================================================
-- Objetos fora do schema \`public\` que fazem parte do produto
-- ============================================================================

-- Triggers em auth.users. Vivem no schema \`auth\` (fora do dump de \`public\`),
-- mas as funções que executam são nossas. \`handle_new_user_default_organization\`
-- era drift: existia no banco sem nenhuma migration que a criasse.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_created_add_default_organization on auth.users;
create trigger on_auth_user_created_add_default_organization
  after insert on auth.users
  for each row execute function public.handle_new_user_default_organization();

-- Buckets de storage. As tabelas de \`storage\` são criadas pelo storage-api, que
-- num \`supabase db reset\` já subiu antes das migrations. O guard evita quebrar
-- em ambientes sem o serviço de storage.
-- Sem policies de propósito: fail-closed até o upload existir (PD-09).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values
      ('message-attachments', 'message-attachments', false, 26214400),
      ('agent-knowledge',     'agent-knowledge',     false, 26214400)
    on conflict (id) do nothing;
  end if;
end $$;
`;

// A transformação, linha a linha. Cada remoção tem um motivo:
const DROP_LINE = [
  // Meta-comandos do psql 18. O psql das imagens Postgres mais antigas não os
  // entende e aborta com erro de sintaxe na primeira linha.
  /^\\restrict /,
  /^\\unrestrict /,
  // O schema `public` já existe num banco novo, e o dono (`pg_database_owner`)
  // não é atribuível fora do contexto do dump.
  /^CREATE SCHEMA public;$/,
  /^ALTER SCHEMA public OWNER TO pg_database_owner;$/,
];

const body = raw
  .replace(/\r\n/g, "\n") // pgAdmin no Windows escreve CRLF; migrations são LF.
  .split("\n")
  .filter((line) => !DROP_LINE.some((re) => re.test(line)))
  .join("\n");

writeFileSync(OUT, HEADER + body + FOOTER, "utf8");

const policies = (body.match(/^CREATE POLICY /gm) ?? []).length;
const functions = (body.match(/^CREATE FUNCTION public\./gm) ?? []).length;
const tables = (body.match(/^CREATE TABLE public\./gm) ?? []).length;
console.log(`baseline gerado: ${OUT}`);
console.log(`  fonte:     ${dumpPath} (capturado ${startedOn})`);
console.log(`  conteúdo:  ${tables} tabelas · ${functions} funções · ${policies} policies`);
