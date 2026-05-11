-- ============================================================
-- Kairo — Solver Persistent Cache
-- One row per (normalized) question. Shared by every Vercel function
-- instance, survives deploys, hit-counted for popularity analytics.
-- Run in Supabase Dashboard → SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS solver_cache (
  question_key  TEXT        PRIMARY KEY,    -- lowercased + filler-stripped + trimmed
  question_raw  TEXT        NOT NULL,       -- original question, for debugging
  plan          JSONB       NOT NULL,       -- the full solver-plan response
  model_used    TEXT,                       -- which model produced it
  source        TEXT        NOT NULL        -- 'ai' or 'wikipedia'
    CHECK (source IN ('ai', 'wikipedia')),
  hit_count     INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Find popular questions fast (for analytics + pre-warm)
CREATE INDEX IF NOT EXISTS idx_solver_cache_hits ON solver_cache(hit_count DESC);
-- Trigger auto-updates updated_at on row update
DO $$ BEGIN
  CREATE TRIGGER solver_cache_updated_at
    BEFORE UPDATE ON solver_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role only — no end-user direct access
ALTER TABLE solver_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY solver_cache_service ON solver_cache FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
