alter table public.agents
add column if not exists updated_at timestamptz not null default now(),
add column if not exists provider text not null default 'gemini',
add column if not exists model text not null default 'gemini-2.5-flash',
add column if not exists temperature numeric(3,2) not null default 0.70,
add column if not exists max_history_messages integer not null default 12;

alter table public.agents
add constraint agents_provider_check
check (provider in ('gemini', 'openai'));

alter table public.agents
add constraint agents_temperature_check
check (temperature >= 0 and temperature <= 2);

alter table public.agents
add constraint agents_max_history_messages_check
check (max_history_messages >= 1 and max_history_messages <= 100);

create or replace function public.set_agents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agents_set_updated_at on public.agents;

create trigger trg_agents_set_updated_at
before update on public.agents
for each row
execute function public.set_agents_updated_at();

create policy "agents_insert_authenticated"
on public.agents
for insert
to authenticated
with check (true);

create policy "agents_update_authenticated"
on public.agents
for update
to authenticated
using (true)
with check (true);

create policy "agents_delete_authenticated"
on public.agents
for delete
to authenticated
using (true);