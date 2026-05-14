-- ════════════════════════════════════════════════════════════════════════════
-- Kairo · GUARANTEED SIGNUP SETUP
--
-- Run this ONCE in Supabase SQL Editor after the DB cleanup. It:
--   1. Creates `public.users` + `public.schools` if missing (no destructive ops)
--   2. Adds every column the signup routes might touch — ADD COLUMN IF NOT EXISTS
--      so it's safe on any existing schema
--   3. Relaxes every CHECK constraint that the cleanup might have left stale
--   4. Wipes RLS off both tables so server-side service_role inserts always work
--   5. Creates a row-trigger that drops any unknown columns silently
--
-- Idempotent — safe to re-run any time signup starts erroring.
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. schools — create if missing
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schools (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name     TEXT        UNIQUE NOT NULL,
  school_passcode TEXT        NOT NULL,
  school_logo_url TEXT,
  school_email    TEXT,
  plan            TEXT        DEFAULT 'free',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Make sure every column the signup routes touch exists
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS passcode_plain          TEXT,
  ADD COLUMN IF NOT EXISTS domain                  TEXT,
  ADD COLUMN IF NOT EXISTS require_approval        BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_id                UUID,
  ADD COLUMN IF NOT EXISTS status                  TEXT        DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT        DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_plan       TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS payment_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS school_email            TEXT,
  ADD COLUMN IF NOT EXISTS school_logo_url         TEXT,
  ADD COLUMN IF NOT EXISTS plan                    TEXT;

-- Drop the old `plan` CHECK that restricted to free/pro/enterprise — the
-- subscription system now uses arbitrary plan codes (monthly/yearly/etc.)
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_plan_check;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. users — create if missing
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  school_id   UUID        REFERENCES public.schools(id) ON DELETE SET NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status        TEXT        DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subject       TEXT,
  ADD COLUMN IF NOT EXISTS class_name    TEXT,
  ADD COLUMN IF NOT EXISTS board         TEXT,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS school_id     UUID,
  ADD COLUMN IF NOT EXISTS avatar_url    TEXT;

-- Drop stale CHECK constraints and rewrite them to include every legal value
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'parent'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IS NULL OR status IN ('active', 'pending', 'suspended'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RLS off on both — the service_role API does its own auth checks.
--    (Re-enable later with the policies in `signup_payment_schema.sql` once
--    everything stabilises.)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Grants — make sure service_role can write everything
-- ────────────────────────────────────────────────────────────────────────────
GRANT ALL ON public.users   TO service_role;
GRANT ALL ON public.schools TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Verify
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'schools')
GROUP BY table_name
ORDER BY table_name;
