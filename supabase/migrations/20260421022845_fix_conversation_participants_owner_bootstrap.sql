drop policy if exists "Owners can insert participants into their conversations" on public.conversation_participants;

create policy "Owners can insert participants into their conversations"
on public.conversation_participants
for insert
with check (
  (
    -- bootstrap do primeiro owner
    conversation_participants.role = 'owner'
    and conversation_participants.user_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.user_id = auth.uid()
    )
  )
  or
  (
    -- owner já existente pode adicionar outras pessoas
    public.is_conversation_owner(conversation_participants.conversation_id, auth.uid())
  )
);