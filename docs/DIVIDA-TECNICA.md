# Dívida Técnica & Backlog — Pandora

Backlog **rastreável** dos problemas identificados na avaliação do código. Cada item
tem id, severidade, arquivos e ação recomendada. Use os ids (`PD-xx`) em commits e PRs.

**Legenda de severidade**
🔴 Alta — bug funcional ou risco de segurança/dados · 🟠 Média — manutenção/divergência ·
🟡 Baixa — housekeeping/otimização.

---

## Ordem de ataque

1. ~~`PD-01` reescrever README~~ ✅
2. ~~`PD-02` extrair runtime de IA compartilhado~~ ✅
3. ~~`PD-05` corrigir autorização do retry~~ ✅
4. ~~`PD-03` remover código morto / caminho legado~~ ✅
5. ~~`PD-08` refresh de sessão (proxy)~~ ✅
6. ~~`PD-17` + `PD-15` + `PD-06`/`PD-06b` + `PD-16` — multi-tenant + RLS + RPC~~ ✅ *(aplicado e verificado contra o banco em 2026-07-15)*
7. ~~`PD-09` fechar o Storage~~ ✅ *(aplicado e verificado em 2026-07-15)*
8. ~~`PD-07` extrair a orquestração do handler~~ ✅ *(com 10 testes cobrindo a rodada)*
9. ~~`PD-10` + `PD-19` — modo de resposta por agente e o piso de 40 chars~~ ✅ *(aguardando `db push`)*
10. ~~`PD-04` cobrir o núcleo com testes + CI~~ ✅ *(81 testes; GitHub Actions)*
11. `PD-18` baseline para reconciliar o drift ← **próximo** (destrava o `PD-04b`)
12. `PD-04b` RLS via `supabase test db` · `PD-13` timestamp da migration #5
13. `PD-11` `taskType` nos embeddings · `PD-12` provider OpenAI

---

> Não há mais itens 🔴 em aberto.

## 🟠 Média

### PD-18 — Banco tinha drift em relação às migrations
- **O que aconteceu**: objetos existiam no banco sem nenhuma migration que os criasse
  (um overload de 4 args de `match_agent_knowledge`, a função `match_knowledge_chunks`,
  `handle_new_user_default_organization()` e as policies `_anon_temp` / `USING (true)`).
  **Ler só as migrations levou a conclusões erradas** — o diagnóstico só fechou com o
  dump real.
- **Mitigado**: os objetos órfãos foram removidos e o snapshot de schema em
  `supabase/schema/` virou a referência. Toda alteração agora passa por migration.
- **Ainda em aberto**: uma migration de **baseline** que reconcilie o estado real, para
  que um `supabase db reset` local reproduza produção. Hoje as migrations 1–16 não
  reconstroem o banco fielmente.
- **Aceite**: `db reset` local gera um schema equivalente ao dump.

### PD-04b — RLS ainda sem teste automatizado
- **Estado**: o núcleo em TypeScript está coberto (81 testes) e roda no CI — ver
  `PD-04` em Concluídos. **Falta a camada de RLS.**
- **Problema**: as policies são a fronteira de segurança do produto, e a única
  verificação até hoje foi manual (queries no dump). Um `supabase test db` (pgTAP)
  provaria isolamento entre orgs, acesso de participante e a visibilidade dos agentes
  universais — de forma repetível.
- **Bloqueado por `PD-18`**: `supabase test db` roda contra um banco local criado pelas
  migrations, e elas **não reproduzem produção** (drift). O teste passaria/falharia
  contra um schema que não é o real — pior que não ter teste. Fazer o baseline primeiro.
- **Aceite**: `supabase test db` cobrindo isolamento por org e participante, rodando no CI.

---

## 🟡 Baixa

### PD-11 — Embeddings sem `taskType`
- **Onde**: `src/server/services/ai/providers/gemini-embeddings.ts`.
- **Problema**: query e documento usam a mesma chamada sem `RETRIEVAL_QUERY` /
  `RETRIEVAL_DOCUMENT`, o que o Gemini suporta e melhora o recall do RAG.
- **Ação**: diferenciar `taskType` entre `generateQueryEmbedding` e
  `generateDocumentEmbedding`.

