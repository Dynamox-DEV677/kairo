-- ============================================================
-- Kairo — Supabase PostgreSQL Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── SCHOOLS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name     TEXT        UNIQUE NOT NULL,
  school_passcode TEXT        NOT NULL,   -- bcrypt-hashed
  school_logo_url TEXT,
  school_email    TEXT,
  plan            TEXT        DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── USERS ─────────────────────────────────────────────────────
-- Extends Supabase auth.users
CREATE TABLE IF NOT EXISTS users (
  id          UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT  NOT NULL,
  role        TEXT  NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  school_id   UUID  REFERENCES schools(id) ON DELETE SET NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTES ─────────────────────────────────────────────────────
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

-- ── NOTIFICATIONS ─────────────────────────────────────────────
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

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_school       ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_notes_user         ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_school       ON notes(school_id);
CREATE INDEX IF NOT EXISTS idx_notifs_school      ON notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_notifs_expires     ON notifications(expires_at);

-- ── AUTO UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AUTO DELETE expired notifications ─────────────────────────
-- Supabase scheduled job via pg_cron (enable it in Supabase Extensions)
-- SELECT cron.schedule('delete-expired-notifications', '0 * * * *',
--   'DELETE FROM notifications WHERE expires_at < NOW()');

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE schools       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Schools: anyone can read, only service role can write
CREATE POLICY "schools_public_read"
  ON schools FOR SELECT USING (true);

CREATE POLICY "schools_service_insert"
  ON schools FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Users: can read own profile; service role can do anything
CREATE POLICY "users_read_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_read_same_school"
  ON users FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Notes: user owns their notes
CREATE POLICY "notes_owner_all"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications: users see their school's active ones
CREATE POLICY "notifs_read_school"
  ON notifications FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND expires_at > NOW()
  );

-- Only teachers (or service role) can INSERT notifications
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

-- ── HELPER VIEWS ──────────────────────────────────────────────

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
