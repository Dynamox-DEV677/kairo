/**
 * Database — NeDB (pure-JS, no native compilation, file-backed)
 *
 * Collections:
 *  credentials     — encrypted Gmail SMTP settings per school
 *  students        — student + parent contact records
 *  fees            — fee records per student
 *  emailLogs       — every email attempted (sent / failed / pending)
 *  config          — reminder schedule config per school
 *
 *  [v2 — SaaS Features]
 *  users           — registered users (teachers / admins)
 *  flashcards      — flashcard deck items with SRS state
 *  studyPlans      — generated study plans per student
 *  essays          — submitted essays + AI grading results
 *  timetable       — class schedule entries per school
 *  admissionLeads  — enquiry bot captured leads
 *  attendanceLogs  — daily attendance records per student
 *
 *  [v3 — Extended Features]
 *  quizSessions    — adaptive quiz sessions + results
 *  mindmaps        — chapter mindmaps
 *  doubts          — doubt history
 *  formulaSheets   — generated formula sheets
 *  announcements   — school announcements
 *  gradingSessions — bulk grading sessions
 *  gamification    — XP, levels, badges per user
 *  writingSessions — writing tool sessions
 */

import Datastore from '@seald-io/nedb'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = process.env.DB_PATH || path.join(__dirname, '../../data')

function store(name) {
  return new Datastore({
    filename: path.join(DATA_DIR, `${name}.db`),
    autoload: true,
  })
}

export const db = {
  // ── v1 collections ─────────────────────────────────────────────────────────
  credentials:    store('credentials'),
  students:       store('students'),
  fees:           store('fees'),
  emailLogs:      store('email_logs'),
  config:         store('config'),

  // ── v2 collections ─────────────────────────────────────────────────────────
  users:          store('users'),
  flashcards:     store('flashcards'),
  studyPlans:     store('study_plans'),
  essays:         store('essays'),
  timetable:      store('timetable'),
  admissionLeads: store('admission_leads'),
  attendance:     store('attendance'),

  // ── v3 collections ─────────────────────────────────────────────────────────
  quizSessions:    store('quiz_sessions'),
  mindmaps:        store('mindmaps'),
  doubts:          store('doubts'),
  formulaSheets:   store('formula_sheets'),
  announcements:   store('announcements'),
  gradingSessions: store('grading_sessions'),
  gamification:    store('gamification'),
  writingSessions: store('writing_sessions'),
}

// ── Indexes ───────────────────────────────────────────────────────────────────

// v1
db.credentials.ensureIndex({ fieldName: 'school_id', unique: true })
db.students.ensureIndex({ fieldName: 'school_id' })
db.fees.ensureIndex({ fieldName: 'student_id' })
db.fees.ensureIndex({ fieldName: 'school_id' })
db.emailLogs.ensureIndex({ fieldName: 'school_id' })
db.config.ensureIndex({ fieldName: 'school_id', unique: true })

// v2
db.users.ensureIndex({ fieldName: 'email', unique: true })
db.users.ensureIndex({ fieldName: 'school_id' })
db.flashcards.ensureIndex({ fieldName: 'school_id' })
db.flashcards.ensureIndex({ fieldName: 'created_by' })
db.studyPlans.ensureIndex({ fieldName: 'student_id' })
db.essays.ensureIndex({ fieldName: 'student_id' })
db.timetable.ensureIndex({ fieldName: 'school_id' })
db.admissionLeads.ensureIndex({ fieldName: 'school_id' })
db.attendance.ensureIndex({ fieldName: 'school_id' })
db.attendance.ensureIndex({ fieldName: 'student_id' })

// v3
db.quizSessions.ensureIndex({ fieldName: 'school_id' })
db.mindmaps.ensureIndex({ fieldName: 'school_id' })
db.doubts.ensureIndex({ fieldName: 'school_id' })
db.formulaSheets.ensureIndex({ fieldName: 'school_id' })
db.announcements.ensureIndex({ fieldName: 'school_id' })
db.gradingSessions.ensureIndex({ fieldName: 'school_id' })
db.gamification.ensureIndex({ fieldName: 'school_id' })
db.writingSessions.ensureIndex({ fieldName: 'school_id' })

export default db
