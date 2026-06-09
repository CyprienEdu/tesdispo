create schema if not exists private;
revoke all on schema private from public;

create or replace function private.current_user_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select nullif((select auth.jwt()) ->> 'email', '')
$$;

create or replace function private.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.member_name = private.current_user_email()
  )
  or exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and g.owner_name = private.current_user_email()
  )
$$;

create or replace function private.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and g.owner_name = private.current_user_email()
  )
$$;

create or replace function private.is_event_member(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.event_members em
    where em.event_id = target_event_id
      and em.member_name = private.current_user_email()
  )
  or exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and e.owner_name = private.current_user_email()
  )
  or exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and private.is_group_member(e.group_id)
  )
$$;

create or replace function private.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and (
        e.owner_name = private.current_user_email()
        or private.is_group_owner(e.group_id)
      )
  )
$$;

drop policy if exists "beta groups select" on public.groups;
create policy "beta groups select" on public.groups
  for select to authenticated
  using (owner_name = private.current_user_email() or private.is_group_member(id));

drop policy if exists "beta groups insert" on public.groups;
create policy "beta groups insert" on public.groups
  for insert to authenticated
  with check (owner_name = private.current_user_email());

drop policy if exists "beta groups update" on public.groups;
create policy "beta groups update" on public.groups
  for update to authenticated
  using (owner_name = private.current_user_email())
  with check (owner_name = private.current_user_email());

drop policy if exists "beta groups delete" on public.groups;
create policy "beta groups delete" on public.groups
  for delete to authenticated
  using (owner_name = private.current_user_email());

drop policy if exists "beta group members select" on public.group_members;
create policy "beta group members select" on public.group_members
  for select to authenticated
  using (private.is_group_member(group_id));

drop policy if exists "beta group members insert" on public.group_members;
create policy "beta group members insert" on public.group_members
  for insert to authenticated
  with check (
    lower(member_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
    or exists (
      select 1
      from public.groups g
      where g.id = group_id
        and lower(g.owner_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
    )
  );

drop policy if exists "beta group members update" on public.group_members;
create policy "beta group members update" on public.group_members
  for update to authenticated
  using (
    private.is_group_owner(group_id)
    or lower(member_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
  )
  with check (
    private.is_group_owner(group_id)
    or lower(member_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
  );

drop policy if exists "beta group members delete" on public.group_members;
create policy "beta group members delete" on public.group_members
  for delete to authenticated
  using (private.is_group_owner(group_id) or member_name = private.current_user_email());

drop policy if exists "beta events select" on public.events;
create policy "beta events select" on public.events
  for select to authenticated
  using (private.is_group_member(group_id) or private.is_event_member(id));

drop policy if exists "beta events insert" on public.events;
create policy "beta events insert" on public.events
  for insert to authenticated
  with check (owner_name = private.current_user_email() and private.is_group_member(group_id));

drop policy if exists "beta events update" on public.events;
create policy "beta events update" on public.events
  for update to authenticated
  using (owner_name = private.current_user_email() or private.is_group_owner(group_id))
  with check (owner_name = private.current_user_email() or private.is_group_owner(group_id));

drop policy if exists "beta events delete" on public.events;
create policy "beta events delete" on public.events
  for delete to authenticated
  using (owner_name = private.current_user_email() or private.is_group_owner(group_id));

drop policy if exists "beta event members select" on public.event_members;
create policy "beta event members select" on public.event_members
  for select to authenticated
  using (private.is_event_member(event_id));

drop policy if exists "beta event members insert" on public.event_members;
create policy "beta event members insert" on public.event_members
  for insert to authenticated
  with check (
    lower(member_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
    or exists (
      select 1
      from public.events e
      where e.id = event_id
        and (
          lower(e.owner_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
          or exists (
            select 1
            from public.groups g
            where g.id = e.group_id
              and lower(g.owner_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
          )
        )
    )
  );

drop policy if exists "beta event members update" on public.event_members;
create policy "beta event members update" on public.event_members
  for update to authenticated
  using (
    private.can_manage_event(event_id)
    or lower(member_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
  )
  with check (
    private.can_manage_event(event_id)
    or lower(member_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
  );

drop policy if exists "beta event members delete" on public.event_members;
create policy "beta event members delete" on public.event_members
  for delete to authenticated
  using (private.can_manage_event(event_id) or member_name = private.current_user_email());

drop policy if exists "beta availabilities select" on public.availabilities;
create policy "beta availabilities select" on public.availabilities
  for select to authenticated
  using (
    (scope_type = 'group' and private.is_group_member(scope_id))
    or (scope_type = 'event' and private.is_event_member(scope_id))
  );

drop policy if exists "beta availabilities insert" on public.availabilities;
create policy "beta availabilities insert" on public.availabilities
  for insert to authenticated
  with check (
    member_name = private.current_user_email()
    and (
      (scope_type = 'group' and private.is_group_member(scope_id))
      or (scope_type = 'event' and private.is_event_member(scope_id))
    )
  );

drop policy if exists "beta availabilities update" on public.availabilities;
create policy "beta availabilities update" on public.availabilities
  for update to authenticated
  using (member_name = private.current_user_email())
  with check (member_name = private.current_user_email());

drop policy if exists "beta availabilities delete" on public.availabilities;
create policy "beta availabilities delete" on public.availabilities
  for delete to authenticated
  using (member_name = private.current_user_email());

create or replace function public.prevent_member_self_update_changes()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  jwt_email text := lower(nullif((select auth.jwt()) ->> 'email', ''));
begin
  if lower(old.member_name) = jwt_email
    and not private.is_group_owner(old.group_id)
    and (
      new.group_id is distinct from old.group_id
      or new.member_name is distinct from old.member_name
      or new.role is distinct from old.role
    )
  then
    raise exception 'members can only no-op update their own group membership';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_event_member_self_update_changes()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  jwt_email text := lower(nullif((select auth.jwt()) ->> 'email', ''));
begin
  if lower(old.member_name) = jwt_email
    and not private.can_manage_event(old.event_id)
    and (
      new.event_id is distinct from old.event_id
      or new.member_name is distinct from old.member_name
      or new.role is distinct from old.role
    )
  then
    raise exception 'members can only no-op update their own event membership';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_member_self_update_changes() from public;
revoke execute on function public.prevent_member_self_update_changes() from anon;
revoke execute on function public.prevent_member_self_update_changes() from authenticated;
revoke execute on function public.prevent_event_member_self_update_changes() from public;
revoke execute on function public.prevent_event_member_self_update_changes() from anon;
revoke execute on function public.prevent_event_member_self_update_changes() from authenticated;

drop function if exists public.current_user_email();
drop function if exists public.is_group_member(uuid);
drop function if exists public.is_group_owner(uuid);
drop function if exists public.is_event_member(uuid);
drop function if exists public.can_manage_event(uuid);
