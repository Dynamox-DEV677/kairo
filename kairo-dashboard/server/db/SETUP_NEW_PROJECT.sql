-- ============================================================
-- KYNO - FULL DATABASE SETUP (new Supabase project)
-- Paste this whole file into the Supabase SQL editor and Run.
-- Every statement is idempotent (IF NOT EXISTS) - safe to re-run.
-- ============================================================


-- ============ from kairo_signup_setup.sql ============
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Kairo Â· GUARANTEED SIGNUP SETUP
--
-- Run this ONCE in Supabase SQL Editor after the DB cleanup. It:
--   1. Creates `public.users` + `public.schools` if missing (no destructive ops)
--   2. Adds every column the signup routes might touch â€” ADD COLUMN IF NOT EXISTS
--      so it's safe on any existing schema
--   3. Relaxes every CHECK constraint that the cleanup might have left stale
--   4. Wipes RLS off both tables so server-side service_role inserts always work
--   5. Creates a row-trigger that drops any unknown columns silently
--
-- Idempotent â€” safe to re-run any time signup starts erroring.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. schools â€” create if missing
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- Drop the old `plan` CHECK that restricted to free/pro/enterprise â€” the
-- subscription system now uses arbitrary plan codes (monthly/yearly/etc.)
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_plan_check;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. users â€” create if missing
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. RLS off on both â€” the service_role API does its own auth checks.
--    (Re-enable later with the policies in `signup_payment_schema.sql` once
--    everything stabilises.)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.users   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. Grants â€” make sure service_role can write everything
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT ALL ON public.users   TO service_role;
GRANT ALL ON public.schools TO service_role;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. Verify
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SELECT
  table_name,
  string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'schools')
GROUP BY table_name
ORDER BY table_name;


-- ============ from schema.sql ============
-- ============================================================
-- Kairo â€” Supabase PostgreSQL Schema
-- Run this in Supabase Dashboard â†’ SQL Editor
-- ============================================================

-- â”€â”€ Extensions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- â”€â”€ SCHOOLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS schools (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name     TEXT        UNIQUE NOT NULL,
  school_passcode TEXT        NOT NULL,   -- bcrypt-hashed
  school_logo_url TEXT,
  school_email    TEXT,
  plan            TEXT        DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Extends Supabase auth.users
CREATE TABLE IF NOT EXISTS users (
  id          UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT  NOT NULL,
  role        TEXT  NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  school_id   UUID  REFERENCES schools(id) ON DELETE SET NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ NOTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS notes (
  id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID  NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       TEXT  NOT NULL,
  content     TEXT  NOT NULL,
  subject     TEXT  DEFAULT 'General',
  word_count  INT   GENERATED ALWAYS AS (
                array_length(string_to_array(trim(content), ' '), 1)
              ) STORED,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ NOTIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID  NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id    UUID  REFERENCES users(id) ON DELETE SET NULL,
  sender_name  TEXT,
  message      TEXT  NOT NULL,
  target_role  TEXT  DEFAULT 'all' CHECK (target_role IN ('all', 'student', 'teacher')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '12 hours')
);

-- â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_users_school       ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_notes_user         ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_school       ON notes(school_id);
CREATE INDEX IF NOT EXISTS idx_notifs_school      ON notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_notifs_expires     ON notifications(expires_at);

-- â”€â”€ AUTO UPDATE updated_at â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

drop trigger if exists notes_updated_at on notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- â”€â”€ AUTO DELETE expired notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Supabase scheduled job via pg_cron (enable it in Supabase Extensions)
-- SELECT cron.schedule('delete-expired-notifications', '0 * * * *',
--   'DELETE FROM notifications WHERE expires_at < NOW()');

-- â”€â”€ ROW LEVEL SECURITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE schools       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Schools: anyone can read, only service role can write
drop policy if exists "schools_public_read" on schools;
CREATE POLICY "schools_public_read"
  ON schools FOR SELECT USING (true);

drop policy if exists "schools_service_insert" on schools;
CREATE POLICY "schools_service_insert"
  ON schools FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Users: can read own profile; service role can do anything
drop policy if exists "users_read_own" on users;
CREATE POLICY "users_read_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

drop policy if exists "users_read_same_school" on users;
CREATE POLICY "users_read_same_school"
  ON users FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

drop policy if exists "users_insert_own" on users;
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

drop policy if exists "users_update_own" on users;
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Notes: user owns their notes
drop policy if exists "notes_owner_all" on notes;
CREATE POLICY "notes_owner_all"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications: users see their school's active ones
drop policy if exists "notifs_read_school" on notifications;
CREATE POLICY "notifs_read_school"
  ON notifications FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND expires_at > NOW()
  );

-- Only teachers (or service role) can INSERT notifications
drop policy if exists "notifs_teacher_insert" on notifications;
CREATE POLICY "notifs_teacher_insert"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
    )
  );

