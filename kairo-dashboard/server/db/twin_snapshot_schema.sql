-- ════════════════════════════════════════════════════════════════════════════
-- Kairo OS · Twin Snapshot — cross-device auto-sync.
--
-- Stores a single rolling snapshot of each user's full local TwinState
-- (events, mastery, doubts, concepts, formulas, flashcards). The client
-- uploads on every change (debounced 5s) and pulls on a fresh login so
-- the student's history follows them across devices.
--
-- Run once in Supabase SQL Editor. Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS twin_snapshots (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blob          JSONB NOT NULL,
  schema_ver    TEXT  NOT NULL DEFAULT 'kairo-twin-backup-v1',
  size_bytes    INTEGER GENERATED ALWAYS AS (length(blob::text)) STORED,
  device_label  TEXT,                              -- last device that wrote
  events_count  INTEGER,                           -- denormalised for fast UI
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Faster lookups by recency (useful for "show me snapshots updated recently")
CREATE INDEX IF NOT EXISTS twin_snapshots_updated_idx
  ON twin_snapshots (updated_at DESC);

-- RLS — every user can only read/write their own snapshot. The /api/twin/snapshot
-- endpoints already check req.user.id, but defense-in-depth is cheap.
ALTER TABLE twin_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "twin_snapshots own"   ON twin_snapshots;
CREATE POLICY "twin_snapshots own" ON twin_snapshots
  USING        (auth.uid() = user_id)
  WITH CHECK   (auth.uid() = user_id);
