# Banco de Dados — Pandora

Postgres gerenciado pelo **Supabase**, com extensões `pgcrypto` e `vector` (pgvector).
Todo o schema é versionado em `supabase/migrations/`. **A fronteira de segurança é o
RLS** — quase todo acesso passa pelo client com sessão do usuário.

## 1. Tabelas

### Núcleo

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `profiles` | Perfil 1:1 com `auth.users` | `id` (FK auth.users), `nome`, `email`, `avatar_url` |
| `agents` | Catálogo de agentes | `slug` (único), `nome`, `prompt_base`, `provider`, `model`, `temperature`, `max_history_messages`, `ativo`, `knowledge_space_id`, `category`, `tags[]` |
| `conversations` | Conversas | `user_id`, `agent_id` (principal), `organization_id`, `titulo`, `updated_at` |
| `conversation_agents` | Agentes ativos por conversa (N:N) | `conversation_id`, `agent_id`, `ordem` |
| `messages` | Mensagens | `conversation_id`, `user_id`, `role` (`user`/`assistant`/`system`), `content`, `metadata` (JSONB) |
| `message_attachments` | Anexos de mensagem | `message_id`, `storage_path`, `mime_type`, `tamanho_bytes` |

### Organizações e compartilhamento (Fase 2)

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `organizations` | Organização (tenant) | `id`, `name` |
| `organization_members` | Vínculo usuário↔org | `organization_id`, `user_id`, `role` (`owner`/`admin`/`member`), único por par |
| `conversation_participants` | Participantes de uma conversa | `conversation_id`, `user_id`, `role` (`owner`/`member`), único por par |

### Base de conhecimento / RAG

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `knowledge_spaces` | Agrupador de conhecimento | `id`, `nome` |
| `knowledge_documents` | Documento ingerido | `agent_id`, `conversation_id?`, `scope` (`global`/`conversation`), `status` (`pending`/`processing`/`ready`/`error`), `knowledge_space_id?` |
| `knowledge_chunks` | Trechos vetorizados | `document_id`, `agent_id`, `scope`, `chunk_index`, `content`, `embedding vector(768)` |

**Índice vetorial**: `knowledge_chunks.embedding` usa **HNSW** com
`vector_cosine_ops` (`idx_knowledge_chunks_embedding_hnsw`).

### Storage (buckets)

| Bucket | Público | Uso |
|---|---|---|
| `message-attachments` | não | Arquivos anexados a mensagens |
| `agent-knowledge` | não | Fontes da base de conhecimento |

## 2. Funções

| Função | Tipo | Uso |
|---|---|---|
| `match_agent_knowledge(agent, conversation, embedding, threshold, count)` | `sql stable` | **RAG**: retorna chunks `global` do agente + `conversation` da conversa, ordenados por similaridade cosseno. Roda sob RLS do chamador |
| `is_org_member(org, user)` | `sql security definer` | Helper de RLS (evita recursão) |
| `is_conversation_participant(conv, user)` | `sql security definer` | Helper de RLS |
| `is_conversation_owner(conv, user)` | `sql security definer` | Helper de RLS |
| `handle_new_user()` | trigger `security definer` | Cria `profile` no signup (`on_auth_user_created`) |
| `set_updated_at()` / `set_agents_updated_at()` / `update_knowledge_documents_updated_at()` | triggers | Mantêm `updated_at` |
| `touch_conversation_updated_at()` | trigger | Atualiza `conversations.updated_at` a cada nova mensagem |

> **Padrão importante de RLS**: os helpers `is_*` são `SECURITY DEFINER` justamente
> para **quebrar recursão infinita** de políticas que se referenciam entre si
> (`conversations` ↔ `conversation_participants` ↔ `messages`). Ao criar novas
> políticas que cruzem essas tabelas, **use os helpers**, não subconsultas diretas.

## 3. Row Level Security (RLS) — modelo mental

Todas as tabelas de dados têm RLS **habilitado**. Regras vigentes:

- **`profiles`**: usuário vê/edita o próprio; membros da mesma org podem ver perfis
  (para exibir participantes).
- **`agents`** e **`knowledge_spaces`**: qualquer autenticado pode ver/criar/editar
  (catálogo compartilhado — ver ressalva de multi-tenant abaixo).
