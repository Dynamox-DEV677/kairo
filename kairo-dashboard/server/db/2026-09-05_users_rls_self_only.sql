-- ============================================================================
-- FIX: POST /rest/v1/users?on_conflict=id RETURNS 500 FOR A SIGNED-IN STUDENT
--
-- The error is 42P17, infinite recursion in a policy on public.users.
--
-- WHY THE FIRST FIX DID NOT WORK. Postgres evaluates EVERY permissive policy
-- and ORs the results -- it does not stop at the first one that passes. So for
-- a signed-in student this policy still ran on every read:
--
--     users_select_same_school ... using (school_id = public.current_school_id())
--
-- and current_school_id() does "select school_id from public.users", which
-- re-enters the policies on public.users. That is the recursion, rebuilt by the
-- fix meant to remove it. It stayed quiet for the ANONYMOUS role -- the only
-- role that can be probed from outside -- because auth.uid() is null there and
-- the planner never reaches the function.
--
-- WHAT THIS DOES. It deletes that policy instead of patching it. Nothing needs
-- it:
--   * every client read of users filters to the signed-in student's own row
--     (App.tsx, Login.tsx, KairoHome.tsx)
--   * every staff and admin read goes through the SERVER, which uses the
--     service-role key and bypasses RLS already (middleware/supabaseAuth.js,
--     routes/marks.js, routes/ops.js)
--
-- THE FUNCTIONS STAY. An earlier attempt dropped them and Postgres refused:
--   cannot drop function current_school_id() because other objects depend on it
--   DETAIL: policy schools_select_own on table schools depends on it
-- That policy is real and the client needs it -- App.tsx and Login.tsx both
-- read the schools table. Keeping the function is also CORRECT, because the
-- recursion was never the function itself. A policy on SCHOOLS that reads
-- USERS is fine: it evaluates the users policies, which after this migration
-- compare auth.uid() to id and touch no table at all, so the chain ends.
-- Only a policy on USERS that reads USERS can loop.
--
-- RLS STAYS ON. The anon key ships inside the client bundle and this is
-- children's data.
-- ============================================================================

begin;

-- 1. Every policy on users, whatever it is called, including the recursive one.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'users'
  loop execute format('drop policy if exists %I on public.users', p.policyname); end loop;
end $$;

-- 2. RLS on, self-access only. No function call, no subquery on users, so
--    these cannot recurse by construction.
alter table public.users enable row level security;

create policy users_select_self on public.users
  for select to authenticated using (auth.uid() = id);

create policy users_insert_self on public.users
  for insert to authenticated with check (auth.uid() = id);

create policy users_update_self on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- No delete policy on purpose: account deletion runs server-side with the
-- service-role key, so a stolen anon key cannot delete a child's account.

commit;

-- ============================================================================
-- RUN THIS AFTERWARDS, IN THE SAME EDITOR, AND READ THE RESULT.
--
-- Expect exactly three rows: users_insert_self, users_select_self,
-- users_update_self. The qual and with_check columns must show only
-- "(auth.uid() = id)".
--
-- If a fourth row appears, or any row mentions current_school_id or a SELECT
-- on users, an old policy survived and the 500 will continue.
-- ============================================================================
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'users'
 order by policyname;
