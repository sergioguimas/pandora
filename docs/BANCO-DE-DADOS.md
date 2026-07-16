# Banco de Dados — Pandora

Postgres gerenciado pelo **Supabase**, com extensões `pgcrypto` e `vector` (pgvector).
**A fronteira de segurança é o RLS** — quase todo acesso passa pelo client com sessão
do usuário.

> ⚠️ **Fonte da verdade**: use o snapshot em
> [`supabase/schema/`](../supabase/schema/) (schema-only, versionado). As migrations
> sofreram drift — houve objetos em produção que nenhuma migration criava (`PD-18`).
> Dumps de **dados** ficam fora do Git (contêm `auth.users` e as conversas).

## 1. Tabelas

### Núcleo

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `profiles` | Perfil 1:1 com `auth.users` | `id` (FK auth.users), `nome`, `email`, `avatar_url` |
| `agents` | Agentes, **por organização** | `organization_id` (NOT NULL), `slug` (**único por org**), `nome`, `prompt_base`, `provider`, `model`, `temperature`, `max_history_messages`, `modo_resposta` (`leve`/`medio`/`alto`), `ativo`, `knowledge_space_id`, `category`, `tags[]` |
| `conversations` | Conversas | `user_id`, `agent_id` (principal), `organization_id`, `titulo`, `updated_at` |
| `conversation_agents` | Agentes ativos por conversa (N:N) | `conversation_id`, `agent_id`, `ordem` |
| `messages` | Mensagens | `conversation_id`, `user_id`, `role` (`user`/`assistant`/`system`), `content`, `metadata` (JSONB) |
| `message_attachments` | Anexos de mensagem | `message_id`, `storage_path`, `mime_type`, `tamanho_bytes` |

### Organizações e compartilhamento (Fase 2)

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `organizations` | Organização (tenant) | `id`, `name`, `is_system` |
| `organization_members` | Vínculo usuário↔org | `organization_id`, `user_id`, `role` (`owner`/`admin`/`member`), único por par |
| `conversation_participants` | Participantes de uma conversa | `conversation_id`, `user_id`, `role` (`owner`/`member`), único por par |

### Base de conhecimento / RAG

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `knowledge_spaces` | Agrupador de conhecimento, **por organização** | `id`, `nome`, `organization_id` (NOT NULL), `is_default` (máx. 1 por org) |
| `knowledge_documents` | Documento ingerido | `agent_id`, `organization_id` (NOT NULL), `conversation_id?`, `knowledge_space_id?`, `scope` (`global`/`conversation`/`space`), `status` (`pending`/`processing`/`ready`/`error`) |
| `knowledge_chunks` | Trechos vetorizados | `document_id`, `agent_id`, `organization_id` (NOT NULL), `knowledge_space_id?`, `scope`, `chunk_index`, `content`, `embedding vector(768)` |

**Índice vetorial**: `knowledge_chunks.embedding` usa **HNSW** com
`vector_cosine_ops` (`idx_knowledge_chunks_embedding_hnsw`).

### Storage (buckets)

| Bucket | Público | Teto | Policies | Uso |
|---|---|---|---|---|
| `message-attachments` | não | 25 MB | **nenhuma (fail-closed)** | Arquivos anexados a mensagens |
| `agent-knowledge` | não | 25 MB | **nenhuma (fail-closed)** | Fontes da base de conhecimento |

> 🚧 **A funcionalidade de arquivos não existe.** Não há código que suba ou leia
> objetos; `message_attachments` e `agent_knowledge_files` estão vazias. Os buckets
> foram **fechados** em `PD-09`: antes qualquer autenticado subia/lia/apagava qualquer
> objeto, sem teto de tamanho nem de MIME — superfície de abuso para um recurso
> inexistente. Hoje: sem policy = sem acesso.

#### Checklist para quando o upload for construído

Escreva as policies **junto** com o recurso — não reabra o acesso blanket. Convenção
de path recomendada, para que a policy consiga derivar o dono a partir do nome do
objeto:

```
message-attachments/{conversation_id}/{uuid}-{arquivo}
agent-knowledge/{organization_id}/{agent_id}/{uuid}-{arquivo}
```

Com esse layout, `storage.foldername(name)` dá o escopo e a policy fica direta:

```sql
-- leitura de anexo: só participante da conversa
create policy attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_conversation_participant(
      ((storage.foldername(name))[1])::uuid, auth.uid()
    )
  );

-- leitura de fonte de conhecimento: só quem lê a org
create policy agent_knowledge_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'agent-knowledge'
    and public.can_read_org(((storage.foldername(name))[1])::uuid, auth.uid())
  );
```

Também defina `allowed_mime_types` nos buckets (hoje `null` = qualquer tipo) e
revise o `file_size_limit`, que hoje é só uma rede de segurança genérica.

