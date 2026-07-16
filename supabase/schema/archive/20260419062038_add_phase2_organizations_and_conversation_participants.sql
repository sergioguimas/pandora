create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_organization_members_org_id
  on public.organization_members(organization_id);

create index if not exists idx_organization_members_user_id
  on public.organization_members(user_id);

create index if not exists idx_conversations_organization_id
  on public.conversations(organization_id);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists idx_conversation_participants_conversation_id
  on public.conversation_participants(conversation_id);

create index if not exists idx_conversation_participants_user_id
  on public.conversation_participants(user_id);

-- Backfill inicial:
-- cria uma organização única provisória para os dados atuais
insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Organização Padrão')
on conflict (id) do nothing;

-- vincula conversas antigas à organização padrão
update public.conversations
set organization_id = '11111111-1111-1111-1111-111111111111'
where organization_id is null;

-- torna obrigatório após backfill
alter table public.conversations
  alter column organization_id set not null;

-- cria membership para cada usuário que já possui conversa
insert into public.organization_members (organization_id, user_id, role)
select distinct
  '11111111-1111-1111-1111-111111111111'::uuid,
  c.user_id,
  'member'
from public.conversations c
on conflict (organization_id, user_id) do nothing;

-- adiciona criador como owner participante das conversas já existentes
insert into public.conversation_participants (conversation_id, user_id, role)
select
  c.id,
  c.user_id,
  'owner'
from public.conversations c
on conflict (conversation_id, user_id) do nothing;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.conversation_participants enable row level security;

drop policy if exists "Users can view their organizations" on public.organizations;
create policy "Users can view their organizations"
on public.organizations
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "Users can view organization members of their organizations" on public.organization_members;
create policy "Users can view organization members of their organizations"
on public.organization_members
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "Users can view participants of accessible conversations" on public.conversation_participants;
create policy "Users can view participants of accessible conversations"
on public.conversation_participants
for select
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Owners can insert participants into their conversations" on public.conversation_participants;
create policy "Owners can insert participants into their conversations"
on public.conversation_participants
for insert
with check (
  exists (
    select 1
    from public.conversation_participants cp
    join public.conversations c on c.id = cp.conversation_id
    join public.organization_members om_target
      on om_target.organization_id = c.organization_id
     and om_target.user_id = conversation_participants.user_id
    where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
      and cp.role = 'owner'
  )
);

drop policy if exists "Owners can delete participants from their conversations" on public.conversation_participants;
create policy "Owners can delete participants from their conversations"
on public.conversation_participants
for delete
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
      and cp.role = 'owner'
  )
);

drop policy if exists "Participants can view shared conversations" on public.conversations;
create policy "Participants can view shared conversations"
on public.conversations
for select
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Participants can update shared conversations" on public.conversations;
create policy "Participants can update shared conversations"
on public.conversations
for update
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Members can insert conversations in their organization" on public.conversations;
create policy "Members can insert conversations in their organization"
on public.conversations
for insert
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = conversations.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "Participants can view messages of shared conversations" on public.messages;
create policy "Participants can view messages of shared conversations"
on public.messages
for select
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Participants can insert messages in shared conversations" on public.messages;
create policy "Participants can insert messages in shared conversations"
on public.messages
for insert
with check (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "Participants can update messages metadata in shared conversations" on public.messages;
create policy "Participants can update messages metadata in shared conversations"
on public.messages
for update
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

-- conhecimento específico da conversa passa a ser compartilhado via participantes
drop policy if exists "Users can view knowledge documents" on public.knowledge_documents;
create policy "Users can view knowledge documents"
on public.knowledge_documents
for select
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.organization_members om
      join public.agents a on a.id = knowledge_documents.agent_id
      join public.conversations c on c.agent_id = a.id
      where om.user_id = auth.uid()
        and om.organization_id = c.organization_id
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_documents.conversation_id
        and cp.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can insert knowledge documents" on public.knowledge_documents;
create policy "Users can insert knowledge documents"
on public.knowledge_documents
for insert
with check (
  (
    scope = 'global'
    and conversation_id is null
    and exists (
      select 1
      from public.organization_members om
      join public.conversations c on c.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and c.agent_id = knowledge_documents.agent_id
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_documents.conversation_id
        and cp.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update knowledge documents" on public.knowledge_documents;
create policy "Users can update knowledge documents"
on public.knowledge_documents
for update
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.organization_members om
      join public.conversations c on c.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and c.agent_id = knowledge_documents.agent_id
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_documents.conversation_id
        and cp.user_id = auth.uid()
    )
  )
)
with check (
  (
    scope = 'global'
    and conversation_id is null
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
  )
);

drop policy if exists "Users can delete knowledge documents" on public.knowledge_documents;
create policy "Users can delete knowledge documents"
on public.knowledge_documents
for delete
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.organization_members om
      join public.conversations c on c.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and c.agent_id = knowledge_documents.agent_id
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_documents.conversation_id
        and cp.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can view knowledge chunks" on public.knowledge_chunks;
create policy "Users can view knowledge chunks"
on public.knowledge_chunks
for select
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.organization_members om
      join public.conversations c on c.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and c.agent_id = knowledge_chunks.agent_id
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_chunks.conversation_id
        and cp.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can insert knowledge chunks" on public.knowledge_chunks;
create policy "Users can insert knowledge chunks"
on public.knowledge_chunks
for insert
with check (
  (
    scope = 'global'
    and conversation_id is null
    and exists (
      select 1
      from public.organization_members om
      join public.conversations c on c.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and c.agent_id = knowledge_chunks.agent_id
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_chunks.conversation_id
        and cp.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update knowledge chunks" on public.knowledge_chunks;
create policy "Users can update knowledge chunks"
on public.knowledge_chunks
for update
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.organization_members om
      join public.conversations c on c.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and c.agent_id = knowledge_chunks.agent_id
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_chunks.conversation_id
        and cp.user_id = auth.uid()
    )
  )
)
with check (
  (
    scope = 'global'
    and conversation_id is null
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
  )
);

drop policy if exists "Users can delete knowledge chunks" on public.knowledge_chunks;
create policy "Users can delete knowledge chunks"
on public.knowledge_chunks
for delete
using (
  (
    scope = 'global'
    and exists (
      select 1
      from public.organization_members om
      join public.conversations c on c.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and c.agent_id = knowledge_chunks.agent_id
    )
  )
  or
  (
    scope = 'conversation'
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = knowledge_chunks.conversation_id
        and cp.user_id = auth.uid()
    )
  )
);