create or replace function public.is_org_member(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
  );
$$;

create or replace function public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
  );
$$;

create or replace function public.is_conversation_owner(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
      and cp.role = 'owner'
  );
$$;

drop policy if exists "Users can view organization members of their organizations" on public.organization_members;
create policy "Users can view organization members of their organizations"
on public.organization_members
for select
using (
  public.is_org_member(organization_members.organization_id, auth.uid())
);

drop policy if exists "Users can view participants of accessible conversations" on public.conversation_participants;
create policy "Users can view participants of accessible conversations"
on public.conversation_participants
for select
using (
  public.is_conversation_participant(conversation_participants.conversation_id, auth.uid())
);

drop policy if exists "Owners can insert participants into their conversations" on public.conversation_participants;
create policy "Owners can insert participants into their conversations"
on public.conversation_participants
for insert
with check (
  public.is_conversation_owner(conversation_participants.conversation_id, auth.uid())
);

drop policy if exists "Owners can delete participants from their conversations" on public.conversation_participants;
create policy "Owners can delete participants from their conversations"
on public.conversation_participants
for delete
using (
  public.is_conversation_owner(conversation_participants.conversation_id, auth.uid())
);

drop policy if exists "Participants can view shared conversations" on public.conversations;
create policy "Participants can view shared conversations"
on public.conversations
for select
using (
  public.is_conversation_participant(conversations.id, auth.uid())
);

drop policy if exists "Participants can update shared conversations" on public.conversations;
create policy "Participants can update shared conversations"
on public.conversations
for update
using (
  public.is_conversation_participant(conversations.id, auth.uid())
)
with check (
  public.is_conversation_participant(conversations.id, auth.uid())
);

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

drop policy if exists "Users can view knowledge documents" on public.knowledge_documents;
create policy "Users can view knowledge documents"
on public.knowledge_documents
for select
using (
  (
    scope = 'global'
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_documents.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and public.is_conversation_participant(knowledge_documents.conversation_id, auth.uid())
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
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_documents.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and public.is_conversation_participant(knowledge_documents.conversation_id, auth.uid())
  )
);

drop policy if exists "Users can update knowledge documents" on public.knowledge_documents;
create policy "Users can update knowledge documents"
on public.knowledge_documents
for update
using (
  (
    scope = 'global'
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_documents.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and public.is_conversation_participant(knowledge_documents.conversation_id, auth.uid())
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
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_documents.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and public.is_conversation_participant(knowledge_documents.conversation_id, auth.uid())
  )
);

drop policy if exists "Users can view knowledge chunks" on public.knowledge_chunks;
create policy "Users can view knowledge chunks"
on public.knowledge_chunks
for select
using (
  (
    scope = 'global'
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_chunks.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and public.is_conversation_participant(knowledge_chunks.conversation_id, auth.uid())
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
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_chunks.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and conversation_id is not null
    and public.is_conversation_participant(knowledge_chunks.conversation_id, auth.uid())
  )
);

drop policy if exists "Users can update knowledge chunks" on public.knowledge_chunks;
create policy "Users can update knowledge chunks"
on public.knowledge_chunks
for update
using (
  (
    scope = 'global'
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_chunks.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and public.is_conversation_participant(knowledge_chunks.conversation_id, auth.uid())
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
    and public.is_org_member(
      (
        select c.organization_id
        from public.conversations c
        where c.agent_id = knowledge_chunks.agent_id
        limit 1
      ),
      auth.uid()
    )
  )
  or
  (
    scope = 'conversation'
    and public.is_conversation_participant(knowledge_chunks.conversation_id, auth.uid())
  )
);