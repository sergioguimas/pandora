# 🧠 Pandora

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20pgvector-3ECF8E)
![IA](https://img.shields.io/badge/IA-Google%20Gemini-4285F4)
![License](https://img.shields.io/badge/license-private-red)

> Hub interno de agentes de IA especializados para produtividade administrativa.

Pandora é um ambiente de **múltiplos agentes de IA** onde cada agente tem função,
comportamento e base de conhecimento próprios. Diferente de um chatbot genérico, os
agentes podem trabalhar **em conjunto numa mesma conversa** — respondendo em cadeia e
tendo suas respostas consolidadas por um agente sintetizador.

---

## ✨ O que já está implementado

- 🔐 **Autenticação** via Supabase Auth (login / cadastro).
- 💬 **Chat com streaming** token-a-token (Server-Sent Events).
- 🤖 **Orquestração multi-agente**: vários agentes na mesma conversa, resposta em
  cadeia + **síntese final** automática.
- 🔁 **Chamada dinâmica entre agentes** (um agente pode acionar outro).
- 📚 **RAG (busca semântica)** por agente com **pgvector** + fallback textual por
  palavra-chave.
- ♻️ **Resiliência de IA**: retry com backoff, timeout, classificação de erros do
  provedor e detecção de respostas truncadas.
- 🧵 **"Tentar novamente"** por mensagem, com versionamento (`superseded`).
- 👥 **Organizações e compartilhamento** de conversas por participantes.
- 🎛️ **CRUD de agentes** e ingestão de base de conhecimento.
- ⚡ **Realtime** para sincronizar mensagens entre abas/participantes.

> ⚠️ Consulte [`docs/DIVIDA-TECNICA.md`](docs/DIVIDA-TECNICA.md) para o que está
> **incompleto, duplicado ou com bug conhecido** antes de mexer no código.

---

## 🧱 Stack real

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16** (App Router, React Server Components) |
| UI | **React 19** + React Compiler, Tailwind CSS v4, shadcn/ui, Radix, Framer Motion |
| Backend | **Route Handlers + Server Actions** do próprio Next (não há servidor Fastify) |
| Banco | **PostgreSQL** (Supabase) + extensão **pgvector** |
| Auth / Storage / Realtime | **Supabase** |
| IA | **Google Gemini** via `@google/genai` (geração + embeddings 768d) |
| Validação | Zod + React Hook Form |
| Infra | Docker (multi-stage, `output: standalone`) + Traefik (TLS) |

> Nota: o provider `openai` existe na interface de código mas **ainda não está
> implementado** — hoje só o Gemini funciona.

---

## 🚀 Começando

### Pré-requisitos

- **Node.js 22** (o Docker usa `node:22-alpine`; 18+ tende a funcionar).
- Conta/projeto no **Supabase** com a extensão `vector` habilitada.
- **API Key do Google Gemini**.
- [Supabase CLI](https://supabase.com/docs/guides/cli) para rodar as migrations.

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Crie um `.env.local` (para produção use `.env.production`, lido pelo `docker-compose`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # usado só no bootstrap de organização

# Gemini
GEMINI_API_KEY=<sua-api-key>
GEMINI_MODEL=gemini-2.5-flash                  # opcional (fallback do provider)
```

> Todos os arquivos `.env*` estão no `.gitignore`. **Nunca** versione a
> `SUPABASE_SERVICE_ROLE_KEY` — ela ignora o RLS.

### 3. Aplicar o schema do banco

```bash
supabase link --project-ref <ref>
supabase db push
```

Isso cria as tabelas, políticas RLS, funções, triggers, buckets de storage e faz o
**seed de 3 agentes** (`assistente-geral`, `consultor-comercial`, `analista-documental`).

### 4. Rodar em desenvolvimento

```bash
npm run dev
# http://localhost:3000
```

### Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (`standalone`) |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes (vitest) — não precisa de banco nem de API key |
| `npm run test:watch` | Testes em watch |
| `npm run reembed:knowledge` | Manutenção: regera os embeddings da base (ver aviso abaixo) |

> ⚠️ **`taskType` dos embeddings é um par.** Query usa `RETRIEVAL_QUERY` e documento usa
> `RETRIEVAL_DOCUMENT`; misturar produz vetores incomparáveis. Se mudar qualquer coisa
> em `providers/gemini-embeddings.ts`, rode `npm run reembed:knowledge` — senão os
> chunks antigos ficam num espaço vetorial diferente e o RAG deixa de encontrá-los.

O CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda lint → testes →
type-check → build em push na `main` e em PR.

> Rode `npm run build` antes de abrir PR quando mexer em módulo compartilhado: é o
> único passo que detecta import de código server-only em client component — o
> `tsc --noEmit` passa nesse caso.

---

## 🗂️ Estrutura do projeto

```
src/
├── app/
│   ├── (auth)/                  # login, cadastro
│   ├── (dashboard)/             # chat, agentes (protegido por layout server-side)
│   └── api/
│       ├── chat/stream/         # 🟢 motor principal: streaming multi-agente + RAG
│       ├── chat/retry/          # regeneração de uma resposta falha
│       ├── agents/              # endpoints de agentes
│       └── conversations/       # endpoints de conversas
├── components/                  # UI (chat/, agents/, ui/, layout/)
├── lib/                         # clients: supabase (server/client/admin/realtime), gemini, auth
├── server/
│   ├── actions/                 # Server Actions ("use server")
│   ├── repositories/            # 🔒 todo acesso a dados (sempre via RLS)
│   └── services/ai/             # provider Gemini, embeddings, RAG, ingestão
└── types/                       # tipos de domínio (database, ai)

supabase/
├── migrations/                  # histórico versionado do schema + RLS
└── schema/                      # 📌 snapshot do banco real (referência — ver PD-18)
docs/                            # 📚 documentação técnica (comece por ARQUITETURA.md)
```

> ⚠️ Nunca coloque dumps em `supabase/migrations/` — a CLI tenta aplicá-los como
> migration. Dumps de **dados** (`*_data_*.sql`) são gitignored: trazem `auth.users`
> (e-mail, hash de senha) e o conteúdo das conversas.

---

## 🔄 Fluxo de uma mensagem (resumo)

1. Cliente faz `POST /api/chat/stream` e lê a resposta como **SSE**.
2. O servidor autentica, salva a mensagem do usuário (RLS valida participação).
3. Gera **embedding** da pergunta e carrega os agentes da conversa.
4. Para cada agente: busca **RAG** → monta prompt → **stream** de tokens (com retry/timeout).
5. Se houver mais de um agente, um **agente sintetizador** consolida a resposta final.
6. Tudo é persistido em `messages` com `metadata` de orquestração e status.

Detalhes completos em [`docs/FLUXO-DE-CHAT.md`](docs/FLUXO-DE-CHAT.md).

---

## 📚 Documentação técnica

| Documento | Conteúdo |
|---|---|
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Camadas, responsabilidades, decisões e diagrama |
| [`docs/BANCO-DE-DADOS.md`](docs/BANCO-DE-DADOS.md) | Tabelas, RLS, funções, timeline das migrations |
| [`docs/FLUXO-DE-CHAT.md`](docs/FLUXO-DE-CHAT.md) | Streaming, orquestração, RAG, retry, eventos SSE |
| [`docs/DIVIDA-TECNICA.md`](docs/DIVIDA-TECNICA.md) | Backlog rastreável: bugs, duplicação, código morto |

---

## 🗺️ Roadmap

- **Fase 1 — MVP** ✅ auth, agentes, chat, RAG, streaming
- **Fase 2** ✅ organizações, compartilhamento, multi-agente por conversa
- **Fase 3** 🔜 memória persistente, sugestões automáticas, templates
- **Futuro** 🔮 integrações externas, multi-tenant real, white-label, automação de fluxos

---

## 📄 Licença

Uso interno — projeto privado.
