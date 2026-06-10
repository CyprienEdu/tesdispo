alter table public.events
  alter column group_id drop not null,
  drop constraint if exists events_group_id_fkey,
  add constraint events_group_id_fkey
    foreign key (group_id) references public.groups(id) on delete set null;

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
      and e.group_id is not null
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
        or (e.group_id is not null and private.is_group_owner(e.group_id))
      )
  )
$$;

drop policy if exists "beta events select" on public.events;
create policy "beta events select" on public.events
  for select to authenticated
  using (owner_name = private.current_user_email() or private.is_event_member(id));

drop policy if exists "beta events insert" on public.events;
create policy "beta events insert" on public.events
  for insert to authenticated
  with check (
    owner_name = private.current_user_email()
    and (group_id is null or private.is_group_member(group_id))
  );

drop policy if exists "beta events update" on public.events;
create policy "beta events update" on public.events
  for update to authenticated
  using (owner_name = private.current_user_email() or (group_id is not null and private.is_group_owner(group_id)))
  with check (owner_name = private.current_user_email() or (group_id is not null and private.is_group_owner(group_id)));

drop policy if exists "beta events delete" on public.events;
create policy "beta events delete" on public.events
  for delete to authenticated
  using (owner_name = private.current_user_email() or (group_id is not null and private.is_group_owner(group_id)));

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
          or (
            e.group_id is not null
            and exists (
              select 1
              from public.groups g
              where g.id = e.group_id
                and lower(g.owner_name) = lower(nullif((select auth.jwt()) ->> 'email', ''))
            )
          )
        )
    )
  );