-- â”€â”€ HELPER VIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- user_profile: user + school name + logo in one shot
CREATE OR REPLACE VIEW user_profile AS
  SELECT
    u.id,
    u.name,
    u.role,
    u.avatar_url,
    u.created_at,
    s.id            AS school_id,
    s.school_name,
    s.school_logo_url,
    s.school_email,
    s.plan
  FROM users u
  LEFT JOIN schools s ON s.id = u.school_id;

-- active_notifications: only non-expired ones
CREATE OR REPLACE VIEW active_notifications AS
  SELECT
    n.*,
    u.name   AS sender_name_resolved
  FROM notifications n
  LEFT JOIN users u ON u.id = n.sender_id
  WHERE n.expires_at > NOW();


-- ============ from school_schema.sql ============
-- ============================================================
-- Kairo â€” School Management Core Migration
-- Run AFTER schema.sql in Supabase Dashboard â†’ SQL Editor
-- ============================================================

-- â”€â”€ ALTER SCHOOLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Add new columns for upgraded school registration
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS domain          TEXT,            -- e.g. "pvtschool.edu.in"
  ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE,  -- admin must approve students
  ADD COLUMN IF NOT EXISTS owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL;
                                                            -- school admin/owner

-- â”€â”€ ALTER USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Add new columns for richer user profiles
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'suspended')),
  ADD COLUMN IF NOT EXISTS subject       TEXT,             -- teacher: main subject
  ADD COLUMN IF NOT EXISTS class_name    TEXT,             -- student: class/grade (e.g. "10A")
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- â”€â”€ NETWORK RULES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- IP whitelist / CIDR ranges per school
CREATE TABLE IF NOT EXISTS network_rules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,       -- "School Wi-Fi", "Library Block", etc.
  cidr        TEXT        NOT NULL,       -- e.g. "192.168.1.0/24" or "203.0.113.5/32"
  enabled     BOOLEAN     DEFAULT TRUE,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ TASKS (Homework / Assignments) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  subject       TEXT,
  target_class  TEXT,                    -- optional: specific class e.g. "10A"
  due_date      TIMESTAMPTZ,
  max_score     INT         DEFAULT 100,
  status        TEXT        DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'draft')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ TASK SUBMISSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS task_submissions (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT,
  file_url     TEXT,
  score        INT,
  feedback     TEXT,
  status       TEXT        DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'graded', 'late')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at    TIMESTAMPTZ,
  graded_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (task_id, student_id)           -- one submission per student per task
);

-- â”€â”€ LOGIN LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS login_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        REFERENCES schools(id) ON DELETE CASCADE,
  email       TEXT,                      -- for failed attempts before user known
  ip_address  TEXT,
  user_agent  TEXT,
  success     BOOLEAN     DEFAULT TRUE,
  reason      TEXT,                      -- "network_blocked", "wrong_password", "suspended"
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_network_rules_school   ON network_rules(school_id);
CREATE INDEX IF NOT EXISTS idx_tasks_school           ON tasks(school_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by       ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_submissions_task       ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON task_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_user        ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_school      ON login_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created     ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_status           ON users(status);

-- â”€â”€ TRIGGERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Auto-update updated_at on tasks
drop trigger if exists tasks_updated_at on tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- â”€â”€ ROW LEVEL SECURITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE network_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs      ENABLE ROW LEVEL SECURITY;

-- network_rules: only visible to same school members
drop policy if exists "network_rules_school_read" on network_rules;
CREATE POLICY "network_rules_school_read"
  ON network_rules FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  );

