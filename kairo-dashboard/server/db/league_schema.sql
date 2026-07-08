-- ──────────────────────────────────────────────────────────────────────
-- Kairo League — weekly XP leaderboard (Duolingo-style)
-- Paste into Supabase ▸ SQL Editor ▸ Run.  Idempotent.
-- ──────────────────────────────────────────────────────────────────────

create table if not exists league_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,           -- auth uuid OR anonymous device id
  name       text not null default 'Student',
  week       date not null,           -- Monday of the ISO week
  xp         integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, week)
);

create index if not exists league_week_xp_idx on league_scores (week, xp desc);

-- Server writes through the service-role key; keep the table locked to
-- anon users. (RLS on, no anon policies = only service role can touch it.)
alter table league_scores enable row level security;