### PD-12 — Provider OpenAI declarado mas não implementado
- **Onde**: constraint `agents_provider_check` aceita `'openai'`, e o tipo `RuntimeAgent`
  declara `provider: "gemini" | "openai"` — mas só existe código para Gemini
  (o dispatcher foi removido no `PD-03`).
- **Ação**: implementar de fato **ou** restringir a constraint a `'gemini'` até existir,
  para não sugerir uma capacidade inexistente.

### PD-13 — Migration com timestamp placeholder
- **Onde**: `supabase/migrations/20260418xxxxxx_add_knowledge_base.sql`.
- **Ação**: renomear com timestamp real para não arriscar a ordenação do `db push`.

### PD-14 — README ↔ código (manter sincronizado)
- **Ação**: `PD-01` corrigiu o descompasso principal. Manter a regra: **toda mudança
  de arquitetura/stack atualiza `README.md` e o doc relevante em `docs/`** no mesmo PR.

---

---

## ✅ Concluídos

### PD-01 — README alinhado ao código
README reescrito para refletir a stack real (Next 16 + Gemini; não Fastify/OpenAI/Vite)
e criada a pasta `docs/`.

### PD-05 — Retry ignorava o modelo de participantes 🔴
`src/app/api/chat/retry/route.ts` exigia ser o **dono** (`conversations.user_id =
auth.uid()`), resquício da Era 1 — um participante convidado conseguia conversar mas
levava 404 no "Tentar novamente". O filtro por `user_id` foi removido: o acesso agora é
validado pela **RLS** (`is_conversation_participant`), igual ao `stream`.

### PD-03 — Código morto e caminho legado concorrente 🟠
Havia um segundo motor de resposta (não-streaming, single-agent, sem RAG) convivendo
com o `stream`. Removidos:
- `sendMessage` em `server/actions/chat-actions.ts` (sem nenhum chamador)
- `server/services/ai/generate-agent-response.ts`
- `server/services/ai/providers/gemini-provider.ts`
- `server/services/mock-agent-response.ts`
- `types/ai.ts` (ficou órfão)
- `planAgentExecution` + `extractJsonObject` no `stream/route.ts` (estavam desativados
  com `void planAgentExecution`)

Resultado: **um único motor de resposta**, sem referências mortas.

### PD-02 — Duplicação do runtime de IA entre `stream` e `retry` 🟠
`classifyModelError`, `getErrorStatus`, `withRetryBeforeStreaming`, `withTimeout`,
`sleep`, `sse`, `sanitizeJson`, `saveMessage`, `normalizeText`, `removeActionJson`,
`isProbablyIncompleteAnswer`, `ModelGenerationError` e o tipo `Message` estavam
copiados nos dois handlers — e já divergiam (`maxOutputTokens` 2000 vs 1800).

Extraídos para [`src/server/services/ai/runtime.ts`](../src/server/services/ai/runtime.ts),
com constantes compartilhadas (`MODEL_MAX_OUTPUT_TOKENS` — depois substituída pelos
presets do `PD-10` —, `MODEL_TIMEOUT_MS`,
`RETRY_DELAYS_MS`, `MODEL_MAX_RETRIES`). Ambos os handlers consomem o módulo.

| Arquivo | Antes | Depois |
|---|---|---|
| `api/chat/stream/route.ts` | 1224 linhas | 939 |
| `api/chat/retry/route.ts` | 697 linhas | 489 |

**Regra a partir daqui:** comportamento de geração muda no `runtime.ts`, não nos handlers.

### PD-08 — Sessão não era renovada 🟠
Não havia refresh de token: o padrão `@supabase/ssr` exige interceptar cada request,
senão a sessão expira em navegação longa e o usuário cai no `/login`.

Criado [`src/proxy.ts`](../src/proxy.ts), que só renova o cookie — **não decide
acesso** (isso segue no layout do dashboard + RLS).

> ⚠️ **Armadilha do Next 16**: a convenção `middleware.ts` foi **renomeada para
> `proxy.ts`** (função exportada `proxy`). Com o nome antigo o Next emite apenas um
> aviso de deprecação, mas o app passa a responder **`200` com corpo vazio** — as
> requisições nem chegam às rotas. Se algo assim reaparecer, verifique o nome do arquivo.

### PD-17 — 🚨 RLS do banco estava aberta, inclusive para `anon` 🔴
Descoberto **no dump real, não nas migrations** — que descreviam policies escopadas
que não eram as vigentes.

