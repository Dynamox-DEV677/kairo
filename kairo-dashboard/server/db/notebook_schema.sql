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
