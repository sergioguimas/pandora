# Arquitetura — Pandora

> Última revisão: documentação inicial gerada a partir da leitura completa do código.
> Referências de arquivo apontam para o estado atual do repositório.

## 1. Visão geral

Pandora é uma aplicação **Next.js 16 (App Router)** monolítica — não há backend
separado. O "backend" são **Route Handlers** (`src/app/api/**`) e **Server Actions**
(`src/server/actions/**`) executando no runtime Node do próprio Next. Persistência,
autenticação, storage e realtime são delegados ao **Supabase**; a inteligência é
delegada ao **Google Gemini**.

```
┌─────────────────────────────────────────────────────────────┐
│                        Navegador                             │
│   React 19 (Client Components)  ◄── SSE stream ──┐           │
└──────────────┬──────────────────────────────────┼───────────┘
               │ HTTP / Server Action invocations  │
┌──────────────▼──────────────────────────────────┼───────────┐
│                    Next.js 16 (App Router)       │           │
│                                                  │           │
│  app/(auth)   app/(dashboard)     app/api/chat/stream ───────┼──► Gemini
│      │              │                    │       │           │   (gen + embed)
│  Server Components  │             Route Handlers │           │
│                     ▼                    ▼       │           │
│              server/actions ─────► server/services/ai        │
│                     │                    │                   │
│                     └──────► server/repositories ────────────┼──► Supabase
│                                (SEMPRE via RLS)              │   (Postgres +
│                                                              │    pgvector +
└──────────────────────────────────────────────────────────────┘    Auth + RT + Storage)
```

## 2. Camadas e responsabilidades

O código segue uma separação de camadas disciplinada. **Respeite-a ao evoluir.**

| Camada | Pasta | Responsabilidade | Regra |
|---|---|---|---|
| **Rotas / UI** | `app/`, `components/` | Renderização, formulários, consumo de SSE | Não acessa Supabase direto para regras de negócio; usa actions/repositories |
| **Actions** | `server/actions/` | Mutações disparadas por formulário (`"use server"`); autorização de alto nível (owner/participante) | Valida usuário e permissão antes de delegar |
| **Services (IA)** | `server/services/ai/` | Geração, embeddings, RAG, ingestão, chunking | Não conhece HTTP; recebe/devolve dados puros |
| **Repositories** | `server/repositories/` | **Todo** acesso a dados | Usa o client com sessão do usuário (RLS). Exceção única: `organization-members-repository` usa `admin` no bootstrap |
| **Clients** | `lib/` | Instanciar Supabase (server/client/admin/realtime) e Gemini | `admin.ts` = service role, uso restrito |
| **Tipos** | `types/` | Contratos de domínio (`database.ts`, `ai.ts`) | Fonte da verdade dos tipos |

### Os três clients Supabase

| Client | Arquivo | Chave | Uso |
|---|---|---|---|
| Server (RLS) | `lib/supabase/server.ts` | `ANON_KEY` + cookies da sessão | **Padrão.** Respeita RLS |
| Browser | `lib/supabase/client.ts` | `ANON_KEY` | Componentes cliente (ex.: Realtime) |
| Admin | `lib/supabase/admin.ts` | `SERVICE_ROLE_KEY` | **Ignora RLS.** Só no bootstrap de organização |
| Realtime | `lib/supabase/realtime-client.ts` | — | Assinatura de mudanças em `messages` |

> **Fronteira de segurança = RLS do Postgres**, não a aplicação. Qualquer novo
> repository deve usar `createClient()` (server) por padrão. Só use `supabaseAdmin`
> com justificativa explícita e nunca exponha a service role ao cliente.

## 3. Estrutura de rotas (App Router)

```
app/
├── (auth)/
│   ├── login/            # entra na plataforma
│   └── cadastro/         # cria conta (trigger cria profile automaticamente)
├── (dashboard)/
│   ├── layout.tsx        # 🔒 redireciona para /login se não autenticado
│   ├── chat/
│   │   ├── page.tsx      # seleção de agente / conversa
│   │   └── [slug]/       # conversa de um agente (slug do agente)
│   └── agentes/          # CRUD de agentes + base de conhecimento
└── api/
    ├── chat/stream/      # POST → SSE: motor multi-agente + RAG (arquivo central)
    ├── chat/retry/       # POST → SSE: regenera uma resposta falha
    ├── agents/           # GET/POST agentes
    └── conversations/    # conversas e agentes da conversa
```

