create or replace function public.prevent_member_self_update_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  if lower(old.member_name) = jwt_email
    and not public.is_group_owner(old.group_id)
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

revoke execute on function public.prevent_member_self_update_changes() from public;
revoke execute on function public.prevent_member_self_update_changes() from anon;
revoke execute on function public.prevent_member_self_update_changes() from authenticated;

drop trigger if exists prevent_group_member_self_update_changes on public.group_members;
create trigger prevent_group_member_self_update_changes
  before update on public.group_members
  for each row
  execute function public.prevent_member_self_update_changes();

drop policy if exists "beta group members update" on public.group_members;
create policy "beta group members update" on public.group_members
  for update to authenticated
  using (
    public.is_group_owner(group_id)
    or lower(member_name) = lower(nullif(auth.jwt() ->> 'email', ''))
  )
  with check (
    public.is_group_owner(group_id)
    or lower(member_name) = lower(nullif(auth.jwt() ->> 'email', ''))
  );

create or replace function public.prevent_event_member_self_update_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  if lower(old.member_name) = jwt_email
    and not public.can_manage_event(old.event_id)
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

revoke execute on function public.prevent_event_member_self_update_changes() from public;
revoke execute on function public.prevent_event_member_self_update_changes() from anon;
revoke execute on function public.prevent_event_member_self_update_changes() from authenticated;

drop trigger if exists prevent_event_member_self_update_changes on public.event_members;
create trigger prevent_event_member_self_update_changes
  before update on public.event_members
  for each row
  execute function public.prevent_event_member_self_update_changes();

drop policy if exists "beta event members update" on public.event_members;
create policy "beta event members update" on public.event_members
  for update to authenticated
  using (
    public.can_manage_event(event_id)
    or lower(member_name) = lower(nullif(auth.jwt() ->> 'email', ''))
  )
  with check (
    public.can_manage_event(event_id)
    or lower(member_name) = lower(nullif(auth.jwt() ->> 'email', ''))
  );
