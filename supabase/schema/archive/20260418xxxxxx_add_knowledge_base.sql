create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  conversation_id uuid null references public.conversations(id) on delete cascade,
  scope text not null check (scope in ('global', 'conversation')),
  titulo text not null,
  fonte text null,
  mime_type text null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint knowledge_documents_scope_conversation_check check (
    (scope = 'global' and conversation_id is null)
    or
    (scope = 'conversation' and conversation_id is not null)
  )
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  conversation_id uuid null references public.conversations(id) on delete cascade,
  scope text not null check (scope in ('global', 'conversation')),
  chunk_index integer not null,
  content text not null,
  metadata jsonb null,
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),

  constraint knowledge_chunks_scope_conversation_check check (
    (scope = 'global' and conversation_id is null)
    or
    (scope = 'conversation' and conversation_id is not null)
  )
);

create unique index if not exists uq_knowledge_chunks_document_chunk
  on public.knowledge_chunks(document_id, chunk_index);

create index if not exists idx_knowledge_documents_agent_id
  on public.knowledge_documents(agent_id);

create index if not exists idx_knowledge_documents_conversation_id
  on public.knowledge_documents(conversation_id);

create index if not exists idx_knowledge_documents_scope
  on public.knowledge_documents(scope);

create index if not exists idx_knowledge_chunks_agent_id
  on public.knowledge_chunks(agent_id);

create index if not exists idx_knowledge_chunks_conversation_id
  on public.knowledge_chunks(conversation_id);

create index if not exists idx_knowledge_chunks_scope
  on public.knowledge_chunks(scope);

create index if not exists idx_conversations_agent_user
  on public.conversations(agent_id, user_id);

create index if not exists idx_conversations_user_id_id
  on public.conversations(user_id, id);

create index if not exists idx_knowledge_chunks_embedding_hnsw
  on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.update_knowledge_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_knowledge_documents_updated_at on public.knowledge_documents;

create trigger trg_knowledge_documents_updated_at
before update on public.knowledge_documents
for each row
execute function public.update_knowledge_documents_updated_at();

create or replace function public.match_agent_knowledge(
  p_agent_id uuid,
  p_conversation_id uuid,
  p_query_embedding extensions.vector(768),
  p_match_threshold float default 0.45,
  p_match_count int default 6
)
returns table (
  id uuid,
  document_id uuid,
  agent_id uuid,
  conversation_id uuid,
  scope text,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  (
    select
      kc.id,
      kc.document_id,
      kc.agent_id,
      kc.conversation_id,
      kc.scope,
      kc.chunk_index,
      kc.content,
      kc.metadata,
      1 - (kc.embedding <=> p_query_embedding) as similarity
    from public.knowledge_chunks kc
    where
      kc.agent_id = p_agent_id
      and kc.scope = 'global'
      and kc.embedding is not null
      and 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
    order by kc.embedding <=> p_query_embedding asc
    limit greatest(1, p_match_count / 2)
  )

  union all

  (
    select
      kc.id,
      kc.document_id,
      kc.agent_id,
      kc.conversation_id,
      kc.scope,
      kc.chunk_index,
      kc.content,
      kc.metadata,
      1 - (kc.embedding <=> p_query_embedding) as similarity
    from public.knowledge_chunks kc
    where
      kc.agent_id = p_agent_id
      and kc.scope = 'conversation'
      and kc.conversation_id = p_conversation_id
      and kc.embedding is not null
      and 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
    order by kc.embedding <=> p_query_embedding asc
    limit greatest(1, p_match_count)
  )
  order by similarity desc
  limit p_match_count;
$$;

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

drop policy if exists "Users can view knowledge documents" on public.knowledge_documents;
drop policy if exists "Users can insert knowledge documents" on public.knowledge_documents;
drop policy if exists "Users can update knowledge documents" on public.knowledge_documents;
drop policy if exists "Users can delete knowledge documents" on public.knowledge_documents;

create policy "Users can view knowledge documents"
on public.knowledge_documents
for select
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_documents.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_documents.conversation_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "Users can insert knowledge documents"
on public.knowledge_documents
for insert
with check (
  (
    scope = 'global'
    and conversation_id is null
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_documents.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_documents.conversation_id
        and c.agent_id = knowledge_documents.agent_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "Users can update knowledge documents"
on public.knowledge_documents
for update
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_documents.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_documents.conversation_id
        and c.user_id = auth.uid()
    )
  )
)
with check (
  (
    scope = 'global'
    and conversation_id is null
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_documents.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_documents.conversation_id
        and c.agent_id = knowledge_documents.agent_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "Users can delete knowledge documents"
on public.knowledge_documents
for delete
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_documents.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_documents.conversation_id
        and c.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can view knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Users can insert knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Users can update knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Users can delete knowledge chunks" on public.knowledge_chunks;

create policy "Users can view knowledge chunks"
on public.knowledge_chunks
for select
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_chunks.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_chunks.conversation_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "Users can insert knowledge chunks"
on public.knowledge_chunks
for insert
with check (
  (
    scope = 'global'
    and conversation_id is null
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_chunks.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_chunks.conversation_id
        and c.agent_id = knowledge_chunks.agent_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "Users can update knowledge chunks"
on public.knowledge_chunks
for update
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_chunks.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_chunks.conversation_id
        and c.user_id = auth.uid()
    )
  )
)
with check (
  (
    scope = 'global'
    and conversation_id is null
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_chunks.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_chunks.conversation_id
        and c.agent_id = knowledge_chunks.agent_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "Users can delete knowledge chunks"
on public.knowledge_chunks
for delete
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.conversations c
      where c.agent_id = knowledge_chunks.agent_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversations c
      where c.id = knowledge_chunks.conversation_id
        and c.user_id = auth.uid()
    )
  )
);

grant execute on function public.match_agent_knowledge(uuid, uuid, extensions.vector(768), float, int) to authenticated;