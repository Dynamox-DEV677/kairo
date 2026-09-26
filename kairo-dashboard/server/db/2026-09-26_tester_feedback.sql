-- Tester feedback: "something broke" / ideas / questions / wrong answers,
-- sent from Profile -> Feedback. Run once in the Supabase SQL editor.
-- Until it exists, /api/feedback answers { stored: false } and the app tells
-- the student it did not go through -- it never claims "sent".

create table if not exists public.tester_feedback (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  category     text not null check (category in ('bug', 'idea', 'question', 'answer')),
  message      text not null check (char_length(message) between 3 and 2000),
  screen       text check (char_length(screen) <= 40),
  app_version  text check (char_length(app_version) <= 40),
  device       jsonb,                                   -- platform, screen size, online: nothing identifying
  status       text not null default 'open',            -- 'open' | 'seen' | 'fixed' | 'wontfix'
  created_at   timestamptz not null default now()
);

alter table public.tester_feedback enable row level security;

-- Students may send feedback as themselves. There is deliberately NO select,
-- update or delete policy: no student can ever read another student's words.
-- You read them in the Supabase dashboard (Table editor -> tester_feedback).
drop policy if exists tester_feedback_insert_own on public.tester_feedback;
create policy tester_feedback_insert_own
  on public.tester_feedback for insert
  with check (auth.uid() = user_id);

create index if not exists tester_feedback_created_at_idx
  on public.tester_feedback (created_at desc);

-- Rows are removed by Profile -> Delete account (server/routes/account.js,
-- USER_TABLES) and included in "Download my data".