- `agents_select_anon_temp` / `agent_knowledge_files_select_anon_temp` davam
  `SELECT ... TO anon USING (true)`. Como `anon` é o papel da chave pública (que vai
  no bundle do browser), **qualquer pessoa com a URL do projeto lia todos os agentes,
  incluindo `prompt_base`**.
- `knowledge_documents`/`chunks`/`spaces` tinham policies `USING (true)` convivendo com
  as escopadas. Policies permissivas se somam com **`OR`** → a aberta vencia e anulava
  todo o escopo.

Fechado em duas migrations (`20260715120000` e `20260715130000`). Verificado no dump
pós-aplicação: **zero** policies abertas nessas tabelas, nenhuma `_anon_temp`.

> **Lição**: uma policy permissiva `USING (true)` esquecida **anula** todas as outras
> da mesma tabela. Ao endurecer RLS, dropar por nome e conferir no `pg_policies`.

### PD-06 / PD-06b — Multi-tenant real + agentes universais 🔴
`organization_id NOT NULL` em `agents`, `knowledge_spaces`, `knowledge_documents` e
`knowledge_chunks`, com backfill por procedência (conversa > space > agente).

Agentes universais resolvidos com **organização do sistema** (`00000000-…-0000`,
`organizations.is_system = true`) em vez de flag no agente:
- leitura via `can_read_org()` = org do sistema **ou** membro da org → `Agente 0` e
  `Oráculo` aparecem para toda org, **sem clonagem**;
- escrita via `is_org_member()` → como a org do sistema não tem membros, os universais
  são read-only no app e ninguém injeta conhecimento `global` neles.

Também: `slug` passou a ser único **por org** (`uq_agents_org_slug`); `createAgent`
resolve o space padrão da org do usuário em vez do UUID fixo da Base Geral.

### PD-15 — `match_agent_knowledge` duplicada: `space` nunca era recuperado 🔴
Havia **3 overloads** (4, 5 e 6 args). O app chamava a de 5, que não filtrava
`scope='space'` → conhecimento de espaço era ingerido, chunkado, embeddado e **nunca
usado**; o fallback textual falhava pelo mesmo motivo. A de 6 args ainda tinha bug de
precedência (o threshold ligava só ao último `OR`) e perdera o guard de embedding nulo.

Unificado em **uma** assinatura canônica (6 args, parênteses explícitos, guard de nulo),
com `matchKnowledge` passando o `knowledge_space_id` do agente e o fallback cobrindo os
três escopos.

> **Lição**: `create or replace function` com assinatura diferente **cria overload, não
> substitui**. Ao mudar assinatura, `drop` explícito da antiga.

### PD-09 — Storage aberto para um recurso que não existe 🟠
As 6 policies de `storage.objects` só checavam `bucket_id` → qualquer autenticado
subia/lia/apagava **qualquer** objeto dos dois buckets, sem teto de tamanho nem de MIME
(`file_size_limit` e `allowed_mime_types` eram `null`).

O diagnóstico virou a chave: **a funcionalidade de arquivos nunca foi construída** —
nenhuma referência a `.storage`/`storage_path` no código, `message_attachments` e
`agent_knowledge_files` com 0 linhas, `storage.objects` com 0 objetos. Era superfície de
abuso (upload arbitrário) para nada.

Resolvido com **fail-closed** em `20260715150000`: policies removidas (sem policy = sem
acesso), teto de 25 MB nos buckets como rede de segurança, `agent_knowledge_files`
escopada por org (tinha `USING (true)`) e `message_attachments` alinhada ao modelo de
participantes (era da Era 1, por dono — mesmo resquício do `PD-05`).

A convenção de path e o checklist para quando o upload nascer estão em
`docs/BANCO-DE-DADOS.md`.

> **Lição**: antes de "consertar" a policy de um recurso, confirme se o recurso existe.
> Aqui o certo não era escopar — era fechar.

### PD-07 — Orquestração extraída do handler HTTP 🟠
O `stream/route.ts` tinha ~940 linhas misturando HTTP, auth, RAG, cadeia de agentes,
síntese, persistência e erro. Só rodava dentro de uma request com Gemini real — não
havia como testar nada.

