-- =========================================
-- TABELA: conversation_agents
-- =========================================

create table if not exists public.conversation_agents (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,

  agent_id uuid not null
    references public.agents(id)
    on delete cascade,

  ordem integer not null default 0,

  created_at timestamptz not null default now(),

  constraint uq_conversation_agent unique (conversation_id, agent_id)
);

-- =========================================
-- ÍNDICES
-- =========================================

create index if not exists idx_conversation_agents_conversation_id
  on public.conversation_agents(conversation_id);

create index if not exists idx_conversation_agents_agent_id
  on public.conversation_agents(agent_id);

-- =========================================
-- RLS
-- =========================================

alter table public.conversation_agents enable row level security;

-- =========================================
-- POLICIES
-- =========================================

-- 🔎 SELECT
create policy "Users can view conversation agents"
on public.conversation_agents
for select
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_agents.conversation_id
      and c.user_id = auth.uid()
  )
);

-- ➕ INSERT
create policy "Users can insert conversation agents"
on public.conversation_agents
for insert
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_agents.conversation_id
      and c.user_id = auth.uid()
  )
);

-- ✏️ UPDATE
create policy "Users can update conversation agents"
on public.conversation_agents
for update
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_agents.conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_agents.conversation_id
      and c.user_id = auth.uid()
  )
);

-- ❌ DELETE
create policy "Users can delete conversation agents"
on public.conversation_agents
for delete
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_agents.conversation_id
      and c.user_id = auth.uid()
  )
);