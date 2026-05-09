-- ============================================================
-- Kairo — Signup + Payment + Parent Schema (run-anytime, idempotent)
-- Run this in Supabase Dashboard → SQL Editor.
-- Safe to re-run; uses IF NOT EXISTS / DROP IF EXISTS everywhere.
-- ============================================================

-- ── EXTENSIONS (no-ops if already enabled) ───────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── SCHOOLS — add every column the routes expect ─────────────────────────
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

-- ── USERS — extra columns and 'parent' role ──────────────────────────────
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

-- ── NETWORK RULES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_rules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  cidr        TEXT        NOT NULL,
  enabled     BOOLEAN     DEFAULT TRUE,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOGIN LOGS ──────────────────────────────────────────────────────────
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

-- ── TASKS / SUBMISSIONS ─────────────────────────────────────────────────
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

-- ── PARENT CODES + LINKS + MARKS ────────────────────────────────────────
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

-- ── INDEXES ──────────────────────────────────────────────────────────────
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

-- ── TRIGGERS (idempotent) ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER tasks_updated_at  BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER marks_updated_at  BEFORE UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────────
ALTER TABLE network_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks            ENABLE ROW LEVEL SECURITY;

-- Service role bypasses everything; we add minimal user-side reads where helpful.
DO $$ BEGIN
  CREATE POLICY "network_rules_school_read" ON network_rules FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tasks_school_read" ON tasks FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "submissions_student_own" ON task_submissions FOR SELECT
    USING (student_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher','admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "login_logs_own_read" ON login_logs FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "parent_codes_student_read" ON parent_codes FOR SELECT
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "parent_links_parent_read" ON parent_links FOR SELECT
    USING (parent_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "marks_read_own_student" ON marks FOR SELECT
    USING (student_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "marks_read_parent" ON marks FOR SELECT
    USING (student_id IN (SELECT student_id FROM parent_links WHERE parent_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "marks_read_teacher_or_admin" ON marks FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher','admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service-role write policies (cover all tables)
DO $$ BEGIN
  CREATE POLICY "network_rules_service" ON network_rules FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "login_logs_service" ON login_logs FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tasks_service" ON tasks FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "submissions_service" ON task_submissions FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "parent_codes_service" ON parent_codes FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "parent_links_service" ON parent_links FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "marks_service" ON marks FOR ALL
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── HELPER VIEWS ────────────────────────────────────────────────────────
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

-- ── STORAGE BUCKET (idempotent) ─────────────────────────────────────────
-- Public bucket for avatars + school logos. Safe to re-run.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('kairo-public', 'kairo-public', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS — anyone can read; only service role writes. Skip if duplicate.
DO $$ BEGIN
  CREATE POLICY "kairo_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'kairo-public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kairo_public_service_write"
    ON storage.objects FOR ALL
    USING (bucket_id = 'kairo-public' AND auth.role() = 'service_role')
    WITH CHECK (bucket_id = 'kairo-public' AND auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
