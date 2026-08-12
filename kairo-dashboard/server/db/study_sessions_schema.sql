-- study_sessions
--
-- The 20-minute session loop is server-owned on purpose: a student who closes
-- the app mid-session, or picks up a different phone, resumes where they were
-- instead of starting again. Client-side session state cannot do that.
--
-- Run in the Supabase SQL editor. Safe to run twice.

create table if not exists public.study_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  -- warmup | repair | push | lockin, matching PHASES in server/routes/study.js
  phase          text not null default 'warmup',
  minutes_total  integer not null default 20,
  minutes_done   integer not null default 0,

  started_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- null while the session is open. The resume lookup keys off this.
  ended_at       timestamptz
);

-- "Does this student have an open session?" runs on every home-screen load.
create index if not exists study_sessions_open_idx
  on public.study_sessions (user_id, started_at desc)
  where ended_at is null;

alter table public.study_sessions enable row level security;

drop policy if exists study_sessions_own on public.study_sessions;
create policy study_sessions_own on public.study_sessions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
