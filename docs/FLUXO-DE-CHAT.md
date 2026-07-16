# Fluxo de Chat — Pandora

Este é o coração do sistema. A lógica principal vive em
`src/app/api/chat/stream/route.ts` (o maior e mais crítico arquivo do projeto) e é
consumida por `src/components/chat/chat-panel.tsx`.

## 1. Envio de mensagem (streaming)

```mermaid
sequenceDiagram
    participant C as Cliente (chat-panel.tsx)
    participant S as /api/chat/stream
    participant DB as Supabase (RLS)
    participant G as Gemini

    C->>S: POST { conversationId, content }
    S->>DB: auth.getUser()
    S->>DB: INSERT message (role=user)  ← RLS valida participação
    S-->>C: SSE: saved_user
    S->>G: embedContent(content)  (query embedding 768d)
    S->>DB: listAgentsByConversation()  (fallback: agente principal)
    alt >1 agente
        S-->>C: SSE: orchestration_plan
    end
    loop para cada agente (ordem fixa)
        S->>DB: match_agent_knowledge()  (RAG; fallback textual)
        S->>G: generateContentStream(prompt + histórico + conhecimento)
        loop tokens
            G-->>S: chunk
            S-->>C: SSE: token { agentId, agentName }
        end
        S->>DB: INSERT message (role=assistant, metadata)
        S-->>C: SSE: final { message }
    end
    alt respondeu >1 agente
        S->>G: síntese consolidada
        S-->>C: SSE: token (Síntese Pandora) + final
    end
    S-->>C: SSE: [DONE]
```

### Passo a passo (servidor)

1. **Valida payload** (`conversationId`, `content`) e **autentica**.
2. **Salva a mensagem do usuário** — a RLS (`is_conversation_participant`) é quem
   autoriza; não há checagem manual de participação aqui.
3. Abre um `ReadableStream` e emite eventos **SSE** (`data: {...}\n\n`).
4. **Embedding** da pergunta (`generateQueryEmbedding`).
5. **Resolve os agentes**: `listAgentsByConversation`; se vazio, `getFallbackAgent`
   (o `agent_id` principal da conversa).
6. **`orchestrationLocked = agentsToUse.length > 1`** — trava a ordem e desliga a
   chamada dinâmica quando há cadeia planejada.
7. Para cada agente:
   - **RAG** (`matchKnowledge`, threshold 0.35, count 4) → texto de conhecimento.
   - **`buildSystemInstruction`**: papel do agente + `prompt_base` + conhecimento +
     lista de agentes disponíveis + regras (responder em pt-BR, não inventar dados,
     usar a base, etc.) + **contrato de chamada dinâmica** (JSON `call_agent`).
   - **`chainContext`**: injeta as respostas dos agentes anteriores desta rodada.
   - **Filtra o histórico** (`shouldIncludeHistoryMessageForAgent`): descarta
     mensagens `failed`/`partial`/`superseded`/`streaming`; em cadeia, não reaproveita
     respostas de outros agentes; em agente único, mantém só respostas do mesmo agente.
     Limita a `max_history_messages` (default 12).
   - **Streaming** com `generateContentStream` (`maxOutputTokens: 2000`), envolto em
     `withRetryBeforeStreaming` (2 retries, backoff 800/2000ms) e `withTimeout` (75s).
   - **Detecção de resposta incompleta** (`isProbablyIncompleteAnswer`): markdown
     desbalanceado, terminação suspeita → marca `partial` e emite `agent_warning`.
   - **Persiste** a resposta com `metadata` de orquestração/status/erro.
8. **Síntese**: se mais de um agente respondeu, um "Sintetizador Pandora" consolida
   tudo numa resposta final (≤ 8 linhas), também via streaming.
9. Emite `[DONE]` e fecha o stream.

## 2. Orquestração multi-agente

Dois modos, decididos por quantos agentes a conversa tem:

- **Agente único**: responde e pode **acionar dinamicamente** outro agente incluindo
  no fim da resposta um JSON `{"action":"call_agent","agent":"<nome>","reason":"..."}`.
  Limitado a `MAX_DYNAMIC_CALLS = 2` e só para agentes que já pertencem à conversa
  (`findTargetAgent` por nome normalizado). O agente-alvo é enfileirado.
- **Cadeia (≥2 agentes)**: ordem **fixa** por `ordem`. Cada agente recebe as respostas
  anteriores como contexto (`chainContext`). A chamada dinâmica fica **desligada**
  (`orchestrationLocked`). No fim, roda a **síntese**.

