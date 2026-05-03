-- ============================================================
-- Kairo — School Management Core Migration
-- Run AFTER schema.sql in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── ALTER SCHOOLS ──────────────────────────────────────────────
-- Add new columns for upgraded school registration
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS domain          TEXT,            -- e.g. "pvtschool.edu.in"
  ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE,  -- admin must approve students
  ADD COLUMN IF NOT EXISTS owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL;
                                                            -- school admin/owner

-- ── ALTER USERS ────────────────────────────────────────────────
-- Add new columns for richer user profiles
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'suspended')),
  ADD COLUMN IF NOT EXISTS subject       TEXT,             -- teacher: main subject
  ADD COLUMN IF NOT EXISTS class_name    TEXT,             -- student: class/grade (e.g. "10A")
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- ── NETWORK RULES ──────────────────────────────────────────────
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

-- ── TASKS (Homework / Assignments) ────────────────────────────
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

-- ── TASK SUBMISSIONS ──────────────────────────────────────────
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

-- ── LOGIN LOGS ────────────────────────────────────────────────
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

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_network_rules_school   ON network_rules(school_id);
CREATE INDEX IF NOT EXISTS idx_tasks_school           ON tasks(school_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by       ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_submissions_task       ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON task_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_user        ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_school      ON login_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created     ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_status           ON users(status);

-- ── TRIGGERS ─────────────────────────────────────────────────
-- Auto-update updated_at on tasks
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE network_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs      ENABLE ROW LEVEL SECURITY;

-- network_rules: only visible to same school members
CREATE POLICY "network_rules_school_read"
  ON network_rules FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "network_rules_service_write"
  ON network_rules FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- tasks: visible to members of the same school
CREATE POLICY "tasks_school_read"
  ON tasks FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "tasks_service_write"
  ON tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- task_submissions: student owns their own; service role does everything
CREATE POLICY "submissions_student_own"
  ON task_submissions FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

CREATE POLICY "submissions_service_write"
  ON task_submissions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- login_logs: users see their own; service role full access
CREATE POLICY "login_logs_own_read"
  ON login_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "login_logs_service_write"
  ON login_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── AUTO-CLEANUP (optional pg_cron) ──────────────────────────
-- Delete login_logs older than 90 days (uncomment if pg_cron enabled):
-- SELECT cron.schedule('delete-old-login-logs', '0 2 * * *',
--   'DELETE FROM login_logs WHERE created_at < NOW() - INTERVAL ''90 days''');
