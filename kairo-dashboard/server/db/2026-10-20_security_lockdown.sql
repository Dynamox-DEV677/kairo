-- ============================================================================
-- SECURITY LOCKDOWN, 2026-10-20. Run the whole file once in the Supabase SQL
-- editor, then read the three result tables at the bottom.
--
-- What was wrong, found in a full security check:
--
-- 1. THE user_profile VIEW WAS PUBLIC. Views run with their OWNER's rights by
--    default, so row-level security on users never applied to them. With only
--    the anon key - which ships inside the app for anyone to read - a request
--    to /rest/v1/user_profile returned every user's name, role, class, status
--    and school. Measured from outside on 2026-10-20: 28 rows, no login.
--    parent_profile (parent name + child name + class) and active_notifications
--    had the same flaw. The app never reads any of the three from the browser;
--    only the server does, with the service-role key, which this does not touch.
--
-- 2. ANY USER COULD MAKE THEMSELVES A SCHOOL ADMIN. users_update_self checks
--    that the row is yours, not WHICH columns change, so
--      supabase.from('users').update({ role: 'admin', school_id: '<any school>' })
--    on your own row was allowed, and the server trusts those columns. A
--    trigger now keeps role, school_id and status out of the browser's reach.
--    The app only ever writes name and avatar from the browser (and creates its
--    own row as a plain student), so nothing it does is affected.
--
-- 3. kairo_otps HAD NO ROW-LEVEL SECURITY. One-time login codes, hashed with a
--    6-digit space that cracks offline in seconds, next to the email address.
--    Only the server reads it.
--
-- 4. Members could read schools.passcode_plain and the payment columns. The app
--    reads five columns from the browser; those five stay readable, the rest
--    go server-only.
--
-- None of this disables RLS anywhere. Every change removes access.
-- ============================================================================

begin;

-- 1. Views: the caller's rights, and no browser access at all ----------------
do $$
declare v text;
begin
  foreach v in array array['user_profile', 'parent_profile', 'active_notifications'] loop
    if exists (select 1 from pg_views where schemaname = 'public' and viewname = v) then
      execute format('alter view public.%I set (security_invoker = true)', v);
      execute format('revoke all on public.%I from anon, authenticated', v);
    end if;
  end loop;
end $$;

-- 2. users: the browser cannot set role, school or status ---------------------
create or replace function public.users_guard_privileged()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  caller text  := coalesce(claims ->> 'role', '');
  -- What a student may change about themselves from the app.
  editable text[] := array['name', 'avatar_url', 'class_name', 'board'];
begin
  -- The server (service_role) and the SQL editor (no JWT at all) are trusted.
  if caller not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- The app creates its own row on first sign-in, always as a student with
    -- no school. Joining a school or becoming staff goes through the server.
    new := jsonb_populate_record(new,
      jsonb_build_object('role', 'student', 'school_id', null)
      || case when to_jsonb(new) ? 'status' then jsonb_build_object('status', 'active') else '{}'::jsonb end);
    return new;
  end if;

  -- UPDATE: start from the row as it was, and take only the editable columns.
  return jsonb_populate_record(old,
    (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
       from jsonb_each(to_jsonb(new))
      where key = any(editable)));
end $$;

drop trigger if exists users_guard_privileged on public.users;
create trigger users_guard_privileged
  before insert or update on public.users
  for each row execute function public.users_guard_privileged();

-- 3. One-time codes: server only ----------------------------------------------
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'kairo_otps') then
    alter table public.kairo_otps enable row level security;
    revoke all on public.kairo_otps from anon, authenticated;
  end if;
end $$;

-- 4. schools: the five columns the app reads, nothing else ---------------------
do $$
declare c text;
begin
  revoke all on public.schools from anon, authenticated;
  foreach c in array array['id', 'school_name', 'school_logo_url', 'school_email', 'plan'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'schools' and column_name = c) then
      execute format('grant select (%I) on public.schools to authenticated', c);
    end if;
  end loop;
end $$;

commit;

-- ============================================================================
-- CHECK THE RESULT. Three tables come back.
--
-- (a) Every row must show security_invoker = true.
select c.relname as view, coalesce(c.reloptions::text, '') like '%security_invoker=true%' as security_invoker
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and c.relname in ('user_profile', 'parent_profile', 'active_notifications');

-- (b) One row: users_guard_privileged, BEFORE INSERT OR UPDATE.
select tgname, tgenabled from pg_trigger
 where tgrelid = 'public.users'::regclass and tgname = 'users_guard_privileged';

-- (c) kairo_otps must show rls_on = true.
select relname as table, relrowsecurity as rls_on from pg_class
 where oid = 'public.kairo_otps'::regclass;
-- ============================================================================
