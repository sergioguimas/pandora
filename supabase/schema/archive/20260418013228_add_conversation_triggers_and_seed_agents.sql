create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();


create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

create trigger trg_messages_touch_conversation_updated_at
after insert on public.messages
for each row
execute function public.touch_conversation_updated_at();


insert into public.agents (
  slug,
  nome,
  descricao,
  avatar_url,
  prompt_base,
  ativo
)
values
(
  'assistente-geral',
  'Assistente Geral',
  'Agente genérico para tarefas do dia a dia, apoio operacional e produtividade.',
  null,
  'Agente base para uso geral da plataforma Pandora.',
  true
),
(
  'consultor-comercial',
  'Consultor Comercial',
  'Agente voltado para apoio em abordagens, argumentação e orientação comercial.',
  null,
  'Agente base com foco em apoio consultivo comercial.',
  true
),
(
  'analista-documental',
  'Analista Documental',
  'Agente voltado para leitura, organização e análise inicial de documentos.',
  null,
  'Agente base para apoio documental e interpretação de arquivos.',
  true
)
on conflict (slug) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  avatar_url = excluded.avatar_url,
  prompt_base = excluded.prompt_base,
  ativo = excluded.ativo;


insert into storage.buckets (id, name, public)
values
  ('message-attachments', 'message-attachments', false),
  ('agent-knowledge', 'agent-knowledge', false)
on conflict (id) do nothing;