O gate de autenticação é feito **por layout server-side** (`(dashboard)/layout.tsx`)
e reforçado por RLS. **Não há `middleware.ts`** — veja a implicação em
`docs/DIVIDA-TECNICA.md` (refresh de sessão).

## 4. Modelo de domínio (conceitual)

```
Organization 1───N OrganizationMember N───1 User(auth)
     │                                        │
     │ 1                                      │ 1
     N                                        N
Conversation ──1:1 (principal)── Agent        Profile
     │  │                          │
     │  │ N:N (conversation_agents) │  (multi-agente por conversa)
     │  └──────────────────────────┘
     │ 1
     N
  Message ──1:N── MessageAttachment
     
Agent 1───N KnowledgeDocument 1───N KnowledgeChunk(embedding 768d)
Agent N───1 KnowledgeSpace
Conversation 1───N ConversationParticipant (owner/member)
```

- Uma conversa tem **um agente principal** (`conversations.agent_id`, legado) **e**
  uma lista N:N de agentes ativos (`conversation_agents`). O motor usa a lista N:N;
  se estiver vazia, faz **fallback** para o agente principal.
- **Conhecimento** é ancorado por `agent_id` + `scope` (`global` | `conversation`).
- **Compartilhamento** é por `conversation_participants` (não por `user_id` direto).

Detalhes de tabelas, colunas e RLS em `docs/BANCO-DE-DADOS.md`.

## 5. Camada de IA

```
generate-agent-response.ts     ← dispatcher por provider (gemini | openai*)
  └─ providers/gemini-provider.ts    (geração não-streaming — usado pelo caminho legado)
  └─ providers/gemini-embeddings.ts  (query + document, gemini-embedding-001, 768d)

ingest-agent-knowledge.ts      ← pipeline de ingestão de base de conhecimento
  ├─ chunk-text.ts             (chunk 1200 / overlap 200)
  └─ gemini-embeddings         (embedding por chunk)

mock-agent-response.ts         ← respostas simuladas (dev/teste)
```

O **streaming multi-agente real vive no Route Handler** `api/chat/stream/route.ts`,
não nos services — ele chama o cliente Gemini diretamente. Essa é a principal
inconsistência arquitetural do projeto (lógica de negócio pesada dentro do handler
HTTP); veja `docs/FLUXO-DE-CHAT.md` e `docs/DIVIDA-TECNICA.md`.

`* openai`: presente na interface, lança "não implementado".

## 6. Decisões e convenções

- **Idioma do domínio em português**: colunas e campos (`nome`, `titulo`, `ordem`,
  `descricao`, `prompt_base`) e mensagens ao usuário em pt-BR. Mantenha o padrão.
- **Metadados ricos em `messages.metadata`** (JSONB): status, agente, orquestração,
  erro, versionamento de retry. É o mecanismo que sustenta a UI de estados.
- **SSE em vez de WebSocket** para o streaming de resposta; **Realtime do Supabase**
  para sincronização de inserts entre clientes.
- **`output: standalone` + Docker multi-stage** para deploy enxuto atrás do Traefik.
- **React Compiler ligado** (`reactCompiler: true`) — evite memoização manual
  desnecessária.

## 7. Ambiente e configuração

| Variável | Onde é lida | Obrigatória | Observação |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | server/client/admin | ✅ | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server/client | ✅ | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | admin | ✅ | **Secreta** — ignora RLS |
| `GEMINI_API_KEY` | `lib/gemini/client.ts` | ✅ | **Secreta** |
| `GEMINI_MODEL` | `gemini-provider.ts` | ⬜ | Fallback; agentes definem o próprio `model` |

Deploy: `docker-compose.yaml` (serviço `pandora`, porta 3000, roteado por Traefik em
`pandora.sgdev.cloud`, TLS via `certresolver=meuresolver`, rede externa `public`).