drop policy if exists "network_rules_service_write" on network_rules;
CREATE POLICY "network_rules_service_write"
  ON network_rules FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- tasks: visible to members of the same school
drop policy if exists "tasks_school_read" on tasks;
CREATE POLICY "tasks_school_read"
  ON tasks FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  );

drop policy if exists "tasks_service_write" on tasks;
CREATE POLICY "tasks_service_write"
  ON tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- task_submissions: student owns their own; service role does everything
drop policy if exists "submissions_student_own" on task_submissions;
CREATE POLICY "submissions_student_own"
  ON task_submissions FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

drop policy if exists "submissions_service_write" on task_submissions;
CREATE POLICY "submissions_service_write"
  ON task_submissions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- login_logs: users see their own; service role full access
drop policy if exists "login_logs_own_read" on login_logs;
CREATE POLICY "login_logs_own_read"
  ON login_logs FOR SELECT
  USING (user_id = auth.uid());

drop policy if exists "login_logs_service_write" on login_logs;
CREATE POLICY "login_logs_service_write"
  ON login_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- â”€â”€ AUTO-CLEANUP (optional pg_cron) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Delete login_logs older than 90 days (uncomment if pg_cron enabled):
-- SELECT cron.schedule('delete-old-login-logs', '0 2 * * *',
--   'DELETE FROM login_logs WHERE created_at < NOW() - INTERVAL ''90 days''');


-- ============ from signup_payment_schema.sql ============
-- ============================================================
-- Kairo â€” Signup + Payment + Parent Schema (run-anytime, idempotent)
-- Run this in Supabase Dashboard â†’ SQL Editor.
-- Safe to re-run; uses IF NOT EXISTS / DROP IF EXISTS everywhere.
-- ============================================================

-- â”€â”€ EXTENSIONS (no-ops if already enabled) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- â”€â”€ SCHOOLS â€” add every column the routes expect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS passcode_plain          TEXT,
  ADD COLUMN IF NOT EXISTS domain                  TEXT,
  ADD COLUMN IF NOT EXISTS require_approval        BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_id                UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status                  TEXT        DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT        DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_plan       TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS payment_subscription_id TEXT;

-- Drop any old plan check that blocks new values (monthly/yearly/trial)
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_plan_check;

-- â”€â”€ USERS â€” extra columns and 'parent' role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status        TEXT        DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subject       TEXT,
  ADD COLUMN IF NOT EXISTS class_name    TEXT,
  ADD COLUMN IF NOT EXISTS board         TEXT,             -- CBSE / ICSE / State / IB / Other (personal users)
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD  CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'parent'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD  CONSTRAINT users_status_check
  CHECK (status IN ('active', 'pending', 'suspended'));

-- â”€â”€ NETWORK RULES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS network_rules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  cidr        TEXT        NOT NULL,
  enabled     BOOLEAN     DEFAULT TRUE,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ LOGIN LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS login_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        REFERENCES schools(id) ON DELETE CASCADE,
  email       TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  success     BOOLEAN     DEFAULT TRUE,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ TASKS / SUBMISSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  subject       TEXT,
  target_class  TEXT,
  due_date      TIMESTAMPTZ,
  max_score     INT         DEFAULT 100,
  status        TEXT        DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_submissions (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT,
  file_url     TEXT,
  score        INT,
  feedback     TEXT,
  status       TEXT        DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at    TIMESTAMPTZ,
  graded_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (task_id, student_id)
);

