create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  descricao text,
  avatar_url text,
  prompt_base text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  titulo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  nome_arquivo text not null,
  storage_path text not null,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.agent_knowledge_files (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  nome_arquivo text not null,
  storage_path text not null,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);

create index idx_conversations_user_id on public.conversations(user_id);
create index idx_conversations_agent_id on public.conversations(agent_id);
create index idx_messages_conversation_id on public.messages(conversation_id);
create index idx_message_attachments_message_id on public.message_attachments(message_id);
create index idx_agent_knowledge_files_agent_id on public.agent_knowledge_files(agent_id);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.agents enable row level security;
alter table public.agent_knowledge_files enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "agents_select_authenticated"
on public.agents
for select
to authenticated
using (true);

create policy "agent_knowledge_files_select_authenticated"
on public.agent_knowledge_files
for select
to authenticated
using (true);

create policy "conversations_select_own"
on public.conversations
for select
to authenticated
using (auth.uid() = user_id);

create policy "conversations_insert_own"
on public.conversations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "conversations_update_own"
on public.conversations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "messages_select_from_own_conversations"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "messages_insert_into_own_conversations"
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "message_attachments_select_from_own_conversations"
on public.message_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_attachments.message_id
      and c.user_id = auth.uid()
  )
);

create policy "message_attachments_insert_into_own_conversations"
on public.message_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_attachments.message_id
      and c.user_id = auth.uid()
  )
);