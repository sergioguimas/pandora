alter publication supabase_realtime
add table public.messages;

drop policy if exists "Users can view messages of their conversations" on public.messages;
drop policy if exists "Participants can view messages of shared conversations" on public.messages;

create policy "Participants can view messages of shared conversations"
on public.messages
for select
using (
  public.is_conversation_participant(messages.conversation_id, auth.uid())
);

drop policy if exists "Participants can insert messages in shared conversations" on public.messages;

create policy "Participants can insert messages in shared conversations"
on public.messages
for insert
with check (
  public.is_conversation_participant(messages.conversation_id, auth.uid())
);

drop policy if exists "Participants can update messages metadata in shared conversations" on public.messages;

create policy "Participants can update messages metadata in shared conversations"
on public.messages
for update
using (
  public.is_conversation_participant(messages.conversation_id, auth.uid())
)
with check (
  public.is_conversation_participant(messages.conversation_id, auth.uid())
);