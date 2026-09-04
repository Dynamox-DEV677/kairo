-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 0 — fix the 500 that has been killing every write since RLS went on.
--
-- THE ACTUAL ERROR, read from the live REST API (not guessed):
--
--   GET /rest/v1/users  ->  500
--   {"code":"42P17","message":"infinite recursion detected in policy for
--    relation \"users\""}
--
-- Some policy on public.users runs a SELECT against public.users inside its
-- own USING/WITH CHECK clause. That subquery re-triggers the same policy,
-- which re-runs the subquery, forever. Postgres aborts with 42P17 and
-- PostgREST turns it into a 500.
--
-- It breaks READS as well as writes, which is the whole symptom: the boot
-- lookup 500s, so the app thinks the row is missing, so it upserts, so that
-- 500s too, and an empty catch swallows both. Nothing has persisted since.
--
-- THE FIX IS NOT "DISABLE RLS". The anon key is in the client bundle by
-- design, so a table without RLS is readable by anyone on the internet, and
-- this is children's data. Instead: every policy is rewritten so it never
-- reads users from inside a users policy. Where a policy genuinely needs to
-- know the caller's school or role, it calls a SECURITY DEFINER function,
-- which runs as the owner and therefore does not re-enter RLS.
--
-- Paste into Supabase ▸ SQL Editor ▸ Run. Idempotent; safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. the non-recursive lookups -------------------------------------------------
-- SECURITY DEFINER = runs as the function owner, so the SELECT inside does not
-- evaluate the users policies again. This is what breaks the cycle.
-- STABLE lets the planner call it once per statement instead of once per row.

create or replace function public.current_school_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select school_id from public.users where id = auth.uid()
$$;

create or replace function public.current_role_name()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

revoke all on function public.current_school_id() from public;
revoke all on function public.current_role_name() from public;
grant execute on function public.current_school_id() to authenticated;
grant execute on function public.current_role_name() to authenticated;

-- 2. clear out whatever is there ------------------------------------------------
-- The recursive policy was added in the dashboard, so its name is not in this
-- repo. Drop them all by name and rebuild a set we can actually reason about.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'users'
  loop
    execute format('drop policy if exists %I on public.users', p.policyname);
  end loop;
end $$;

-- 3. RLS stays ON, with policies that do not recurse ----------------------------
alter table public.users enable row level security;

-- A student reads and writes exactly their own row. No subquery, no recursion.
create policy users_select_self on public.users
  for select to authenticated using (auth.uid() = id);

create policy users_insert_self on public.users
  for insert to authenticated with check (auth.uid() = id);

create policy users_update_self on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Staff read the students in their own school. current_school_id() is
-- SECURITY DEFINER, so this reads users WITHOUT re-entering this policy.
create policy users_select_same_school on public.users
  for select to authenticated
  using (
    school_id is not null
    and school_id = public.current_school_id()
    and public.current_role_name() in ('teacher', 'admin')
  );

-- Deliberately NO delete policy: an account is deleted through
-- POST /api/account/delete, which runs on the service-role key and removes the
-- auth user too. A client-side delete would orphan the auth record.

-- 4. schools: readable by its own members, never written from the client --------
alter table public.schools enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'schools'
  loop
    execute format('drop policy if exists %I on public.schools', p.policyname);
  end loop;
end $$;

create policy schools_select_own on public.schools
  for select to authenticated using (id = public.current_school_id());

-- 5. proof it worked ------------------------------------------------------------
-- Both of these must return without error. The first should list exactly the
-- four policies above; the second must NOT raise 42P17.
--
--   select policyname, cmd from pg_policies
--     where schemaname='public' and tablename='users' order by policyname;
--
--   select count(*) from public.users;
--
-- And from outside, with the PUBLIC anon key and no user token, this must go
-- from 500 to 200 with an empty list (RLS filtering, not an error):
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     'https://ejnkndtwntzhncdvwwvp.supabase.co/rest/v1/users?select=id&limit=1' \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
