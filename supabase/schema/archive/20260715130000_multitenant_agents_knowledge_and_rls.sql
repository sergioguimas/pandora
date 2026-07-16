-- ============================================================================
-- Multi-tenant real + fechamento da RLS + RPC canônica de RAG
--
-- Cobre: PD-06 (conhecimento por org), PD-06b (agentes universais),
--        PD-15 (RPC duplicada / scope 'space' morto), PD-16 (policies
--        duplicadas), PD-17 (RLS aberta).
--
-- ⚠️ ACOPLADA A CÓDIGO. Aplicar JUNTO com o deploy que:
--    - preenche `organization_id` nas inserções de agente/space/conhecimento;
--    - chama `match_agent_knowledge` com a assinatura de 6 args.
--    Aplicar isolado deixa o app quebrado (inserções sem organization_id).
--
-- Referência do estado real: supabase/schema/20260715_schema_pgdump.sql
-- ============================================================================

-- Convenções de id:
--   org padrão  : 11111111-1111-1111-1111-111111111111  (já existe)
--   org sistema : 00000000-0000-0000-0000-000000000000  (criada aqui)
--   space sistema: 00000000-0000-0000-0000-00000000cafe (criado aqui)


-- ---------------------------------------------------------------------------
-- 1. Organização do sistema (dona dos agentes universais)
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists is_system boolean not null default false;

insert into public.organizations (id, name, is_system)
values ('00000000-0000-0000-0000-000000000000', 'Pandora System', true)
on conflict (id) do update set is_system = true;


-- ---------------------------------------------------------------------------
-- 2. Helpers de RLS
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER para não recursar nas policies das próprias tabelas
-- (mesmo motivo de is_org_member / is_conversation_participant).

create or replace function public.is_system_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.is_system
  );
$$;

