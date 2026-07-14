# Dívida Técnica & Backlog — Pandora

Backlog **rastreável** dos problemas identificados na avaliação do código. Cada item
tem id, severidade, arquivos e ação recomendada. Use os ids (`PD-xx`) em commits e PRs.

**Legenda de severidade**
🔴 Alta — bug funcional ou risco de segurança/dados · 🟠 Média — manutenção/divergência ·
🟡 Baixa — housekeeping/otimização.

---

## Ordem sugerida de ataque

1. `PD-01` reescrever README ✅ *(feito nesta rodada)*
2. `PD-02` extrair `lib/ai-runtime` (mata a duplicação e a fonte de bugs futuros)
3. `PD-05` corrigir autorização do retry (bug funcional)
4. `PD-03` remover código morto / caminho legado
5. `PD-06` ancorar conhecimento global por organização (antes de multi-tenant)
6. `PD-04` cobrir com testes o núcleo

---

## 🔴 Alta

### PD-05 — Retry ignora o modelo de participantes
- **Onde**: `src/app/api/chat/retry/route.ts` (checagem `conversations.user_id = auth.uid()`).
- **Problema**: o `stream` autoriza por **participante** (`is_conversation_participant`),
  mas o `retry` ainda exige ser o **dono original** (`user_id`). Um participante
  convidado consegue conversar, mas o botão **"Tentar novamente" falha com 404** para
  ele. É resquício da Era 1 (single-user) convivendo com a Era 2.
- **Ação**: trocar a verificação por participação (via RLS já basta carregar a
  conversa sem o filtro `user_id`, ou usar `is_conversation_participant`). Alinhar com
  o comportamento do `stream`.
- **Aceite**: participante não-dono consegue dar retry numa resposta `retryable`.

### PD-06 — Conhecimento `global` não é isolado por organização
- **Onde**: função `match_agent_knowledge` + RLS de `knowledge_*`
  (`supabase/migrations/*add_knowledge_base*`, `*fix_phase2_rls_recursion*`).
- **Problema**: conhecimento `global` é ancorado em `agent_id`. Como `agents` é um
  catálogo compartilhado entre organizações, **duas orgs usando o mesmo agente
  compartilhariam a base global**. Hoje só há a "Organização Padrão", então não vaza na
  prática — mas quebra o roadmap de **multi-tenant/white-label**.
- **Ação**: introduzir `organization_id` em `knowledge_documents`/`knowledge_chunks`
  (ou escopar via `knowledge_spaces` por org) e filtrar na RPC + RLS. Planejar migration
  com backfill.
- **Aceite**: conhecimento global de uma org não aparece para outra org usando o mesmo agente.

---

## 🟠 Média

### PD-02 — Duplicação do runtime de IA entre `stream` e `retry`
- **Onde**: `src/app/api/chat/stream/route.ts` e `src/app/api/chat/retry/route.ts`.
- **Problema**: `classifyModelError`, `withRetryBeforeStreaming`, `withTimeout`,
  `sleep`, `saveMessage`, `buildSystemInstruction`, `sanitizeJson`, `normalizeText`,
  `removeActionJson`, `getErrorStatus` estão **copiados** nos dois arquivos — e já
  divergiram (`maxOutputTokens` 2000 vs 1800; textos de prompt diferentes).
- **Ação**: extrair um módulo `src/server/services/ai/runtime/` (ou `lib/ai-runtime`)
  com essas funções + a taxonomia de erros + o contrato SSE, e fazer ambos os handlers
  consumirem. Preservar o contrato SSE (ver `FLUXO-DE-CHAT.md`).
- **Aceite**: uma única fonte para retry/timeout/classificação/`saveMessage`;
  handlers reduzidos a orquestração.

### PD-03 — Código morto e caminho legado concorrente
- **Onde**:
  - `src/server/actions/chat-actions.ts` → `sendMessage`: motor **não-streaming,
    single-agent, sem RAG**, usando `generateWithGemini`. Concorre com o `stream`.
  - `src/app/api/chat/stream/route.ts` → `planAgentExecution` implementado mas
    desativado (`void planAgentExecution`).
  - `src/server/services/ai/generate-agent-response.ts` + `providers/gemini-provider.ts`
    só servem esse caminho legado.
  - `src/server/services/ai/mock-agent-response.ts` (verificar uso).
- **Problema**: dois motores de resposta divergentes; risco de "arrumei no chat e
  continua errado no outro caminho".
