-- Workout Tracker: the cloud copy. One generic table, so the app's record shapes can change
-- without database migrations. Run once in the Supabase SQL editor.

create table if not exists public.records (
  user_id    uuid        not null references auth.users on delete cascade default auth.uid(),
  kind       text        not null check (kind in ('exercise', 'workout', 'schedule', 'session')),
  id         text        not null,
  data       jsonb       not null,                -- the full record
  updated_at timestamptz not null,                -- from the phone
  deleted    boolean     not null default false,  -- deletes are tombstones, so they sync
  synced_at  timestamptz not null default now(),  -- set by the server on every write
  primary key (user_id, kind, id)
);

-- The server's clock, not the phone's, decides what a pull has already seen.
create or replace function public.set_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists records_set_synced_at on public.records;
create trigger records_set_synced_at
  before insert or update on public.records
  for each row execute function public.set_synced_at();

create index if not exists records_user_synced on public.records (user_id, synced_at);

-- Exactly what the app needs, whether or not the project grants new tables to the API automatically:
-- signed-in users can read, add and change rows (row level security below limits them to their own);
-- anyone not signed in gets nothing. No delete: deletes are tombstones.
revoke all on public.records from anon;
revoke all on public.records from authenticated;
grant select, insert, update on public.records to authenticated;

-- Each signed-in user sees and writes only their own rows. There is no delete policy:
-- deletes are tombstones (deleted = true), written with update.
alter table public.records enable row level security;

drop policy if exists "read own records" on public.records;
create policy "read own records" on public.records
  for select using (user_id = auth.uid());

drop policy if exists "insert own records" on public.records;
create policy "insert own records" on public.records
  for insert with check (user_id = auth.uid());

drop policy if exists "update own records" on public.records;
create policy "update own records" on public.records
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
