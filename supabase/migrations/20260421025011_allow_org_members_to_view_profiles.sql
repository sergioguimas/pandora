alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can view organization profiles" on public.profiles;

create policy "Users can view organization profiles"
on public.profiles
for select
using (
  exists (
    select 1
    from public.organization_members om_me
    join public.organization_members om_target
      on om_target.organization_id = om_me.organization_id
    where om_me.user_id = auth.uid()
      and om_target.user_id = profiles.id
  )
);