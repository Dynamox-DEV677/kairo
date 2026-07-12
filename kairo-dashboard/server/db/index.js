
import Datastore from '@seald-io/nedb'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = process.env.DB_PATH
  || (process.env.VERCEL ? '/tmp/kairo-data' : path.join(__dirname, '../../data'))

try {
  fs.mkdirSync(DATA_DIR, { recursive: true })
} catch (e) {
  console.error('[DB] Could not create data directory:', DATA_DIR, e.message)
}

function store(name) {
  return new Datastore({
    filename: path.join(DATA_DIR, `${name}.db`),
    autoload: true,
  })
}

export const db = {
  credentials:    store('credentials'),
  students:       store('students'),
  fees:           store('fees'),
  emailLogs:      store('email_logs'),
  config:         store('config'),

  users:          store('users'),
  flashcards:     store('flashcards'),
  studyPlans:     store('study_plans'),
  essays:         store('essays'),
  timetable:      store('timetable'),
  admissionLeads: store('admission_leads'),
  attendance:     store('attendance'),

  quizSessions:    store('quiz_sessions'),
  mindmaps:        store('mindmaps'),
  doubts:          store('doubts'),
  formulaSheets:   store('formula_sheets'),
  announcements:   store('announcements'),
  gradingSessions: store('grading_sessions'),
  gamification:    store('gamification'),
  writingSessions: store('writing_sessions'),
}

db.credentials.ensureIndex({ fieldName: 'school_id', unique: true })
db.students.ensureIndex({ fieldName: 'school_id' })
db.fees.ensureIndex({ fieldName: 'student_id' })
db.fees.ensureIndex({ fieldName: 'school_id' })
db.emailLogs.ensureIndex({ fieldName: 'school_id' })
db.config.ensureIndex({ fieldName: 'school_id', unique: true })

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

db.quizSessions.ensureIndex({ fieldName: 'school_id' })
db.mindmaps.ensureIndex({ fieldName: 'school_id' })
db.doubts.ensureIndex({ fieldName: 'school_id' })
db.formulaSheets.ensureIndex({ fieldName: 'school_id' })
db.announcements.ensureIndex({ fieldName: 'school_id' })
db.gradingSessions.ensureIndex({ fieldName: 'school_id' })
db.gamification.ensureIndex({ fieldName: 'school_id' })
db.writingSessions.ensureIndex({ fieldName: 'school_id' })

export default db