- **Ação**: decidir por caminho **único**. Ou remover `sendMessage`/`generate-agent-response`
  (se o `stream` cobre tudo), ou promover `planAgentExecution` a orquestrador real.
  Documentar a decisão.
- **Aceite**: um único motor de resposta; sem referências mortas.

### PD-07 — Handler HTTP com lógica de negócio pesada ("god file")
- **Onde**: `src/app/api/chat/stream/route.ts` (~1.100+ linhas).
- **Problema**: HTTP + auth + RAG + orquestração + síntese + persistência + erro num só
  arquivo. Difícil de testar e de evoluir.
- **Ação** (depende de `PD-02`): mover a orquestração para um service
  (`server/services/ai/orchestrate-conversation.ts`) que receba dependências e emita
  eventos; o handler vira apenas adaptador SSE.
- **Aceite**: a orquestração é testável sem subir uma request HTTP.

### PD-08 — Sem `middleware.ts` (refresh de sessão)
- **Onde**: projeto (ausência de `middleware.ts`).
- **Problema**: o padrão Supabase SSR usa middleware para **renovar o token** a cada
  request. Sem ele, a sessão pode expirar em navegação longa e o gate fica só no layout
  do dashboard.
- **Ação**: adicionar `middleware.ts` com refresh de sessão do `@supabase/ssr` e,
  opcionalmente, proteção de rota antecipada.
- **Aceite**: sessão renovada automaticamente; sem logout inesperado por token velho.

### PD-09 — Políticas de Storage amplas demais
- **Onde**: `supabase/migrations/*add_profiles_trigger_and_storage_policies*`.
- **Problema**: qualquer autenticado pode **ler/subir/apagar** em `message-attachments`
  e `agent-knowledge`, sem escopo por conversa/org. Um usuário pode baixar anexos de
  outro se souber o `storage_path`.
- **Ação**: escopar as políticas por dono/participante (ex.: prefixar caminhos por
  `conversation_id`/`org_id` e validar na policy).
- **Aceite**: usuário só acessa objetos de conversas/orgs de que participa.

---

## 🟡 Baixa

### PD-04 — Ausência de testes automatizados e CI
- **Ação**: começar por unidades puras de alto valor: `classifyModelError`,
  `isProbablyIncompleteAnswer`, `chunkText`, `shouldIncludeHistoryMessageForAgent`,
  `matchKnowledge` (fallback). Adicionar `supabase test db` para as RLS. Pipeline de
  lint+test no CI.

### PD-10 — `maxOutputTokens` fixo + heurística de truncamento
- **Onde**: `stream` (2000) e `retry` (1800).
- **Problema**: respostas longas (tabelas de custo — caso de uso citado) truncam, e o
  sistema apenas *detecta* via heurística. Trata sintoma, não causa.
- **Ação**: tornar configurável por agente (coluna em `agents`) e/ou aumentar o limite;
  reavaliar a heurística depois.

### PD-11 — Embeddings sem `taskType`
- **Onde**: `src/server/services/ai/providers/gemini-embeddings.ts`.
- **Problema**: query e documento usam a mesma chamada sem `RETRIEVAL_QUERY` /
  `RETRIEVAL_DOCUMENT`, o que o Gemini suporta e melhora o recall do RAG.
- **Ação**: diferenciar `taskType` entre `generateQueryEmbedding` e
  `generateDocumentEmbedding`.

### PD-12 — Provider OpenAI declarado mas não implementado
- **Onde**: `generate-agent-response.ts` (e o próprio `stream` só usa Gemini).
- **Ação**: implementar de fato **ou** remover da interface/opções até existir, para
  não sugerir uma capacidade inexistente.

### PD-13 — Migration com timestamp placeholder
- **Onde**: `supabase/migrations/20260418xxxxxx_add_knowledge_base.sql`.
- **Ação**: renomear com timestamp real para não arriscar a ordenação do `db push`.

### PD-14 — README ↔ código (manter sincronizado)
- **Ação**: `PD-01` corrigiu o descompasso principal. Manter a regra: **toda mudança
  de arquitetura/stack atualiza `README.md` e o doc relevante em `docs/`** no mesmo PR.

---

## Histórico

| Data | Item | Nota |
|---|---|---|
| _(inicial)_ | PD-01 | README reescrito para refletir Next 16 + Gemini (não Fastify/OpenAI). |
| _(inicial)_ | docs/ | Criados ARQUITETURA, BANCO-DE-DADOS, FLUXO-DE-CHAT e este backlog. |
