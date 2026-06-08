grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.groups,
  public.group_members,
  public.events,
  public.event_members,
  public.availabilities
to anon, authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.availabilities enable row level security;

drop policy if exists "mvp public groups" on public.groups;
create policy "mvp public groups" on public.groups
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "mvp public group_members" on public.group_members;
create policy "mvp public group_members" on public.group_members
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "mvp public events" on public.events;
create policy "mvp public events" on public.events
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "mvp public event_members" on public.event_members;
create policy "mvp public event_members" on public.event_members
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "mvp public availabilities" on public.availabilities;
create policy "mvp public availabilities" on public.availabilities
  for all to anon, authenticated
  using (true)
  with check (true);
