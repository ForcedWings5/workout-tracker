-- Workout Tracker: tidy-ups Supabase's security and performance advisors ask for.
-- Run once in the Supabase SQL editor, after 001_records.sql. Safe to run again.
-- Nothing about what the app can read or write changes.

-- The trigger function runs with a fixed, empty search path, so no other schema can shadow
-- what it calls. now() is in pg_catalog, which is always searched.
alter function public.set_synced_at() set search_path = '';

-- The policies apply to signed-in users only (anyone else already has no grants), and read
-- auth.uid() once per query instead of once per row.
drop policy if exists "read own records" on public.records;
create policy "read own records" on public.records
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "insert own records" on public.records;
create policy "insert own records" on public.records
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "update own records" on public.records;
create policy "update own records" on public.records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
