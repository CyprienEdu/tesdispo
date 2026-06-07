-- Schema initiale pour TesDispo
-- Groupes permanents + événements ponctuels

create extension if not exists pgcrypto;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  created_at timestamptz default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  member_name text not null,
  role text default 'member',
  created_at timestamptz default now(),
  unique(group_id, member_name)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  owner_name text not null,
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  member_name text not null,
  role text default 'member',
  created_at timestamptz default now(),
  unique(event_id, member_name)
);

-- Indisponibilités: périodes pendant lesquelles un membre n'est PAS disponible
create table if not exists availabilities (
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
create index if not exists idx_group_members_group_id on group_members(group_id);
create index if not exists idx_event_members_event_id on event_members(event_id);
create index if not exists idx_events_group_id on events(group_id);
create index if not exists idx_availabilities_scope_start_end on availabilities(scope_type, scope_id, start_ts, end_ts);
