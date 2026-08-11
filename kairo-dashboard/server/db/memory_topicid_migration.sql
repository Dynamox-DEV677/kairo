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
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