## 2. Funções

| Função | Tipo | Uso |
|---|---|---|
| `match_agent_knowledge(agent, conversation, **space**, embedding, threshold, count)` | `sql stable` | **RAG**: chunks `global` (do agente) + `conversation` (da conversa) + `space` (do espaço do agente), por similaridade cosseno. Roda sob RLS do chamador — o escopo por org vale aqui também. **Assinatura única**: houve 3 overloads (`PD-15`) |
| `is_system_org(org)` | `sql security definer` | `true` se a org é a do sistema (dona dos agentes universais) |
| `can_read_org(org, user)` | `sql security definer` | `is_system_org(org) OR is_org_member(org, user)` — base de toda leitura escopada |
| `is_org_member(org, user)` | `sql security definer` | Helper de RLS (evita recursão) |
| `handle_new_user_default_organization()` | trigger `security definer` | Insere todo usuário novo na org padrão (`1111…`, hardcoded) |
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
- **`agents`** e **`knowledge_spaces`**: leitura via `can_read_org(organization_id)`
  (própria org **ou** a do sistema); escrita via `is_org_member(organization_id)`.
- **`conversations`**: acessível a quem é **participante** (`is_conversation_participant`);
  inserção exige ser membro da `organization_id`.
- **`conversation_agents`**: participantes veem; **apenas owner** adiciona/remove.
- **`messages`** / **`message_attachments`**: acessível a **participantes** da conversa.
- **`knowledge_documents`** / **`knowledge_chunks`**:
  - `scope = 'conversation'` → **participantes** da conversa;
  - demais escopos → leitura por `can_read_org()`, escrita por `is_org_member()`.
- **`organizations`** / **`organization_members`**: visíveis aos próprios membros.
- **`message_attachments`**: **participantes** da conversa da mensagem (era por dono —
  resquício da Era 1, alinhado em `PD-09`).
- **`agent_knowledge_files`**: leitura por `can_read_org()` da org do agente; escrita
  sem policy (fail-closed).
- **`storage.objects`**: **sem policy** — acesso fechado até o upload existir (`PD-09`).

### Agentes universais (org do sistema)

`Agente 0` e `Oráculo` funcionam como tutorial e devem aparecer para **toda**
organização. Em vez de flag no agente, eles pertencem a uma **organização do sistema**
(`00000000-…-0000`, `organizations.is_system = true`):

- **leitura** por `can_read_org()` → aparecem para todos, **sem clonar por org**;
- **escrita** por `is_org_member()` → a org do sistema não tem membros, logo eles são
  read-only no app (só `service_role` altera) e **ninguém injeta conhecimento `global`
  neles**, o que protege o tutorial de todos os tenants;
- o conhecimento deles vive no space `Base do Sistema` (`00000000-…-cafe`), na org do
  sistema;
- conversar com eles funciona normal: a conversa pertence à org do usuário e
  conhecimento `scope='conversation'` segue por participante.

> 🔑 **Regra de ouro do RLS aqui**: policies permissivas se combinam com **`OR`**. Uma
> única policy `USING (true)` esquecida **anula todo o escopo** da tabela. Foi
> exatamente o que aconteceu antes do `PD-17`. Ao endurecer, dropar por nome e conferir:
> ```sql
> select tablename, policyname, qual from pg_policies
> where schemaname='public' and qual = 'true';
> ```

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
| 16 | `..013953_conversation_agent_link_table` | Ajustes de vínculo conversa↔agente (recriou policies owner-only duplicadas — desfeito em #18) |
| 17 | `20260715120000_close_anon_access_and_drop_orphans` | **Era 4 (hardening)**: fecha `SELECT` para `anon` em `agents`/`agent_knowledge_files`; remove funções de busca órfãs |
| 18 | `20260715130000_multitenant_agents_knowledge_and_rls` | Org do sistema + agentes universais; `organization_id` nas 4 tabelas; RLS fechada; `slug` único por org; `match_agent_knowledge` canônica; limpeza do `conversation_agents` |
| 19 | `20260715150000_lock_down_storage_and_attachments` | Storage fail-closed; teto de 25 MB; `agent_knowledge_files` por org; `message_attachments` por participante |
| 20 | `20260715160000_add_agent_response_mode` | `agents.modo_resposta` (`leve`/`medio`/`alto`, default `medio`) — tamanho da saída configurável por agente |

> A migration #5 tem nome com placeholder (`xxxxxx`) no timestamp — padronizar num
> próximo housekeeping para não quebrar a ordenação do `supabase db push` (`PD-13`).
>
> ⚠️ As migrations 1–16 **não reconstroem o banco fielmente** (drift do `PD-18`). Uma
> migration de baseline ainda está pendente; até lá, o snapshot em `supabase/schema/`
> é a referência.

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
