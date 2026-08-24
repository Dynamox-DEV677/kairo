-- Audit task 6 — the "this looks wrong" review queue.
-- Run in the Supabase SQL editor. The /api/quiz/report endpoint degrades
-- gracefully until this exists (clients queue locally), but reports only
-- become a review stream once this table is live.

create table if not exists public.question_reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  source      text not null,              -- 'adaptive-quiz' | 'simulator' | 'exam-hall' | 'museum'
  question    text not null,
  options     jsonb,
  claimed     text,                       -- the answer the app presented as correct
  note        text,                       -- optional student note
  status      text not null default 'open',  -- 'open' | 'reviewed' | 'fixed' | 'invalid'
  created_at  timestamptz not null default now()
);

alter table public.question_reports enable row level security;

-- Students may file reports as themselves; only service-role reads the queue.
create policy question_reports_insert_own
  on public.question_reports for insert
  with check (auth.uid() = user_id);
