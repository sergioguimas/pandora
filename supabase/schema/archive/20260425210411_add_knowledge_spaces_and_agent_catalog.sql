create table if not exists public.knowledge_spaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_spaces_nome
on public.knowledge_spaces(nome);

alter table public.knowledge_spaces enable row level security;

create policy "Authenticated users can view knowledge spaces"
on public.knowledge_spaces
for select
to authenticated
using (true);

create policy "Authenticated users can insert knowledge spaces"
on public.knowledge_spaces
for insert
to authenticated
with check (true);

create policy "Authenticated users can update knowledge spaces"
on public.knowledge_spaces
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete knowledge spaces"
on public.knowledge_spaces
for delete
to authenticated
using (true);

alter table public.agents
add column if not exists knowledge_space_id uuid null
references public.knowledge_spaces(id)
on delete set null;

alter table public.agents
add column if not exists category text null;

alter table public.agents
add column if not exists tags text[] not null default '{}';

create index if not exists idx_agents_knowledge_space_id
on public.agents(knowledge_space_id);

create index if not exists idx_agents_category
on public.agents(category);

create index if not exists idx_agents_tags
on public.agents using gin(tags);

alter table public.knowledge_documents
add column if not exists knowledge_space_id uuid null
references public.knowledge_spaces(id)
on delete cascade;

alter table public.knowledge_chunks
add column if not exists knowledge_space_id uuid null
references public.knowledge_spaces(id)
on delete cascade;

create index if not exists idx_knowledge_documents_space_id
on public.knowledge_documents(knowledge_space_id);

create index if not exists idx_knowledge_chunks_space_id
on public.knowledge_chunks(knowledge_space_id);

insert into public.knowledge_spaces (id, nome, descricao)
values (
  '22222222-2222-2222-2222-222222222222',
  'Base Geral',
  'Espaço padrão para conhecimentos compartilhados entre agentes.'
)
on conflict (id) do nothing;

update public.agents
set knowledge_space_id = '22222222-2222-2222-2222-222222222222'
where knowledge_space_id is null;