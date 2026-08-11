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
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
