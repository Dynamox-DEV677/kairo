-- ============================================================================
--  KYNO — ALL PENDING MIGRATIONS, IN ORDER
--  Paste this whole file into the Supabase SQL editor and Run once.
--  Project: ejnkndtwntzhncdvwwvp
--
--  Safe to run more than once. Every statement is `if not exists` or
--  `drop ... if exists` first, so a second run is a no-op.
--
--  Order matters: ai_memory gains topic_id before topic_mastery keys off the
--  same ids, and study_sessions reads mastery to build a session.
--
--  Until this runs: /api/notebook 503s, mastery never records, and the study
--  session endpoint has no table to write to. Those endpoints fail loudly and
--  name this file rather than failing silently.
-- ============================================================================


-- ===========================================================================
--  notebook_schema.sql
-- ===========================================================================

-- notebooks
--
-- This table backs /api/notebook and was never created. Every POST to that
-- route has been 500-ing since the route shipped, which is why flashcards
-- generated from chat reported success and then never appeared in the Library:
-- the write went to a table that does not exist.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.notebooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  school_id   uuid,

  -- Kept in sync with KINDS in server/routes/notebook.js. The route validates
  -- too, but the constraint is what stops a bad write from a future caller.
  kind        text not null check (kind in (
                'flashcards', 'summary', 'doubt', 'concept_map',
                'note', 'plan', 'grade'
              )),

  subject     text,
  title       text not null,
  content     text not null,
  tags        text[] not null default '{}',
  source      text,
  pinned      boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The list query filters by user_id and orders by pinned then updated_at, so
-- that is the index it needs. Without it every Library open is a seq scan.
create index if not exists notebooks_user_recent_idx
  on public.notebooks (user_id, pinned desc, updated_at desc);

create index if not exists notebooks_user_kind_idx
  on public.notebooks (user_id, kind);

-- Search in the Library is currently title/content ILIKE '%q%', which cannot
-- use a btree index. trigram makes it usable before semantic search lands.
create extension if not exists pg_trgm;
create index if not exists notebooks_title_trgm_idx
  on public.notebooks using gin (title gin_trgm_ops);

alter table public.notebooks enable row level security;

-- The server talks to this table with the service-role key, which bypasses
-- RLS. These policies exist so that a client holding only the anon key -- now
-- or after some future refactor -- still cannot read another student's notes.
drop policy if exists notebooks_select_own on public.notebooks;
create policy notebooks_select_own on public.notebooks
  for select using ((select auth.uid()) = user_id);

drop policy if exists notebooks_insert_own on public.notebooks;
create policy notebooks_insert_own on public.notebooks
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists notebooks_update_own on public.notebooks;
create policy notebooks_update_own on public.notebooks
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists notebooks_delete_own on public.notebooks;
create policy notebooks_delete_own on public.notebooks
  for delete using ((select auth.uid()) = user_id);

-- ===========================================================================
--  memory_topicid_migration.sql
-- ===========================================================================

-- ai_memory: add topic_id, and quarantine the junk already in there.
--
-- Until now `topic` held whatever the student typed. The live dump contains
-- "wat is ur name", "camera study problem" and
-- "sin30=1/2, cos60=1/2 so answer = 1/4" as weak topics, and that string was
-- concatenated into the prompt context for every AI call.
--
-- Run in the Supabase SQL editor. Safe to run twice.

alter table public.ai_memory
  add column if not exists topic_id text;

create index if not exists ai_memory_user_topic_idx
  on public.ai_memory (user_id, topic_id);

-- Reclassify. Anything that never resolved to a syllabus topic is demoted to
-- 'unclassified' so it stops feeding weak/strong, but the row is kept -- the
-- event itself was real even though the label was not.
--
-- Rows written before this migration have no topic_id at all, so the whole
-- backlog is demoted. That is intentional: none of it was ever validated, and
-- re-resolving it server-side would just re-import the same guesses. New
-- events classify correctly from here.
update public.ai_memory
   set type = 'unclassified'
 where topic_id is null
   and type in ('weak_topic', 'strong_topic', 'quiz_answer');

-- Mistakes keep their type -- the mistake happened, only the topic label was
-- unreliable -- but they are excluded from the weak list by the topic_id
-- check in buildContext().

alter table public.ai_memory enable row level security;

drop policy if exists ai_memory_own on public.ai_memory;
create policy ai_memory_own on public.ai_memory
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ===========================================================================
--  mastery_schema.sql
-- ===========================================================================

-- topic_mastery
--
-- One row per (student, topic). This is the thing that replaces the weak/strong
-- lists: a topic cannot be in both when there is only one number.
--
-- Also carries the SM-2 fields, because the revision schedule and the mastery
-- estimate are two views of the same fact and splitting them across tables
-- guarantees they drift.
--
-- Run in the Supabase SQL editor. Safe to run twice.

create table if not exists public.topic_mastery (
  user_id     uuid not null references auth.users(id) on delete cascade,
  topic_id    text not null,

  -- P(the student knows this), 0..1, from Bayesian Knowledge Tracing.
  mastery     real not null default 0.25 check (mastery >= 0 and mastery <= 1),
  attempts    integer not null default 0,
  correct     integer not null default 0,

  -- SM-2 state.
  ease        real    not null default 2.5,
  interval    integer not null default 0,
  reps        integer not null default 0,
  lapses      integer not null default 0,
  due_at      timestamptz,

  last_seen   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, topic_id)
);

-- "What is due today" is the single hottest query in the product -- the Daily
-- OS runs it on every open.
create index if not exists topic_mastery_due_idx
  on public.topic_mastery (user_id, due_at)
  where due_at is not null;

-- "What is this student weakest at" -- the session's repair target.
create index if not exists topic_mastery_weak_idx
  on public.topic_mastery (user_id, mastery);

alter table public.topic_mastery enable row level security;

drop policy if exists topic_mastery_own on public.topic_mastery;
create policy topic_mastery_own on public.topic_mastery
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ===========================================================================
--  study_sessions_schema.sql
-- ===========================================================================

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
