-- ============================================================
-- Kairo — Parent Mode + Marks System Migration
-- Run in Supabase Dashboard → SQL Editor AFTER school_schema.sql
-- ============================================================

-- ── 1. Extend users role check to include 'parent' ─────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'parent'));

-- ── 2. Parent Access Codes (students generate; parents use to link) ─────────
CREATE TABLE IF NOT EXISTS parent_codes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  used        BOOLEAN     DEFAULT FALSE,
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Parent–Student Links ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_links (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID        REFERENCES schools(id) ON DELETE SET NULL,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_id, student_id)
);

-- ── 4. Marks / Grades ──────────────────────────────────────────────────────
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

-- ── 5. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_parent_codes_student  ON parent_codes(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_codes_code     ON parent_codes(code);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent   ON parent_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student  ON parent_links(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_student         ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_school          ON marks(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_teacher         ON marks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject         ON marks(subject);

-- ── 6. Auto-update updated_at on marks ─────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER marks_updated_at
    BEFORE UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE parent_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks        ENABLE ROW LEVEL SECURITY;

-- parent_codes: student sees their own codes; service role does everything
CREATE POLICY "parent_codes_student_read"
  ON parent_codes FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "parent_codes_service"
  ON parent_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- parent_links: parent sees their own links; service role full
CREATE POLICY "parent_links_parent_read"
  ON parent_links FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "parent_links_service"
  ON parent_links FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- marks: students/parents/teachers/admins see relevant rows; writes via service role
CREATE POLICY "marks_read_own_student"
  ON marks FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "marks_read_teacher_or_admin"
  ON marks FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

CREATE POLICY "marks_read_parent"
  ON marks FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM parent_links WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "marks_service"
  ON marks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 8. Helper view: parent_profile ─────────────────────────────────────────
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
