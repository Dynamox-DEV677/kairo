-- ─────────────────────────────────────────────────────────────────────────────
-- Kyno · Progress & Profile (spaces 6 + 7) — usernames, privacy switches,
-- report/block, effort league, human battles.
-- Paste into Supabase ▸ SQL Editor ▸ Run. Idempotent; safe to re-run.
--
-- THE RULE THIS ENFORCES: the only identity one student ever sees of another
-- is a username. Real names leave every social table; every social surface
-- gets an off switch; study rooms default OFF.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. one social identity per account --------------------------------------------
create table if not exists public.social_profiles (
  user_id             uuid primary key references public.users(id) on delete cascade,
  username            text not null unique,
  show_in_leagues     boolean not null default true,
  allow_battles       boolean not null default true,
  join_rooms          boolean not null default false,   -- OFF until the student turns it on
  username_changed_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint social_username_shape check (username ~ '^[a-z][a-z0-9_]{2,19}$')
);
-- Server writes through the service-role key; RLS on with no policies keeps
-- the anon key out entirely (same posture as league_scores).
alter table public.social_profiles enable row level security;

-- 2. report + block: silent, permanent, no interaction needed ------------------
create table if not exists public.user_reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reported_id uuid not null references public.users(id) on delete cascade,
  context     text,                       -- 'league' | 'battle' | 'room'
  created_at  timestamptz not null default now()
);
create index if not exists user_reports_reported_idx on public.user_reports (reported_id, created_at desc);
alter table public.user_reports enable row level security;

create table if not exists public.user_blocks (
  user_id    uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
alter table public.user_blocks enable row level security;

-- 3. league: effort, not names ---------------------------------------------------
alter table public.league_scores add column if not exists minutes  integer not null default 0;  -- study minutes this week
alter table public.league_scores add column if not exists group_id text;                        -- weekly group of 15
alter table public.league_scores drop column if exists name;                                    -- real names never again
create index if not exists league_group_idx on public.league_scores (week, group_id);

-- 4. battles between two humans: the server holds the match ----------------------
create table if not exists public.battle_queue (
  user_id  uuid primary key references public.users(id) on delete cascade,
  subject  text not null,
  band     smallint not null default 2,    -- mastery band 1-3, matched within ±1
  since    timestamptz not null default now()
);
alter table public.battle_queue enable row level security;

create table if not exists public.battle_matches (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,
  question_ids text[] not null,
  p1           uuid references public.users(id) on delete set null,
  p2           uuid references public.users(id) on delete set null,
  p1_score     integer not null default 0,
  p2_score     integer not null default 0,
  p1_answers   jsonb not null default '[]'::jsonb,
  p2_answers   jsonb not null default '[]'::jsonb,
  p1_seen      timestamptz not null default now(),
  p2_seen      timestamptz not null default now(),
  status       text not null default 'live',   -- 'live' | 'done' | 'void'
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);
create index if not exists battle_matches_p1_idx on public.battle_matches (p1, started_at desc);
create index if not exists battle_matches_p2_idx on public.battle_matches (p2, started_at desc);
alter table public.battle_matches enable row level security;

-- 5. backfill: every existing account gets a generated handle -------------------
-- Same word lists as src/lib/username.core.js (a test keeps them identical).
do $$
declare
  adjs text[] := array['quiet','swift','bright','calm','bold','clever','steady','lucky','brave','gentle','keen','merry','nimble','plucky','sunny','witty','zesty','cosmic','lunar','solar','amber','coral','ivory','jade','onyx','pearl','ruby','silver','violet','golden'];
  nouns text[] := array['storm','river','falcon','comet','maple','tiger','otter','panda','koala','robin','lotus','cedar','harbor','meadow','summit','canyon','glacier','breeze','ember','pebble','willow','sparrow','dolphin','lantern','compass','anchor','rocket','planet','nebula','quartz'];
  r      record;
  handle text;
  tries  integer;
begin
  for r in
    select u.id from public.users u
    left join public.social_profiles s on s.user_id = u.id
    where s.user_id is null
  loop
    tries := 0;
    loop
      handle := adjs[1 + floor(random() * array_length(adjs, 1))::int]
             || nouns[1 + floor(random() * array_length(nouns, 1))::int]
             || lpad((floor(random() * 100))::int::text, 2, '0');
      begin
        insert into public.social_profiles (user_id, username) values (r.id, handle);
        exit;
      exception when unique_violation then
        tries := tries + 1;
        if tries > 25 then
          insert into public.social_profiles (user_id, username) values (r.id, 'student_' || substr(md5(r.id::text), 1, 6));
          exit;
        end if;
      end;
    end loop;
  end loop;
end $$;
