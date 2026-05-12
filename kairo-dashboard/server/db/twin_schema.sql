-- ════════════════════════════════════════════════════════════════════════════
-- Kairo OS · AI Academic Twin schema
--
-- Run this once in Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Conceptual model:
--   twin_events            raw event stream (every interaction the student has)
--   knowledge_mastery      per-topic mastery state (incrementally updated)
--   academic_twins         per-user computed snapshot (the "twin")
--   twin_observations      AI-generated supportive insights
--   twin_recommendations   what Kairo suggests doing next
--   study_sessions         active periods (start/end + focus score)
--
-- The flow:
--   event → recompute knowledge_mastery for that topic
--         → periodically recompute academic_twins snapshot
--         → recompute recommendations + observations
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Event stream ─────────────────────────────────────────────────────────
-- Every interaction lands here. Keeps Kairo's intelligence grounded in real
-- behavior, not vibes. Append-only; we keep ~90 days then archive.
CREATE TABLE IF NOT EXISTS twin_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     UUID,                          -- denormalised for tenant queries
  event_type    TEXT NOT NULL,                 -- see VALID_EVENT_TYPES in twin/events.js
  subject       TEXT,
  topic         TEXT,                          -- normalised, lower-case
  score         NUMERIC,                       -- 0..100 if applicable
  correct       BOOLEAN,                       -- for per-question events
  duration_ms   INT,                           -- session length / question time
  modality      TEXT,                          -- 'visual' | 'text' | 'interactive' | 'audio'
  payload       JSONB DEFAULT '{}'::jsonb,     -- free-form per-event details
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS twin_events_user_time_idx
  ON twin_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS twin_events_user_type_idx
  ON twin_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS twin_events_user_topic_idx
  ON twin_events (user_id, topic) WHERE topic IS NOT NULL;

-- ── 2. Per-topic mastery ────────────────────────────────────────────────────
-- Updated incrementally on every relevant event. The "forget_at" column is the
-- Ebbinghaus-predicted moment the student will likely forget the topic again
-- — used by the revision recommender.
CREATE TABLE IF NOT EXISTS knowledge_mastery (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL,
  topic            TEXT NOT NULL,              -- normalised, lower-case
  mastery          NUMERIC NOT NULL DEFAULT 0, -- 0..1 (EMA of correctness × difficulty)
  attempts         INT NOT NULL DEFAULT 0,
  correct          INT NOT NULL DEFAULT 0,
  last_studied_at  TIMESTAMPTZ,
  last_correct_at  TIMESTAMPTZ,
  forget_at        TIMESTAMPTZ,                -- when retention drops below 0.5
  strength         NUMERIC NOT NULL DEFAULT 1, -- Ebbinghaus "S" parameter
  difficulty_pref  NUMERIC NOT NULL DEFAULT 0.5,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, subject, topic)
);

CREATE INDEX IF NOT EXISTS knowledge_mastery_user_forget_idx
  ON knowledge_mastery (user_id, forget_at) WHERE forget_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_mastery_user_subject_idx
  ON knowledge_mastery (user_id, subject);

-- ── 3. Academic Twin snapshot ───────────────────────────────────────────────
-- One row per student. Recomputed periodically from events + mastery + memory.
-- This is the "view" the Kairo OS dashboard reads from.
CREATE TABLE IF NOT EXISTS academic_twins (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Learning style proportions (sum ≈ 1.0)
  style_visual         NUMERIC NOT NULL DEFAULT 0.25,
  style_text           NUMERIC NOT NULL DEFAULT 0.25,
  style_interactive    NUMERIC NOT NULL DEFAULT 0.25,
  style_repetition     NUMERIC NOT NULL DEFAULT 0.25,

  -- Pace classification
  pace                 TEXT DEFAULT 'steady',      -- 'fast' | 'steady' | 'slow' | 'inconsistent'

  -- Focus pattern
  focus_best_hour      INT,                         -- 0..23, when sessions perform best
  focus_avg_minutes    NUMERIC,                     -- avg session length
  focus_dropoff_after  NUMERIC,                     -- minutes until activity falls

  -- Composite scores 0..1
  retention_score      NUMERIC NOT NULL DEFAULT 0.5,
  consistency_score    NUMERIC NOT NULL DEFAULT 0.0,
  burnout_risk         NUMERIC NOT NULL DEFAULT 0.0,
  confidence           NUMERIC NOT NULL DEFAULT 0.5,
  performance_trend    NUMERIC NOT NULL DEFAULT 0.0, -- -1..+1 (linreg slope normalised)

  -- Predictions
  predicted_exam_score NUMERIC,                     -- 0..100
  predicted_band       TEXT,                        -- 'A+' | 'A' | 'B+' …

  -- Engagement
  total_xp             INT NOT NULL DEFAULT 0,
  streak_days          INT NOT NULL DEFAULT 0,
  last_active_at       TIMESTAMPTZ,

  -- Cached top topics (denormalised for fast dashboard reads)
  weak_topics          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{subject, topic, severity, last_seen}]
  strong_topics        JSONB NOT NULL DEFAULT '[]'::jsonb,
  forgetting_soon      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{topic, hours_until_forget}]

  -- Bookkeeping
  computed_at          TIMESTAMPTZ DEFAULT NOW(),
  version              INT NOT NULL DEFAULT 1
);