A orquestração virou
[`services/ai/orchestrate-conversation.ts`](../src/server/services/ai/orchestrate-conversation.ts),
um **async generator que emite eventos** em vez de escrever num `ReadableStream`. O
handler ficou com **76 linhas**: autentica, persiste a mensagem do usuário e serializa
os eventos como SSE.

Dependências (banco, embeddings, Gemini) entram por um objeto `deps` com
implementação padrão — testes injetam fakes.

| Arquivo | Antes | Depois |
|---|---|---|
| `api/chat/stream/route.ts` | 939 | **76** |
| `services/ai/orchestrate-conversation.ts` | — | 852 |

**Detalhe estrutural**: os tokens eram emitidos de dentro de uma IIFE aninhada dentro de
`withTimeout` — e não se pode `yield` de dentro de função aninhada. Resolvido com
`streamAnswer`, um generator que corre cada passo da iteração contra um *deadline*.
É equivalente ao `withTimeout` anterior (mesmo teto de 75s, mesma mensagem, e estouro
segue descartando o parcial), só que permite emitir token a token.

**Aceite provado**: 10 testes cobrem agente único, cadeia + síntese, fallback de agente,
503 retryable, stream cortado, falha do RAG e truncamento — em ~3s, sem HTTP, sem banco
e sem Gemini. Foi o que validou que o refactor preservou o comportamento.

### PD-10 — Tamanho da resposta configurável por agente 🟡
`maxOutputTokens` era uma constante global (2000): agentes que respondem com tabelas
longas truncavam no meio, e a única saída era editar código e fazer deploy.

Virou um **preset nomeado por agente** (`agents.modo_resposta`), editável em
**Agentes → Geral → Tamanho da resposta**:

| Modo | tokens | Uso |
|---|---|---|
| `leve` | 800 | respostas diretas, menor custo |
| `medio` | 2000 | **padrão** — idêntico ao teto anterior |
| `alto` | 8000 | tabelas e comparativos longos |

`medio = 2000` de propósito: **nada muda até o agente optar** por outro modo. A síntese
segue o modo do primeiro agente da cadeia (mesma regra do modelo). Valor
ausente/desconhecido cai no padrão.

Os presets vivem em [`src/lib/response-mode.ts`](../src/lib/response-mode.ts) — módulo
puro — e não no `runtime.ts`, porque o editor de agentes é **client component** e o
runtime importa o client Supabase de servidor (`next/headers`); importá-lo do cliente
quebra o build. O runtime reexporta para os consumidores de servidor.

> **Lição**: `next build` pega esse tipo de erro; `tsc --noEmit` não.

### PD-19 — `isProbablyIncompleteAnswer` acusava toda resposta curta 🟡
`if (trimmed.length < 40) return true;` marcava **qualquer** resposta curta como
truncada. "Sim, o plano custa R$ 100." (26 chars) virava `status: "partial"`, disparava
`agent_warning` e mostrava "tentar novamente" — como se o agente tivesse falhado.

O piso agora só vale quando a resposta **também** não termina de forma conclusiva
(`ENDS_CONCLUSIVELY`), o que preserva a detecção real ("O plano Essencial" — cortado,
sem pontuação) sem punir respostas curtas legítimas.

> **Como apareceu**: escrevendo os testes do `PD-07`. O fake de resposta tinha 19 chars
> e a rodada emitia um `agent_warning` inesperado — o teste estava "errado" pelo motivo
> certo. Bug que existia em produção e ninguém tinha isolado.

### PD-04 — Cobertura de testes + CI 🟡
De **zero** testes para **81**, rodando em ~4s sem HTTP, sem banco e sem Gemini.

| Arquivo | Cobre |
|---|---|
| `orchestrate-conversation.test.ts` | rodada completa: cadeia, síntese, `modo_resposta`, falha do provedor, RAG fora do ar |
| `orchestration-helpers.test.ts` | filtro de histórico (isolamento entre agentes), `tryParseAgentAction`, `findTargetAgent` |
| `runtime.test.ts` | `classifyModelError`, `isProbablyIncompleteAnswer`, `withRetryBeforeStreaming`, `withTimeout`, `removeActionJson` |
| `knowledge-repository.test.ts` | fallback textual do RAG (`extractSearchTerms`, `scoreKeywordMatch`) |
| `chunk-text.test.ts` | fatiamento, overlap, regressão de laço infinito |
| `response-mode.test.ts` | presets e fallback para o padrão |