> A ordem de execução é sempre a de `listAgentsByConversation` (campo `ordem` em
> `conversation_agents`). Não há um orquestrador que escolha agentes via LLM — o
> protótipo `planAgentExecution`, que estava morto no código, foi removido em `PD-03`.

## 3. RAG (busca de conhecimento)

`matchKnowledge` (`server/repositories/knowledge-repository.ts`):

1. **Busca semântica** via RPC `match_agent_knowledge` (similaridade cosseno, pgvector),
   assinatura de **6 args** (`agent`, `conversation`, `knowledge_space`, `embedding`,
   `threshold`, `count`). Combina três escopos:
   - `global` → do agente
   - `conversation` → da conversa
   - `space` → do espaço de conhecimento do agente
2. **Fallback textual**: se a busca semântica não retornar nada, extrai termos
   (≥4 chars) da pergunta e faz match por palavra-chave sobre os chunks `ready`,
   pontuando por ocorrência. Espelha os mesmos três escopos.

> A RPC **não** é `SECURITY DEFINER` de propósito: roda sob a RLS do chamador, então o
> escopo por organização das policies vale também para o RAG.
>
> Histórico: existiam **3 overloads** de `match_agent_knowledge` e o app chamava a de
> 5 args, que não filtrava `space` — conhecimento de espaço era ingerido e **nunca
> recuperado**. Unificado em `PD-15`; se você mudar a assinatura, **dropte a antiga**:
> `create or replace` com assinatura diferente cria overload, não substitui.

**Ingestão** (`ingest-agent-knowledge.ts`): cria o documento (`processing`) →
`chunkText` (1200 chars, overlap 200) → embedding por chunk (`gemini-embedding-001`,
768d) → insere chunks → marca documento `ready`.

> Otimização pendente: query e documento usam o mesmo embedding sem `taskType`
> (`RETRIEVAL_QUERY` vs `RETRIEVAL_DOCUMENT`), o que o Gemini suporta e melhora recall.

## 4. Retry (regenerar uma resposta)

`src/app/api/chat/retry/route.ts` — regenera **uma** resposta de assistente marcada
como `retryable`:

1. Autentica; carrega a mensagem falha (precisa ter `retryable: true`).
2. **Verifica a conversa** — o acesso é validado pela **RLS**
   (`is_conversation_participant`), então qualquer participante pode retentar, não só
   o dono (corrigido em `PD-05`).
3. Recupera a mensagem original do usuário e o agente (`agent_id`/`slug`).
4. Refaz RAG + histórico filtrado + streaming.
5. Salva a nova resposta (`retry_of_message_id`) e marca a original como
   **`superseded`**.

## 5. Contrato de eventos SSE

Formato: `data: <json>\n\n`. Sentinela final: `data: [DONE]\n\n`.

| `type` | Emitido por | Payload | Uso no cliente |
|---|---|---|---|
| `saved_user` | stream | `{ message }` | Substitui a mensagem otimista do usuário |
| `orchestration_plan` | stream | `{ agents[] }` | Mostra a ordem da cadeia |
| `token` | stream/retry | `{ token, agentId, agentName }` | Acumula no balão do agente (`temp-assistant-<agentId>`) |
| `agent_call` | stream | `{ fromAgent…, toAgent…, reason }` | Balão de sistema "X chamou Y" |
| `agent_warning` | stream | `{ agentId, code, message }` | Aviso de resposta possivelmente incompleta |
| `agent_error` | stream/retry | `{ code, status, message, retryable, partial }` | Estado de erro por agente |
| `retry_started` | retry | `{ originalMessageId, agentId }` | Marca a mensagem como "retrying" |
| `final` | stream/retry | `{ message, supersededMessageId? }` | Reconcilia o balão temporário com a mensagem persistida |
| `error` | ambos | `{ error }` | Erro fatal do stream |

### Consumo no cliente (`chat-panel.tsx`)

- Lê o corpo como stream, faz **buffering** por `\n\n`, e reduz cada evento sobre o
  estado local de mensagens.
- **Mensagens otimistas**: usa ids temporários (`temp-…`) e reconcilia quando chega o
  `final` (ou via **Realtime** com `mergeRealtimeMessage`).
- **Estado isolado por conversa** (`localMessagesState.conversationId`) — troca de
  conversa não mistura mensagens.

## 6. Modelo de estados de uma mensagem

`messages.metadata.status` guia toda a UI:

| Status | Significado |
|---|---|
| `completed` | Resposta íntegra |
| `partial` | Interrompida no meio (stream cortado ou heurística de truncamento) |
| `failed` | Falhou sem conteúdo aproveitável |
| `streaming` | Em geração (temporário, só no cliente) |
| `superseded` | Substituída por uma nova tentativa |

