-- ════════════════════════════════════════════════════════════════════════════
-- Kairo OS · Device-passcode OTP storage.
--
-- Replaces the in-memory Map in routes/passcode.js. Survives Vercel cold
-- starts and works across multiple serverless instances. Critical when
-- the platform has > ~50 concurrent users.
--
-- Run once in Supabase SQL Editor. Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kairo_otps (
  email            TEXT PRIMARY KEY,
  hash             TEXT NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  last_sent_at     TIMESTAMPTZ NOT NULL,
  send_timestamps  JSONB NOT NULL DEFAULT '[]',
  attempts_left    INTEGER NOT NULL DEFAULT 6,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on expires_at for fast purge of stale rows.
CREATE INDEX IF NOT EXISTS kairo_otps_expires_idx ON kairo_otps (expires_at);

-- No RLS — only the server (via service_role) ever touches this table.
-- Users never query it directly, so we don't expose it to the public API.
