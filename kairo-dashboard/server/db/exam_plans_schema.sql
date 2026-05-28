-- ──────────────────────────────────────────────────────────────────────
-- Exam Planner — persistent storage
-- Paste this whole file into Supabase ▸ SQL Editor ▸ New Query ▸ Run
-- (One-time setup. Idempotent — safe to re-run.)
-- ──────────────────────────────────────────────────────────────────────

create table if not exists exam_plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  exam             text not null,                  -- 'jee-main', 'neet', etc.
  exam_date        date not null,
  hours_per_day    numeric not null default 4,
  plan_json        jsonb not null,                 -- full AI-generated plan
  completion_state jsonb not null default '{}'::jsonb,  -- { "1-Mon-0": true } per block
  mock_scores      jsonb not null default '[]'::jsonb,  -- [{ date, score }]
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists exam_plans_user_id_idx on exam_plans(user_id);
create index if not exists exam_plans_active_idx  on exam_plans(user_id, is_archived);

alter table exam_plans enable row level security;

drop policy if exists "users read own plans"   on exam_plans;
drop policy if exists "users insert own plans" on exam_plans;
drop policy if exists "users update own plans" on exam_plans;
drop policy if exists "users delete own plans" on exam_plans;

create policy "users read own plans"
  on exam_plans for select  using (auth.uid() = user_id);
create policy "users insert own plans"
  on exam_plans for insert  with check (auth.uid() = user_id);
create policy "users update own plans"
  on exam_plans for update  using (auth.uid() = user_id);
create policy "users delete own plans"
  on exam_plans for delete  using (auth.uid() = user_id);

-- Auto-update updated_at on PATCH/UPDATE
create or replace function _exam_plans_touch_updated_at()
  returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists exam_plans_touch on exam_plans;
create trigger exam_plans_touch
  before update on exam_plans
  for each row execute function _exam_plans_touch_updated_at();