- **`conversations`**: acessível a quem é **participante** (`is_conversation_participant`);
  inserção exige ser membro da `organization_id`.
- **`conversation_agents`**: participantes veem; **apenas owner** adiciona/remove.
- **`messages`** / **`message_attachments`**: acessível a **participantes** da conversa.
- **`knowledge_documents`** / **`knowledge_chunks`**:
  - `scope = 'global'` → visível a **membros da organização** do agente.
  - `scope = 'conversation'` → visível a **participantes** da conversa.
- **`organizations`** / **`organization_members`**: visíveis aos próprios membros.
- **`storage.objects`**: qualquer autenticado pode ler/subir/apagar nos dois buckets
  (política ampla — ver dívida técnica).

> ⚠️ **Ressalva multi-tenant**: conhecimento `global` é ancorado em `agent_id`, não em
> `organization_id`. Como os agentes são um catálogo compartilhado, **duas organizações
> usando o mesmo agente compartilhariam a base global**. Hoje só existe a "Organização
> Padrão", então não há vazamento na prática — mas isso precisa mudar antes de
> multi-tenant real. Rastreado em `docs/DIVIDA-TECNICA.md`.

## 4. Timeline das migrations

A ordem revela a evolução do produto em três "eras". Entender isso ajuda a explicar
inconsistências no código (ver dívida técnica).

| # | Migration | O que introduziu |
|---|---|---|
| 1 | `..012412_init_pandora_schema` | **Era 1 (single-user)**: profiles, agents, conversations, messages, attachments, knowledge_files + RLS por `user_id` |
| 2 | `..013228_add_conversation_triggers_and_seed_agents` | Triggers de `updated_at`, seed de 3 agentes, buckets de storage |
| 3 | `..013457_add_profiles_trigger_and_storage_policies` | `handle_new_user` (profile no signup) + políticas de storage |
| 4 | `..044632_add_agent_runtime_settings` | `provider`, `model`, `temperature`, `max_history_messages` em `agents` + RLS de escrita |
| 5 | `..xxxxxx_add_knowledge_base` | **RAG**: `knowledge_documents`, `knowledge_chunks` (vector 768), HNSW, `match_agent_knowledge` |
| 6 | `..062038_add_phase2_organizations_and_conversation_participants` | **Era 2 (org + compartilhamento)**: organizations, members, participants, backfill, RLS por participante |
| 7 | `..013030_fix_phase2_rls_recursion` | Helpers `is_*` `SECURITY DEFINER` para **corrigir recursão de RLS** |
| 8 | `..022845_fix_phase2_conversation_participants_owner_bootstrap` | Corrige bootstrap de owner participante |
| 9 | `..025011_allow_org_members_to_view_profiles` | Membros da org podem ver perfis |
| 10 | `..004924_enable_realtime_for_messages` | `messages` na publicação `supabase_realtime` |
| 11 | `..012609_add_user_id_to_messages` | `messages.user_id` (autoria) |
| 12 | `..025900_create_conversation_agents` | **Era 3 (multi-agente)**: tabela N:N conversa↔agente + RLS |
| 13 | `..122112_add_order_to_conversation_agents` | `ordem` para sequência dos agentes |
| 14 | `..210411_add_knowledge_spaces_and_agent_catalog` | `knowledge_spaces`, `category`, `tags[]` em agents |
| 15 | `..211116_update_match_agent_knowledge_for_spaces` | Ajuste da RPC de RAG para spaces |
| 16 | `..013953_conversation_agent_link_table` | Ajustes de vínculo conversa↔agente |

> A migration #5 tem nome com placeholder (`xxxxxx`) no timestamp — padronizar num
> próximo housekeeping para não quebrar a ordenação do `supabase db push`.

## 5. Aplicando e evoluindo o schema

```bash
# aplicar tudo
supabase db push

# criar nova migration
supabase migration new <descricao_curta>

# rodar testes de policy (quando existirem)
supabase test db
```

**Convenções ao criar migrations:**
- Idempotência quando possível (`if not exists`, `drop policy if exists`).
- Ao mexer em RLS de `conversations`/`messages`/`participants`, use os helpers `is_*`.
- Nomeie com timestamp real (evite placeholders).
- Toda tabela nova de dados: **habilite RLS** e escreva as 4 políticas (select/insert/update/delete) explicitamente.