`retryable: true` habilita o botão "Tentar novamente". `error.code` usa a taxonomia
`MODEL_TEMPORARILY_UNAVAILABLE` / `MODEL_RATE_LIMITED` / `MODEL_TIMEOUT` /
`MODEL_STREAM_INTERRUPTED` / `MODEL_UNKNOWN_ERROR` / `MESSAGE_SAVE_FAILED`.

## 7. Runtime compartilhado

`stream` e `retry` consomem o mesmo módulo
[`src/server/services/ai/runtime.ts`](../src/server/services/ai/runtime.ts) (extraído
em `PD-02`). **Mudanças de comportamento de geração vão lá, não nos handlers** — é o
que impede os dois caminhos de divergirem de novo.

O runtime concentra:

| Item | Conteúdo |
|---|---|
| Constantes | `MODEL_TIMEOUT_MS` (75s), `RETRY_DELAYS_MS`, `MODEL_MAX_RETRIES` |
| Modo de resposta | `maxOutputTokensFor()` + presets (reexportados de `@/lib/response-mode`) |
| Erros | taxonomia `ModelErrorCode`, `ModelErrorInfo`, `ModelGenerationError`, `classifyModelError`, `getErrorStatus` |
| Resiliência | `withRetryBeforeStreaming`, `withTimeout`, `sleep` |
| SSE / dados | `sse`, `sanitizeJson`, `saveMessage`, tipo `Message` |
| Heurísticas | `normalizeText`, `removeActionJson`, `isProbablyIncompleteAnswer` |

Fica **fora** do runtime (é específico de cada rota): montagem do
`buildSystemInstruction`, filtro de histórico, orquestração da cadeia e síntese.

## 8. Onde mexer (e onde não)

Desde o `PD-07` a responsabilidade está separada:

| Camada | Arquivo | O que vai aqui |
|---|---|---|
| Adaptador HTTP | `api/chat/stream/route.ts` (~76 linhas) | auth, persistir a msg do usuário, serializar eventos como SSE |
| Orquestração | `services/ai/orchestrate-conversation.ts` | cadeia de agentes, RAG, síntese, montagem de prompt |
| Runtime | `services/ai/runtime.ts` | erro/retry/timeout/persistência — **compartilhado com o retry** |

O orquestrador é um **async generator** que emite `OrchestrationEvent`; o handler só
traduz para SSE. Consequências práticas:

- **Não** volte a colocar lógica de rodada no handler.
- Mudança de comportamento de geração vai no `runtime.ts` (senão o `retry` diverge).
- O contrato SSE da seção 5 é público — o cliente depende dele. O handler serializa o
  evento **tal como o orquestrador emite**, então mudar o payload de um evento quebra a UI.
- Teste a rodada com `deps` falsos em vez de subir request:
  ```bash
  npm test   # src/server/services/ai/orchestrate-conversation.test.ts
  ```

**Nuances que os testes fixaram** (mexeu, rode `npm test`):
- Precedência do status: `failed` vence `partial`. Stream cortado com exceção →
  `status: "failed"` + `partial: true` no evento. `status: "partial"` é só quando **não**
  houve exceção e a heurística acusou truncamento.
- Falha do RAG **não** derruba a rodada — o agente responde sem conhecimento.
- Falha do provedor vira mensagem persistida e `retryable`, que é o que habilita o
  botão "tentar novamente".
## 9. Tamanho da resposta (`modo_resposta`)

O teto de saída é um **preset por agente** (`agents.modo_resposta`), não uma constante
global. Definido em [`src/lib/response-mode.ts`](../src/lib/response-mode.ts):

| Modo | `maxOutputTokens` | Quando usar |
|---|---|---|
| `leve` | 800 | Respostas diretas; menor custo/latência |
| `medio` | 2000 | **Padrão** — idêntico ao teto global anterior |
| `alto` | 8000 | Tabelas e comparativos longos |

- Editável na UI: **Agentes → Geral → Tamanho da resposta**.
- Valor ausente/desconhecido cai em `medio` (`maxOutputTokensFor`).
- A **síntese** segue o modo do primeiro agente da cadeia — mesma regra da escolha
  de modelo.
- `alto` = 8000 fica abaixo do limite do `gemini-2.0-flash` (8192), o modelo de
  fallback da síntese. **Ao mexer nos valores, respeite o teto do modelo.**

> O módulo vive em `lib/` e não no runtime porque o editor de agentes é client
> component — e `runtime.ts` importa o client Supabase de servidor (`next/headers`),
> o que quebraria o bundle.
