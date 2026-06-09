drop policy if exists "beta group members insert" on public.group_members;
create policy "beta group members insert" on public.group_members
  for insert to authenticated
  with check (
    lower(member_name) = lower(nullif(auth.jwt() ->> 'email', ''))
    or exists (
      select 1
      from public.groups g
      where g.id = group_id
        and lower(g.owner_name) = lower(nullif(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "beta event members insert" on public.event_members;
create policy "beta event members insert" on public.event_members
  for insert to authenticated
  with check (
    lower(member_name) = lower(nullif(auth.jwt() ->> 'email', ''))
    or exists (
      select 1
      from public.events e
      where e.id = event_id
        and (
          lower(e.owner_name) = lower(nullif(auth.jwt() ->> 'email', ''))
          or exists (
            select 1
            from public.groups g
            where g.id = e.group_id
              and lower(g.owner_name) = lower(nullif(auth.jwt() ->> 'email', ''))
          )
        )
    )
  );
