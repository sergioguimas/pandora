create table public.conversation_agents (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,

  agent_id uuid not null
    references public.agents(id)
    on delete cascade,

  created_at timestamptz default now()
);

create unique index idx_conversation_agents_unique
on public.conversation_agents (conversation_id, agent_id);

alter table public.conversation_agents enable row level security;

-- 🔹 SELECT: participantes podem ver agentes da conversa
create policy "Participants can view conversation agents"
on public.conversation_agents
for select
to authenticated
using (
  public.is_conversation_participant(conversation_id, auth.uid())
);

-- 🔹 INSERT: apenas OWNER pode adicionar agentes
create policy "Owners can add agents to conversation"
on public.conversation_agents
for insert
to authenticated
with check (
  public.is_conversation_participant(conversation_id, auth.uid())
  AND exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_agents.conversation_id
      and cp.user_id = auth.uid()
      and cp.role = 'owner'
  )
);

-- 🔹 DELETE: apenas OWNER pode remover agentes
create policy "Owners can remove agents from conversation"
on public.conversation_agents
for delete
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_agents.conversation_id
      and cp.user_id = auth.uid()
      and cp.role = 'owner'
  )
);

-- (Opcional) UPDATE — normalmente não precisa
create policy "Owners can update conversation agents"
on public.conversation_agents
for update
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_agents.conversation_id
      and cp.user_id = auth.uid()
      and cp.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_agents.conversation_id
      and cp.user_id = auth.uid()
      and cp.role = 'owner'
  )
);