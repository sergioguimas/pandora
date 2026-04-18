-- =====================================================
-- 1. AUTO CREATE PROFILE ON SIGNUP
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- =====================================================
-- 2. STORAGE POLICIES
-- =====================================================

-- Buckets:
-- message-attachments
-- agent-knowledge

-- =========================
-- SELECT (DOWNLOAD)
-- =========================

create policy "authenticated_can_select_attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
);

create policy "authenticated_can_select_agent_knowledge"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agent-knowledge'
);


-- =========================
-- INSERT (UPLOAD)
-- =========================

create policy "authenticated_can_upload_attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
);

create policy "authenticated_can_upload_agent_knowledge"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agent-knowledge'
);


-- =========================
-- DELETE (opcional)
-- =========================

create policy "authenticated_can_delete_attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
);

create policy "authenticated_can_delete_agent_knowledge"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agent-knowledge'
);