**CI** em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): lint → testes →
type-check → build, em push na `main` e em PR. Node 22 (mesma major do Dockerfile).

O passo de **build** é proposital: é o único que pega import de módulo server-only em
client component (`tsc --noEmit` passa nesse caso — foi o que quase aconteceu no
`PD-10`). Usa variáveis fictícias — o build não conecta em nada, mas os módulos são
avaliados e o `admin.ts` constrói o client no import. **Validado**: build roda com
`.env.local` ausente, como no CI.

**Comportamentos que os testes documentaram** (eram desconhecidos):
- `extractSearchTerms("R$100")` → `"r100"`, não `"100"` — o `$` some e o `r` fica colado.
  Só casa se a base escrever exatamente `R$100`; com espaço (`R$ 100`), o `100` tem
  3 chars e é descartado.
- Siglas de 3 letras (`NFe`, `ISS`, `CPF`) não sobrevivem ao piso de 4 chars do fallback.

Nenhum dos dois é bug fatal — o caminho semântico continua funcionando —, mas estão
travados por teste para não mudarem sem querer.

### PD-16 — Policies duplicadas em `conversation_agents` 🟠
A última migration recriara regras owner-only via `conversations.user_id` sem remover as
por participante. Removidas as quatro duplicadas; restaram só as de participante/dono.

---

## Histórico

| Data | Item | Nota |
|---|---|---|
| _(inicial)_ | PD-01 | README reescrito para refletir Next 16 + Gemini (não Fastify/OpenAI). |
| _(inicial)_ | docs/ | Criados ARQUITETURA, BANCO-DE-DADOS, FLUXO-DE-CHAT e este backlog. |
| 2026-07-15 | PD-05 | Retry passa a autorizar por participante (via RLS), não por dono. |
| 2026-07-15 | PD-03 | Removido o motor legado, o mock e o `planAgentExecution` morto. |
| 2026-07-15 | PD-02 | Runtime de IA extraído para `services/ai/runtime.ts`; `maxOutputTokens` unificado. |
| 2026-07-15 | PD-08 | Refresh de sessão via `src/proxy.ts` (convenção Next 16, ex-`middleware.ts`). |
| 2026-07-15 | PD-17 (parcial) | Migration `20260715120000` fecha o acesso `anon` a `agents`/`agent_knowledge_files` e remove as funções de busca órfãs. Restante (RLS aberta do conhecimento) vai na migration de multi-tenant. |
| 2026-07-15 | PD-18 | Dump do banco real salvo em `supabase/schema/` (fora de `migrations/`, senão a CLI tentaria aplicá-lo). |
| 2026-07-15 | PD-17 | Migration `20260715120000` aplicada: acesso `anon` fechado, funções órfãs removidas. |
| 2026-07-15 | PD-06/06b/15/16 | Migration `20260715130000` + código aplicados. **Verificado no dump pós-aplicação**: 1 assinatura de RPC, 0 policies abertas, `organization_id NOT NULL` nas 4 tabelas, `Agente 0`/`Oráculo` na org do sistema. |
| 2026-07-15 | infra | `.gitignore` passa a bloquear `supabase/schema/*_data_*.sql` — dumps de dados (com `auth.users` e conversas) nunca vão ao Git. |
| 2026-07-15 | PD-09 | Migration `20260715150000` aplicada. **Verificado**: `storage` com 0 policies, buckets com teto de 25 MB, e **0 policies abertas em todo o schema `public`** — era o último `USING (true)` do banco. |
| 2026-07-15 | PD-07 | Orquestração extraída para `services/ai/orchestrate-conversation.ts` (generator de eventos). Handler: 939 → 76 linhas. **vitest configurado** (`npm test`) com 10 testes verdes. |
| 2026-07-15 | PD-19 | Novo: `isProbablyIncompleteAnswer` marca como truncada qualquer resposta < 40 chars. Descoberto ao escrever os testes do PD-07. |
| 2026-07-15 | PD-10 + PD-19 | Migration `20260715160000` aplicada. `modo_resposta` (leve/medio/alto) por agente, presets em `lib/response-mode.ts`, piso de 40 chars corrigido. |
| 2026-07-15 | PD-04 | Suíte em **81 testes** (RAG fallback, chunkText, runtime, helpers de orquestração) + CI no GitHub Actions (lint/test/typecheck/build). Build validado sem `.env.local`. |