-- ── 4. Observations (supportive AI insights) ───────────────────────────────
-- Short, human-readable insights surfaced in the AI Voice + Recommendations
-- stream. Generated by rules + optionally enriched by an LLM async.
CREATE TABLE IF NOT EXISTS twin_observations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                  -- 'insight' | 'pattern' | 'milestone' | 'concern' | 'celebration'
  tone         TEXT DEFAULT 'supportive',      -- 'supportive' | 'neutral' | 'caution'
  title        TEXT NOT NULL,
  body         TEXT,                            -- 1-2 sentence explanation
  topic        TEXT,
  importance   NUMERIC NOT NULL DEFAULT 0.5,    -- 0..1
  expires_at   TIMESTAMPTZ,                     -- short-term insights auto-expire
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS twin_observations_user_recent_idx
  ON twin_observations (user_id, created_at DESC);

-- ── 5. Adaptive recommendations ─────────────────────────────────────────────
-- Concrete suggestions: what to revise / what lab to open / when to take a break.
CREATE TABLE IF NOT EXISTS twin_recommendations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                  -- 'revise' | 'lab' | 'flashcard' | 'quiz' | 'break' | 'plan'
  target       TEXT,                            -- topic / lab id / flashcard set / etc.
  subject      TEXT,
  reason       TEXT,                            -- 1-line "why" the student sees
  priority     NUMERIC NOT NULL DEFAULT 0.5,    -- 0..1
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  acted_at     TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS twin_recommendations_user_open_idx
  ON twin_recommendations (user_id, priority DESC) WHERE acted_at IS NULL AND dismissed_at IS NULL;

-- ── 6. Study sessions ───────────────────────────────────────────────────────
-- Active periods. Start when activity begins, end on 10 min inactivity.
CREATE TABLE IF NOT EXISTS study_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  duration_min NUMERIC,
  subjects     TEXT[],
  topics       TEXT[],
  event_count  INT NOT NULL DEFAULT 0,
  focus_score  NUMERIC,                          -- 0..1 (computed from event density)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_sessions_user_recent_idx
  ON study_sessions (user_id, started_at DESC);

-- ── Row-level security ──────────────────────────────────────────────────────
-- Service role bypasses RLS so the backend can read/write freely.
-- Clients only get to see their own twin via authenticated reads.
ALTER TABLE twin_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_mastery      ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_twins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_observations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_recommendations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions         ENABLE ROW LEVEL SECURITY;

-- Each user can only read their own rows. Writes go through the service role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_events_self_read') THEN
    CREATE POLICY twin_events_self_read           ON twin_events           FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'knowledge_mastery_self_read') THEN
    CREATE POLICY knowledge_mastery_self_read     ON knowledge_mastery     FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_twins_self_read') THEN
    CREATE POLICY academic_twins_self_read        ON academic_twins        FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_observations_self_read') THEN
    CREATE POLICY twin_observations_self_read     ON twin_observations     FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_recommendations_self_read') THEN
    CREATE POLICY twin_recommendations_self_read  ON twin_recommendations  FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_sessions_self_read') THEN
    CREATE POLICY study_sessions_self_read        ON study_sessions        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
