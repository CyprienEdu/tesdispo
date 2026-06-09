alter table public.events
  add column if not exists availability_start_ts timestamptz,
  add column if not exists availability_end_ts timestamptz;

alter table public.events
  drop constraint if exists events_availability_window_valid,
  add constraint events_availability_window_valid
    check (
      availability_start_ts is null
      or availability_end_ts is null
      or availability_end_ts > availability_start_ts
    );

create index if not exists idx_events_availability_window
  on public.events(availability_start_ts, availability_end_ts);
