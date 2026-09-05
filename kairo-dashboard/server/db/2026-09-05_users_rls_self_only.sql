-- ============================================================================
-- POST /rest/v1/users?on_conflict=id STILL RETURNS 500 AFTER THE FIRST FIX.
--
-- The first migration broke the recursion for the ANONYMOUS role, which is why
-- an unauthenticated probe now returns 200. It did not necessarily break it for
-- a SIGNED-IN one, and that is the path the app actually uses.
--
-- Why: Postgres evaluates EVERY permissive policy and ORs the results. It does
-- not stop at the first one that passes. So for a signed-in student, this
-- policy is evaluated on every read:
--
--     users_select_same_school ... using (school_id = public.current_school_id() ...)
--
-- and current_school_id() runs "select school_id from public.users", which
-- re-enters the policies on public.users. That is the recursion, rebuilt. It
-- only stays quiet for anon because auth.uid() is null and the planner can
-- short-circuit before the function is ever called.
--
-- THE FIX IS TO DELETE THE POLICY, NOT TO PATCH THE FUNCTION. Nothing needs it:
--   * every client read of users is a self-read (App.tsx, Login.tsx,
--     KairoHome.tsx all filter eq('id', <the signed-in user>))
--   * every staff and admin read goes through the SERVER, which uses
--     supabaseAdmin -- the service-role key -- and bypasses RLS already
--     (server/middleware/supabaseAuth.js, routes/marks.js, routes/ops.js)
--
-- What is left touches no table, so it cannot recurse by construction.
-- RLS stays ON. The anon key is in the client bundle and this is children's
-- data, so that is not negotiable.
-- ============================================================================

begin;

-- 1. Drop every policy on users, whatever it is called.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'users'
  loop execute format('drop policy if exists %I on public.users', p.policyname); end loop;
end $$;

-- 2. The helpers are what recursed. Nothing references them any more.
drop function if exists public.current_school_id();
drop function if exists public.current_role_name();

-- 3. RLS on, self-access only. No function call, no subquery on users.
alter table public.users enable row level security;

create policy users_select_self on public.users
  for select to authenticated using (auth.uid() = id);

create policy users_insert_self on public.users
  for insert to authenticated with check (auth.uid() = id);

create policy users_update_self on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- No delete policy on purpose: account deletion runs server-side through
-- supabaseAdmin (server/routes/account.js), so a stolen anon key cannot
-- delete a child's account.

commit;

-- ============================================================================
-- AFTER RUNNING, PASTE THIS INTO THE SAME SQL EDITOR. It should return three
-- rows -- users_select_self, users_insert_self, users_update_self -- and the
-- qual column must NOT mention "current_school_id" or contain a subquery on
-- users. If it does, the old policy survived and the 500 will continue.
-- ============================================================================
-- select policyname, cmd, qual, with_check
--   from pg_policies where schemaname='public' and tablename='users'
--   order by policyname;
