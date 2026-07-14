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

> `planAgentExecution` (um "orquestrador" que escolheria quais agentes respondem via
> LLM) **existe mas está desativado** (`void planAgentExecution`). A ordem é sempre a
> de `listAgentsByConversation`. Rastreado em `docs/DIVIDA-TECNICA.md`.

## 3. RAG (busca de conhecimento)

`matchKnowledge` (`server/repositories/knowledge-repository.ts`):

1. **Busca semântica** via RPC `match_agent_knowledge` (similaridade cosseno, pgvector).
   Combina chunks `global` (do agente) + `conversation` (da conversa).
2. **Fallback textual**: se a busca semântica não retornar nada, extrai termos
   (≥4 chars) da pergunta e faz match por palavra-chave sobre os chunks `ready`,
   pontuando por ocorrência. Robusto quando o embedding não "casa".

**Ingestão** (`ingest-agent-knowledge.ts`): cria o documento (`processing`) →
`chunkText` (1200 chars, overlap 200) → embedding por chunk (`gemini-embedding-001`,
768d) → insere chunks → marca documento `ready`.

> Otimização pendente: query e documento usam o mesmo embedding sem `taskType`
> (`RETRIEVAL_QUERY` vs `RETRIEVAL_DOCUMENT`), o que o Gemini suporta e melhora recall.

## 4. Retry (regenerar uma resposta)

`src/app/api/chat/retry/route.ts` — regenera **uma** resposta de assistente marcada
como `retryable`:

1. Autentica; carrega a mensagem falha (precisa ter `retryable: true`).
2. **Verifica a conversa** — hoje via `conversations.user_id = auth.uid()`
   (⚠️ **inconsistente com o modelo de participantes** — ver dívida técnica).
3. Recupera a mensagem original do usuário e o agente (`agent_id`/`slug`).
4. Refaz RAG + histórico filtrado + streaming (`maxOutputTokens: 1800`).
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

## 7. Pontos de atenção ao editar este fluxo

- **`classifyModelError`, `withRetry`, `withTimeout`, `saveMessage`,
  `buildSystemInstruction` estão duplicados** entre `stream` e `retry`, já com valores
  divergentes (`maxOutputTokens` 2000 vs 1800). Alterar num sem o outro cria
  divergência silenciosa. Extração para `lib/ai-runtime` é a prioridade 2 do backlog.
- O handler mistura HTTP + negócio + persistência; qualquer refactor deve preservar o
  **contrato SSE** acima (o cliente depende dele).