-- â”€â”€ PARENT CODES + LINKS + MARKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS parent_codes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  used        BOOLEAN     DEFAULT FALSE,
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parent_links (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        REFERENCES schools(id) ON DELETE SET NULL,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS marks (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID         NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject         TEXT         NOT NULL,
  exam_name       TEXT         NOT NULL,
  marks_obtained  NUMERIC(6,2) NOT NULL CHECK (marks_obtained >= 0),
  total_marks     NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK (total_marks > 0),
  remarks         TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_users_school          ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_status          ON users(status);
CREATE INDEX IF NOT EXISTS idx_schools_passcode      ON schools(passcode_plain);
CREATE INDEX IF NOT EXISTS idx_schools_status        ON schools(status);
CREATE INDEX IF NOT EXISTS idx_network_rules_school  ON network_rules(school_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_user       ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_school     ON login_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created    ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_school          ON tasks(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task      ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student   ON task_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_codes_student  ON parent_codes(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_codes_code     ON parent_codes(code);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent   ON parent_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student  ON parent_links(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_student         ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_school          ON marks(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_teacher         ON marks(teacher_id);

-- â”€â”€ TRIGGERS (idempotent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$ BEGIN
  drop trigger if exists tasks_updated_at on tasks;
  CREATE TRIGGER tasks_updated_at  BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop trigger if exists marks_updated_at on marks;
  CREATE TRIGGER marks_updated_at  BEFORE UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- â”€â”€ ROW LEVEL SECURITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE network_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks            ENABLE ROW LEVEL SECURITY;

-- Service role bypasses everything; we add minimal user-side reads where helpful.
DO $$ BEGIN
  drop policy if exists "network_rules_school_read" on network_rules;
  CREATE POLICY "network_rules_school_read" ON network_rules FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "tasks_school_read" on tasks;
  CREATE POLICY "tasks_school_read" ON tasks FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "submissions_student_own" on task_submissions;
  CREATE POLICY "submissions_student_own" ON task_submissions FOR SELECT
    USING (student_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher','admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "login_logs_own_read" on login_logs;
  CREATE POLICY "login_logs_own_read" ON login_logs FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "parent_codes_student_read" on parent_codes;
  CREATE POLICY "parent_codes_student_read" ON parent_codes FOR SELECT
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "parent_links_parent_read" on parent_links;
  CREATE POLICY "parent_links_parent_read" ON parent_links FOR SELECT
    USING (parent_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "marks_read_own_student" on marks;
  CREATE POLICY "marks_read_own_student" ON marks FOR SELECT
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "marks_read_parent" on marks;
  CREATE POLICY "marks_read_parent" ON marks FOR SELECT
    USING (student_id IN (SELECT student_id FROM parent_links WHERE parent_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "marks_read_teacher_or_admin" on marks;
  CREATE POLICY "marks_read_teacher_or_admin" ON marks FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher','admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service-role write policies (cover all tables)
DO $$ BEGIN
  drop policy if exists "network_rules_service" on network_rules;
  CREATE POLICY "network_rules_service" ON network_rules FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "login_logs_service" on login_logs;
  CREATE POLICY "login_logs_service" ON login_logs FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "tasks_service" on tasks;
  CREATE POLICY "tasks_service" ON tasks FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "submissions_service" on task_submissions;
  CREATE POLICY "submissions_service" ON task_submissions FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "parent_codes_service" on parent_codes;
  CREATE POLICY "parent_codes_service" ON parent_codes FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "parent_links_service" on parent_links;
  CREATE POLICY "parent_links_service" ON parent_links FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "marks_service" on marks;
  CREATE POLICY "marks_service" ON marks FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- â”€â”€ HELPER VIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- DROP first because CREATE OR REPLACE VIEW refuses to reorder existing columns.
DROP VIEW IF EXISTS user_profile;
CREATE VIEW user_profile AS
  SELECT
    u.id, u.name, u.role, u.avatar_url, u.created_at,
    u.status, u.subject, u.class_name,
    s.id            AS school_id,
    s.school_name,
    s.school_logo_url,
    s.school_email,
    s.subscription_plan AS plan
  FROM users u
  LEFT JOIN schools s ON s.id = u.school_id;

DROP VIEW IF EXISTS parent_profile;
CREATE VIEW parent_profile AS
  SELECT
    u.id            AS parent_id,
    u.name          AS parent_name,
    u.role,
    pl.student_id,
    s.name          AS student_name,
    s.class_name,
    s.subject       AS student_subject,
    sc.id           AS school_id,
    sc.school_name,
    sc.school_logo_url
  FROM users u
  JOIN parent_links pl ON pl.parent_id = u.id
  JOIN users s         ON s.id = pl.student_id
  LEFT JOIN schools sc ON sc.id = pl.school_id
  WHERE u.role = 'parent';

-- â”€â”€ STORAGE BUCKET (idempotent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Public bucket for avatars + school logos. Safe to re-run.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('kairo-public', 'kairo-public', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS â€” anyone can read; only service role writes. Skip if duplicate.
DO $$ BEGIN
  drop policy if exists "kairo_public_read" on storage.objects;
  CREATE POLICY "kairo_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'kairo-public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  drop policy if exists "kairo_public_service_write" on storage.objects;
  CREATE POLICY "kairo_public_service_write"
    ON storage.objects FOR ALL
    USING (bucket_id = 'kairo-public' AND auth.role() = 'service_role')
    WITH CHECK (bucket_id = 'kairo-public' AND auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============ from parent_marks_schema.sql ============
-- ============================================================
-- Kairo â€” Parent Mode + Marks System Migration
-- Run in Supabase Dashboard â†’ SQL Editor AFTER school_schema.sql
-- ============================================================

-- â”€â”€ 1. Extend users role check to include 'parent' â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'parent'));

-- â”€â”€ 2. Parent Access Codes (students generate; parents use to link) â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS parent_codes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  used        BOOLEAN     DEFAULT FALSE,
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€ 3. Parentâ€“Student Links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS parent_links (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        REFERENCES schools(id) ON DELETE SET NULL,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_id, student_id)
);

-- â”€â”€ 4. Marks / Grades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS marks (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID         NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject         TEXT         NOT NULL,
  exam_name       TEXT         NOT NULL,
  marks_obtained  NUMERIC(6,2) NOT NULL CHECK (marks_obtained >= 0),
  total_marks     NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK (total_marks > 0),
  remarks         TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- â”€â”€ 5. Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_parent_codes_student  ON parent_codes(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_codes_code     ON parent_codes(code);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent   ON parent_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student  ON parent_links(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_student         ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_school          ON marks(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_teacher         ON marks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject         ON marks(subject);

-- â”€â”€ 6. Auto-update updated_at on marks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$ BEGIN
  drop trigger if exists marks_updated_at on marks;
  CREATE TRIGGER marks_updated_at
    BEFORE UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- â”€â”€ 7. Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE parent_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks        ENABLE ROW LEVEL SECURITY;

-- parent_codes: student sees their own codes; service role does everything
drop policy if exists "parent_codes_student_read" on parent_codes;
CREATE POLICY "parent_codes_student_read"
  ON parent_codes FOR SELECT
  USING (student_id = auth.uid());

drop policy if exists "parent_codes_service" on parent_codes;
CREATE POLICY "parent_codes_service"
  ON parent_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- parent_links: parent sees their own links; service role full
drop policy if exists "parent_links_parent_read" on parent_links;
CREATE POLICY "parent_links_parent_read"
  ON parent_links FOR SELECT
  USING (parent_id = auth.uid());

drop policy if exists "parent_links_service" on parent_links;
CREATE POLICY "parent_links_service"
  ON parent_links FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- marks: students/parents/teachers/admins see relevant rows; writes via service role
drop policy if exists "marks_read_own_student" on marks;
CREATE POLICY "marks_read_own_student"
  ON marks FOR SELECT
  USING (student_id = auth.uid());

drop policy if exists "marks_read_teacher_or_admin" on marks;
CREATE POLICY "marks_read_teacher_or_admin"
  ON marks FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

drop policy if exists "marks_read_parent" on marks;
CREATE POLICY "marks_read_parent"
  ON marks FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM parent_links WHERE parent_id = auth.uid()
    )
  );

drop policy if exists "marks_service" on marks;
CREATE POLICY "marks_service"
  ON marks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- â”€â”€ 8. Helper view: parent_profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE VIEW parent_profile AS
  SELECT
    u.id            AS parent_id,
    u.name          AS parent_name,
    u.role,
    pl.student_id,
    s.name          AS student_name,
    s.class_name,
    s.subject       AS student_subject,
    sc.id           AS school_id,
    sc.school_name,
    sc.school_logo_url
  FROM users u
  JOIN parent_links pl ON pl.parent_id = u.id
  JOIN users s         ON s.id = pl.student_id
  LEFT JOIN schools sc ON sc.id = pl.school_id
  WHERE u.role = 'parent';


-- ============ from twin_schema.sql ============
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Kairo OS Â· AI Academic Twin schema
--
-- Run this once in Supabase SQL Editor. Idempotent â€” safe to re-run.
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
--   event â†’ recompute knowledge_mastery for that topic
--         â†’ periodically recompute academic_twins snapshot
--         â†’ recompute recommendations + observations
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ 1. Event stream â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ 2. Per-topic mastery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Updated incrementally on every relevant event. The "forget_at" column is the
-- Ebbinghaus-predicted moment the student will likely forget the topic again
-- â€” used by the revision recommender.
CREATE TABLE IF NOT EXISTS knowledge_mastery (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL,
  topic            TEXT NOT NULL,              -- normalised, lower-case
  mastery          NUMERIC NOT NULL DEFAULT 0, -- 0..1 (EMA of correctness Ã— difficulty)
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

-- â”€â”€ 3. Academic Twin snapshot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- One row per student. Recomputed periodically from events + mastery + memory.
-- This is the "view" the Kairo OS dashboard reads from.
CREATE TABLE IF NOT EXISTS academic_twins (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Learning style proportions (sum â‰ˆ 1.0)
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
  predicted_band       TEXT,                        -- 'A+' | 'A' | 'B+' â€¦

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

-- â”€â”€ 4. Observations (supportive AI insights) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ 5. Adaptive recommendations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ 6. Study sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ Row-level security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    drop policy if exists twin_events_self_read on twin_events;
    CREATE POLICY twin_events_self_read           ON twin_events           FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'knowledge_mastery_self_read') THEN
    drop policy if exists knowledge_mastery_self_read on knowledge_mastery;
    CREATE POLICY knowledge_mastery_self_read     ON knowledge_mastery     FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_twins_self_read') THEN
    drop policy if exists academic_twins_self_read on academic_twins;
    CREATE POLICY academic_twins_self_read        ON academic_twins        FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_observations_self_read') THEN
    drop policy if exists twin_observations_self_read on twin_observations;
    CREATE POLICY twin_observations_self_read     ON twin_observations     FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_recommendations_self_read') THEN
    drop policy if exists twin_recommendations_self_read on twin_recommendations;
    CREATE POLICY twin_recommendations_self_read  ON twin_recommendations  FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'study_sessions_self_read') THEN
    drop policy if exists study_sessions_self_read on study_sessions;
    CREATE POLICY study_sessions_self_read        ON study_sessions        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;


-- ============ from twin_snapshot_schema.sql ============
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Kairo OS Â· Twin Snapshot â€” cross-device auto-sync.
--
-- Stores a single rolling snapshot of each user's full local TwinState
-- (events, mastery, doubts, concepts, formulas, flashcards). The client
-- uploads on every change (debounced 5s) and pulls on a fresh login so
-- the student's history follows them across devices.
--
-- Run once in Supabase SQL Editor. Idempotent â€” safe to re-run.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- RLS â€” every user can only read/write their own snapshot. The /api/twin/snapshot
-- endpoints already check req.user.id, but defense-in-depth is cheap.
ALTER TABLE twin_snapshots ENABLE ROW LEVEL SECURITY;

drop policy if exists "twin_snapshots own" on twin_snapshots;
CREATE POLICY "twin_snapshots own" ON twin_snapshots
  USING        (auth.uid() = user_id)
  WITH CHECK   (auth.uid() = user_id);


-- ============ from solver_cache_schema.sql ============
-- ============================================================
-- Kairo â€” Solver Persistent Cache
-- One row per (normalized) question. Shared by every Vercel function
-- instance, survives deploys, hit-counted for popularity analytics.
-- Run in Supabase Dashboard â†’ SQL Editor.
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
  drop trigger if exists solver_cache_updated_at on solver_cache;
  CREATE TRIGGER solver_cache_updated_at
    BEFORE UPDATE ON solver_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role only â€” no end-user direct access
ALTER TABLE solver_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  drop policy if exists solver_cache_service on solver_cache;
  CREATE POLICY solver_cache_service ON solver_cache FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============ from kairo_otps_schema.sql ============
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Kairo OS Â· Device-passcode OTP storage.
--
-- Replaces the in-memory Map in routes/passcode.js. Survives Vercel cold
-- starts and works across multiple serverless instances. Critical when
-- the platform has > ~50 concurrent users.
--
-- Run once in Supabase SQL Editor. Idempotent â€” safe to re-run.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- No RLS â€” only the server (via service_role) ever touches this table.
-- Users never query it directly, so we don't expose it to the public API.


-- ============ from exam_plans_schema.sql ============
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Exam Planner â€” persistent storage
-- Paste this whole file into Supabase â–¸ SQL Editor â–¸ New Query â–¸ Run
-- (One-time setup. Idempotent â€” safe to re-run.)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

drop policy if exists "users read own plans" on exam_plans;
create policy "users read own plans"
  on exam_plans for select  using (auth.uid() = user_id);
drop policy if exists "users insert own plans" on exam_plans;
create policy "users insert own plans"
  on exam_plans for insert  with check (auth.uid() = user_id);
drop policy if exists "users update own plans" on exam_plans;
create policy "users update own plans"
  on exam_plans for update  using (auth.uid() = user_id);
drop policy if exists "users delete own plans" on exam_plans;
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


-- ============ from league_schema.sql ============
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Kairo League â€” weekly XP leaderboard (Duolingo-style)
-- Paste into Supabase â–¸ SQL Editor â–¸ Run.  Idempotent.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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



-- ============ battle_scores (from routes/battle.js) ============
create table if not exists battle_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  school_id  uuid,
  score      integer not null default 0,
  total      integer not null default 0,
  accuracy   double precision not null default 0,
  difficulty text,
  topic      text,
  subject    text,
  xp         integer not null default 0,
  is_daily   boolean not null default false,
  played_on  date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists battle_scores_user_idx   on battle_scores (user_id, created_at desc);
create index if not exists battle_scores_school_idx on battle_scores (school_id, played_on);
alter table battle_scores enable row level security;

-- ============ ai_memory (from routes/memory.js) ============
create table if not exists ai_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  type       text not null,
  subject    text,
  topic      text,
  content    text,
  signal     double precision not null default 0,
  hits       integer not null default 1,
  last_seen  timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ai_memory_user_idx on ai_memory (user_id, last_seen desc);
alter table ai_memory enable row level security;

-- ============ concept_relations (from routes/knowledge.js) ============
create table if not exists concept_relations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  school_id  uuid,
  from_topic text not null,
  to_topic   text not null,
  kind       text not null,
  subject    text,
  confidence double precision not null default 0.7,
  created_at timestamptz not null default now()
);
create index if not exists concept_relations_user_idx on concept_relations (user_id);
alter table concept_relations enable row level security;

-- ============ admission_leads (from routes/admission.js) ============
create table if not exists admission_leads (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid,
  parent_name text,
  child_name  text,
  grade       text,
  phone       text,
  email       text,
  message     text,
  source      text default 'chat_bot',
  status      text default 'new',
  created_at  timestamptz not null default now()
);
create index if not exists admission_leads_school_idx on admission_leads (school_id, created_at desc);
alter table admission_leads enable row level security;