-- Leitura: a própria org OU a org do sistema (agentes universais).
create or replace function public.can_read_org(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_system_org(p_organization_id)
      or public.is_org_member(p_organization_id, p_user_id);
$$;

grant execute on function public.is_system_org(uuid) to authenticated;
grant execute on function public.can_read_org(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. agents.organization_id
-- ---------------------------------------------------------------------------

alter table public.agents
  add column if not exists organization_id uuid
    references public.organizations(id) on delete cascade;

-- Backfill: todo agente existente pertence à org padrão...
update public.agents
set organization_id = '11111111-1111-1111-1111-111111111111'
where organization_id is null;

-- ...exceto os dois universais, que vão para a org do sistema.
-- Falha alto se não casar exatamente 2 — melhor abortar do que marcar errado
-- em silêncio (os universais sumiriam para orgs novas sem ninguém perceber).
do $$
declare
  v_count int;
  v_encontrados text;
begin
  update public.agents
  set organization_id = '00000000-0000-0000-0000-000000000000'
  where lower(nome) in ('agente 0', 'oráculo', 'oraculo');

  get diagnostics v_count = row_count;

  if v_count <> 2 then
    select coalesce(string_agg(nome, ', ' order by nome), '(nenhum)')
    into v_encontrados
    from public.agents;

    raise exception
      'PD-06b: esperados 2 agentes universais (Agente 0, Oráculo), encontrados %. Agentes no banco: %. Ajuste o filtro de nome nesta migration antes de aplicar.',
      v_count, v_encontrados;
  end if;
end $$;

alter table public.agents alter column organization_id set not null;

create index if not exists idx_agents_organization_id
  on public.agents(organization_id);

-- Slug passa a ser único POR organização (era único global).
-- O generateUniqueAgentSlug roda sob RLS e enxerga a própria org + a do sistema,
-- então continua evitando colisão dentro do que o usuário vê — que é o que o
-- roteamento /chat/[slug] precisa.
alter table public.agents drop constraint if exists agents_slug_key;

create unique index if not exists uq_agents_org_slug
  on public.agents(organization_id, slug);


-- ---------------------------------------------------------------------------
-- 4. knowledge_spaces por organização
-- ---------------------------------------------------------------------------

alter table public.knowledge_spaces
  add column if not exists organization_id uuid
    references public.organizations(id) on delete cascade,
  add column if not exists is_default boolean not null default false;

update public.knowledge_spaces
set organization_id = '11111111-1111-1111-1111-111111111111'
where organization_id is null;

-- "Base Geral" vira o space padrão da org padrão.
update public.knowledge_spaces
set is_default = true
where id = '22222222-2222-2222-2222-222222222222';

-- Space próprio para o conhecimento dos agentes universais.
insert into public.knowledge_spaces (id, nome, descricao, organization_id, is_default)
values (
  '00000000-0000-0000-0000-00000000cafe',
  'Base do Sistema',
  'Conhecimento dos agentes universais (tutorial).',
  '00000000-0000-0000-0000-000000000000',
  true
)
on conflict (id) do nothing;

alter table public.knowledge_spaces alter column organization_id set not null;

create index if not exists idx_knowledge_spaces_organization_id
  on public.knowledge_spaces(organization_id);

-- No máximo um space padrão por organização.
create unique index if not exists uq_knowledge_spaces_default_per_org
  on public.knowledge_spaces(organization_id)
  where is_default;

-- Os universais apontavam para a "Base Geral" (org padrão). Como agora eles
-- vivem na org do sistema, repontam para o space do sistema — senão o space
-- deles ficaria ilegível para orgs novas.
update public.agents
set knowledge_space_id = '00000000-0000-0000-0000-00000000cafe'
where organization_id = '00000000-0000-0000-0000-000000000000';


-- ---------------------------------------------------------------------------
-- 5. knowledge_documents / knowledge_chunks por organização
-- ---------------------------------------------------------------------------

alter table public.knowledge_documents
  add column if not exists organization_id uuid
    references public.organizations(id) on delete cascade;

alter table public.knowledge_chunks
  add column if not exists organization_id uuid
    references public.organizations(id) on delete cascade;

-- Backfill por procedência: conversa > space > agente.
-- agent_id é NOT NULL com FK, então o último coalesce sempre resolve.
update public.knowledge_documents kd
set organization_id = coalesce(
  (select c.organization_id from public.conversations c where c.id = kd.conversation_id),
  (select ks.organization_id from public.knowledge_spaces ks where ks.id = kd.knowledge_space_id),
  (select a.organization_id from public.agents a where a.id = kd.agent_id)
)
where kd.organization_id is null;

update public.knowledge_chunks kc
set organization_id = coalesce(
  (select kd.organization_id from public.knowledge_documents kd where kd.id = kc.document_id),
  (select c.organization_id from public.conversations c where c.id = kc.conversation_id),
  (select ks.organization_id from public.knowledge_spaces ks where ks.id = kc.knowledge_space_id),
  (select a.organization_id from public.agents a where a.id = kc.agent_id)
)
where kc.organization_id is null;

alter table public.knowledge_documents alter column organization_id set not null;
alter table public.knowledge_chunks alter column organization_id set not null;

create index if not exists idx_knowledge_documents_organization_id
  on public.knowledge_documents(organization_id);

create index if not exists idx_knowledge_chunks_organization_id
  on public.knowledge_chunks(organization_id);


-- ---------------------------------------------------------------------------
-- 6. RLS: agents
-- ---------------------------------------------------------------------------
-- Antes: USING (true) para qualquer autenticado (+ anon, já removido no hotfix).
-- Agora: leitura da própria org + org do sistema; escrita só na própria org.
-- Como a org do sistema não tem membros, os universais ficam read-only no app.

drop policy if exists agents_select_anon_temp    on public.agents;
drop policy if exists agents_select_authenticated on public.agents;
drop policy if exists agents_insert_authenticated on public.agents;
drop policy if exists agents_update_authenticated on public.agents;
drop policy if exists agents_delete_authenticated on public.agents;

create policy agents_select_org on public.agents
  for select to authenticated
  using (public.can_read_org(organization_id, auth.uid()));

create policy agents_insert_org on public.agents
  for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

create policy agents_update_org on public.agents
  for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

create policy agents_delete_org on public.agents
  for delete to authenticated
  using (public.is_org_member(organization_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 7. RLS: knowledge_spaces
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can view knowledge spaces"   on public.knowledge_spaces;
drop policy if exists "Authenticated users can insert knowledge spaces" on public.knowledge_spaces;
drop policy if exists "Authenticated users can update knowledge spaces" on public.knowledge_spaces;
drop policy if exists "Authenticated users can delete knowledge spaces" on public.knowledge_spaces;

create policy knowledge_spaces_select_org on public.knowledge_spaces
  for select to authenticated
  using (public.can_read_org(organization_id, auth.uid()));

create policy knowledge_spaces_insert_org on public.knowledge_spaces
  for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

create policy knowledge_spaces_update_org on public.knowledge_spaces
  for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

create policy knowledge_spaces_delete_org on public.knowledge_spaces
  for delete to authenticated
  using (public.is_org_member(organization_id, auth.uid()));


-- ---------------------------------------------------------------------------
-- 8. RLS: knowledge_documents
-- ---------------------------------------------------------------------------
-- Remove TODAS as variantes (as abertas do banco real e as escopadas das
-- migrations). Policies permissivas se somam com OR: deixar qualquer
-- `USING (true)` sobrando anula todo o escopo.

drop policy if exists "Authenticated users can view knowledge documents"   on public.knowledge_documents;
drop policy if exists "Authenticated users can insert knowledge documents" on public.knowledge_documents;
drop policy if exists "Authenticated users can update knowledge documents" on public.knowledge_documents;
drop policy if exists "Authenticated users can delete knowledge documents" on public.knowledge_documents;
drop policy if exists "Users can view knowledge documents of their agents"   on public.knowledge_documents;
drop policy if exists "Users can insert knowledge documents for their agents" on public.knowledge_documents;
drop policy if exists "Users can update knowledge documents of their agents"  on public.knowledge_documents;
drop policy if exists "Users can delete knowledge documents of their agents"  on public.knowledge_documents;
drop policy if exists "Users can view knowledge documents"   on public.knowledge_documents;
drop policy if exists "Users can insert knowledge documents" on public.knowledge_documents;
drop policy if exists "Users can update knowledge documents" on public.knowledge_documents;
drop policy if exists "Users can delete knowledge documents" on public.knowledge_documents;

-- Leitura: conhecimento de conversa segue o participante; o resto segue a org
-- (incluindo a do sistema, que é o tutorial dos universais).
create policy knowledge_documents_select on public.knowledge_documents
  for select to authenticated
  using (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.can_read_org(organization_id, auth.uid())
    end
  );

-- Escrita: nunca em org do sistema (não tem membros) → ninguém injeta
-- conhecimento global nos agentes universais.
create policy knowledge_documents_insert on public.knowledge_documents
  for insert to authenticated
  with check (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  );

create policy knowledge_documents_update on public.knowledge_documents
  for update to authenticated
  using (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  )
  with check (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  );

create policy knowledge_documents_delete on public.knowledge_documents
  for delete to authenticated
  using (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  );


-- ---------------------------------------------------------------------------
-- 9. RLS: knowledge_chunks
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can view knowledge chunks"   on public.knowledge_chunks;
drop policy if exists "Authenticated users can insert knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Authenticated users can update knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Authenticated users can delete knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Users can view knowledge chunks of their agents"   on public.knowledge_chunks;
drop policy if exists "Users can insert knowledge chunks for their agents" on public.knowledge_chunks;
drop policy if exists "Users can update knowledge chunks of their agents"  on public.knowledge_chunks;
drop policy if exists "Users can delete knowledge chunks of their agents"  on public.knowledge_chunks;
drop policy if exists "Users can view knowledge chunks"   on public.knowledge_chunks;
drop policy if exists "Users can insert knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Users can update knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Users can delete knowledge chunks" on public.knowledge_chunks;

create policy knowledge_chunks_select on public.knowledge_chunks
  for select to authenticated
  using (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.can_read_org(organization_id, auth.uid())
    end
  );

create policy knowledge_chunks_insert on public.knowledge_chunks
  for insert to authenticated
  with check (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  );

create policy knowledge_chunks_update on public.knowledge_chunks
  for update to authenticated
  using (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  )
  with check (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  );

create policy knowledge_chunks_delete on public.knowledge_chunks
  for delete to authenticated
  using (
    case
      when scope = 'conversation'
        then public.is_conversation_participant(conversation_id, auth.uid())
      else public.is_org_member(organization_id, auth.uid())
    end
  );


-- ---------------------------------------------------------------------------
-- 10. PD-16: policies duplicadas em conversation_agents
-- ---------------------------------------------------------------------------
-- A última migration recriou regras owner-only via `conversations.user_id`,
-- sem remover as por participante. Como permissivas se somam com OR, a tabela
-- ficou com dois modelos. Mantém-se só o de participante/dono.

drop policy if exists "Users can view conversation agents"   on public.conversation_agents;
drop policy if exists "Users can insert conversation agents" on public.conversation_agents;
drop policy if exists "Users can update conversation agents" on public.conversation_agents;
drop policy if exists "Users can delete conversation agents" on public.conversation_agents;


-- ---------------------------------------------------------------------------
-- 11. PD-15: match_agent_knowledge canônica (uma única assinatura)
-- ---------------------------------------------------------------------------
-- Antes existiam 3 overloads. O app chamava a de 5 args, que não filtrava
-- scope='space' → conhecimento de space era ingerido e NUNCA recuperado.
-- A de 6 args tinha bug de precedência (o threshold ligava só ao último OR)
-- e perdeu o guard de embedding nulo.
--
-- Não é SECURITY DEFINER de propósito: roda sob a RLS do chamador, então o
-- escopo por organização das policies acima também vale aqui.

drop function if exists public.match_agent_knowledge(
  uuid, uuid, extensions.vector, double precision, integer
);

drop function if exists public.match_agent_knowledge(
  uuid, uuid, uuid, extensions.vector, double precision, integer
);

create function public.match_agent_knowledge(
  p_agent_id uuid,
  p_conversation_id uuid,
  p_knowledge_space_id uuid,
  p_query_embedding extensions.vector(768),
  p_match_threshold double precision default 0.35,
  p_match_count integer default 6
)
returns table (
  id uuid,
  document_id uuid,
  agent_id uuid,
  conversation_id uuid,
  knowledge_space_id uuid,
  scope text,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.agent_id,
    kc.conversation_id,
    kc.knowledge_space_id,
    kc.scope,
    kc.chunk_index,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> p_query_embedding) as similarity
  from public.knowledge_chunks kc
  where
    kc.embedding is not null
    -- Parênteses explícitos: é aqui que a versão anterior errava a precedência.
    and (1 - (kc.embedding <=> p_query_embedding)) > p_match_threshold
    and (
      (kc.scope = 'global' and kc.agent_id = p_agent_id)
      or (kc.scope = 'conversation' and kc.conversation_id = p_conversation_id)
      or (
        kc.scope = 'space'
        and p_knowledge_space_id is not null
        and kc.knowledge_space_id = p_knowledge_space_id
      )
    )
  order by kc.embedding <=> p_query_embedding
  limit p_match_count;
$$;

grant execute on function public.match_agent_knowledge(
  uuid, uuid, uuid, extensions.vector(768), double precision, integer
) to authenticated;


-- ============================================================================
-- Verificação (rodar depois de aplicar)
-- ============================================================================
--
-- 1) Uma única assinatura de match_agent_knowledge:
--    select p.oid::regprocedure from pg_proc p
--    join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.proname='match_agent_knowledge';
--
-- 2) Os 2 universais na org do sistema:
--    select a.nome, a.slug, o.name, o.is_system
--    from public.agents a join public.organizations o on o.id = a.organization_id
--    where o.is_system;
--
-- 3) Nenhuma policy aberta sobrando:
--    select tablename, policyname, qual from pg_policies
--    where schemaname='public'
--      and tablename in ('agents','knowledge_spaces','knowledge_documents','knowledge_chunks')
--      and qual = 'true';
--
-- 4) Nada órfão sem organização:
--    select count(*) from public.knowledge_chunks where organization_id is null;
