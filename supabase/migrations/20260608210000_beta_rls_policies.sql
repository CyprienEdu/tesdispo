create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(auth.jwt() ->> 'email', '')
$$;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.member_name = public.current_user_email()
  )
  or exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and g.owner_name = public.current_user_email()
  )
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and g.owner_name = public.current_user_email()
  )
$$;

create or replace function public.is_event_member(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_members em
    where em.event_id = target_event_id
      and em.member_name = public.current_user_email()
  )
  or exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and e.owner_name = public.current_user_email()
  )
  or exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and public.is_group_member(e.group_id)
  )
$$;

create or replace function public.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and (
        e.owner_name = public.current_user_email()
        or public.is_group_owner(e.group_id)
      )
  )
$$;

revoke execute on function public.current_user_email() from public;
revoke execute on function public.is_group_member(uuid) from public;
revoke execute on function public.is_group_owner(uuid) from public;
revoke execute on function public.is_event_member(uuid) from public;
revoke execute on function public.can_manage_event(uuid) from public;
grant execute on function public.current_user_email() to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.is_event_member(uuid) to authenticated;
grant execute on function public.can_manage_event(uuid) to authenticated;

revoke all on
  public.groups,
  public.group_members,
  public.events,
  public.event_members,
  public.availabilities
from anon;

grant select, insert, update, delete on
  public.groups,
  public.group_members,
  public.events,
  public.event_members,
  public.availabilities
to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.availabilities enable row level security;

drop policy if exists "mvp public groups" on public.groups;
drop policy if exists "mvp public group_members" on public.group_members;
drop policy if exists "mvp public events" on public.events;
drop policy if exists "mvp public event_members" on public.event_members;
drop policy if exists "mvp public availabilities" on public.availabilities;

drop policy if exists "beta groups select" on public.groups;
create policy "beta groups select" on public.groups
  for select to authenticated
  using (owner_name = public.current_user_email() or public.is_group_member(id));

drop policy if exists "beta groups insert" on public.groups;
create policy "beta groups insert" on public.groups
  for insert to authenticated
  with check (owner_name = public.current_user_email());

drop policy if exists "beta groups update" on public.groups;
create policy "beta groups update" on public.groups
  for update to authenticated
  using (owner_name = public.current_user_email())
  with check (owner_name = public.current_user_email());

drop policy if exists "beta groups delete" on public.groups;
create policy "beta groups delete" on public.groups
  for delete to authenticated
  using (owner_name = public.current_user_email());

drop policy if exists "beta group members select" on public.group_members;
create policy "beta group members select" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "beta group members insert" on public.group_members;
create policy "beta group members insert" on public.group_members
  for insert to authenticated
  with check (member_name = public.current_user_email() or public.is_group_owner(group_id));

drop policy if exists "beta group members update" on public.group_members;
create policy "beta group members update" on public.group_members
  for update to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));

drop policy if exists "beta group members delete" on public.group_members;
create policy "beta group members delete" on public.group_members
  for delete to authenticated
  using (public.is_group_owner(group_id) or member_name = public.current_user_email());

drop policy if exists "beta events select" on public.events;
create policy "beta events select" on public.events
  for select to authenticated
  using (public.is_group_member(group_id) or public.is_event_member(id));

drop policy if exists "beta events insert" on public.events;
create policy "beta events insert" on public.events
  for insert to authenticated
  with check (owner_name = public.current_user_email() and public.is_group_member(group_id));

drop policy if exists "beta events update" on public.events;
create policy "beta events update" on public.events
  for update to authenticated
  using (owner_name = public.current_user_email() or public.is_group_owner(group_id))
  with check (owner_name = public.current_user_email() or public.is_group_owner(group_id));

drop policy if exists "beta events delete" on public.events;
create policy "beta events delete" on public.events
  for delete to authenticated
  using (owner_name = public.current_user_email() or public.is_group_owner(group_id));

drop policy if exists "beta event members select" on public.event_members;
create policy "beta event members select" on public.event_members
  for select to authenticated
  using (public.is_event_member(event_id));

drop policy if exists "beta event members insert" on public.event_members;
create policy "beta event members insert" on public.event_members
  for insert to authenticated
  with check (member_name = public.current_user_email() or public.can_manage_event(event_id));

drop policy if exists "beta event members update" on public.event_members;
create policy "beta event members update" on public.event_members
  for update to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

drop policy if exists "beta event members delete" on public.event_members;
create policy "beta event members delete" on public.event_members
  for delete to authenticated
  using (public.can_manage_event(event_id) or member_name = public.current_user_email());

drop policy if exists "beta availabilities select" on public.availabilities;
create policy "beta availabilities select" on public.availabilities
  for select to authenticated
  using (
    (scope_type = 'group' and public.is_group_member(scope_id))
    or (scope_type = 'event' and public.is_event_member(scope_id))
  );

drop policy if exists "beta availabilities insert" on public.availabilities;
create policy "beta availabilities insert" on public.availabilities
  for insert to authenticated
  with check (
    member_name = public.current_user_email()
    and (
      (scope_type = 'group' and public.is_group_member(scope_id))
      or (scope_type = 'event' and public.is_event_member(scope_id))
    )
  );

drop policy if exists "beta availabilities update" on public.availabilities;
create policy "beta availabilities update" on public.availabilities
  for update to authenticated
  using (member_name = public.current_user_email())
  with check (member_name = public.current_user_email());

drop policy if exists "beta availabilities delete" on public.availabilities;
create policy "beta availabilities delete" on public.availabilities
  for delete to authenticated
  using (member_name = public.current_user_email());
