-- Schema initiale pour TesDispo
-- Groupes permanents + evenements ponctuels
-- Convention MVP: member_name et owner_name contiennent l'email du compte Supabase.

create extension if not exists pgcrypto with schema public;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  created_at timestamptz default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  member_name text not null,
  role text default 'member',
  created_at timestamptz default now(),
  unique(group_id, member_name)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  owner_name text not null,
  availability_start_ts timestamptz,
  availability_end_ts timestamptz,
  -- resolved_at = date validee pour l evenement
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz default now()
);

alter table public.events
  drop constraint if exists events_availability_window_valid,
  add constraint events_availability_window_valid
    check (
      availability_start_ts is null
      or availability_end_ts is null
      or availability_end_ts > availability_start_ts
    );

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  member_name text not null,
  role text default 'member',
  created_at timestamptz default now(),
  unique(event_id, member_name)
);

-- Indisponibilites: periodes pendant lesquelles un membre n'est PAS disponible
create table if not exists public.availabilities (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('group', 'event')),
  scope_id uuid not null,
  member_name text not null,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  note text,
  created_at timestamptz default now()
);

-- Indexs utiles
create index if not exists idx_group_members_group_id on public.group_members(group_id);
create index if not exists idx_event_members_event_id on public.event_members(event_id);
create index if not exists idx_events_group_id on public.events(group_id);
create index if not exists idx_events_resolved_archived on public.events(resolved_at, archived_at);
create index if not exists idx_events_availability_window on public.events(availability_start_ts, availability_end_ts);
create index if not exists idx_availabilities_scope_start_end on public.availabilities(scope_type, scope_id, start_ts, end_ts);

-- Supabase API access (MVP)
-- L'app utilise la cle anon cote serveur. Les droits sont donc ouverts pour l'instant.
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
