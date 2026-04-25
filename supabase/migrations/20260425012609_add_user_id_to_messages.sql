alter table public.messages
add column if not exists user_id uuid null references auth.users(id) on delete set null;

create index if not exists idx_messages_user_id
on public.messages(user_id);