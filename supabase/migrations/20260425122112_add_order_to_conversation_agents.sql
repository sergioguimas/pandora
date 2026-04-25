alter table public.conversation_agents
add column if not exists ordem integer not null default 0;

create index if not exists idx_conversation_agents_order
on public.conversation_agents(conversation_id, ordem, created_at);

with ranked as (
  select
    id,
    row_number() over (
      partition by conversation_id
      order by created_at asc
    ) as rn
  from public.conversation_agents
)
update public.conversation_agents ca
set ordem = ranked.rn
from ranked
where ranked.id = ca.id;