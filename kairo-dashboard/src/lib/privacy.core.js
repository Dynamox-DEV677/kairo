/**
 * What actually leaves this device.
 *
 * Settings used to say, flatly: "All your data is stored locally on your
 * device. Nothing is sent to our servers." That is true in local mode and
 * false the moment a student signs in — the whole twin blob syncs on a
 * debounce, every doubt goes to the model, and screen views are beaconed.
 * A privacy promise the network tab contradicts is worse than no promise:
 * it is the one claim a student cannot check for themselves, so it runs
 * entirely on trust.
 *
 * So the inventory lives here, in code, next to the route table it describes
 * — and privacy-inventory.test.js fails the build when a new server route
 * appears that nobody has classified. The Settings page renders THIS. It can
 * no longer drift from what the app does, because a drift is a failing test.
 */

/** Every route under server/routes, by what it sends. Unclassified = build fails. */
export const ROUTE_CATEGORY = {
  // identity — who you are
  'account': 'account', 'auth': 'account', 'credentials': 'account',
  'passcode': 'account', 'passwordReset': 'account', 'usersV2': 'account',

  // the learning twin — what you have studied
  'twin': 'twin', 'memory': 'twin', 'notes': 'twin',
  'gamification': 'twin', 'tasks': 'twin',

  // things you type that a model reads
  'aiChat': 'ai', 'concept': 'ai', 'council': 'ai', 'essay': 'ai',
  // mistake samples sent for a one-line diagnosis, cached per signature
  'performance': 'ai',
  // a chapter's three-session split, reworded by the model; the standard split is the fallback
  'plan': 'ai',
  'exam': 'ai', 'examPlanner': 'ai', 'flashcards': 'ai', 'formula': 'ai',
  'grading': 'ai', 'knowledge': 'ai', 'notebook': 'ai', 'quiz': 'ai',
  'study': 'ai', 'studyPlan': 'ai', 'topicArchitect': 'ai', 'writing': 'ai',
  'battle': 'ai', 'tts': 'ai',

  // photos and files you upload
  'cameraLive': 'media', 'document': 'media',
  // photographed handwritten answers and spoken teach-back transcripts
  'practice': 'media',

  // screen views
  'analytics': 'telemetry',

  // only in school mode — visible to your teacher or admin
  'admission': 'school', 'announcement': 'school', 'attendance': 'school',
  'fees': 'school', 'lessonPlan': 'school', 'marks': 'school',
  'parent': 'school', 'parentMessage': 'school', 'payments': 'school',
  'questionPaper': 'school', 'schoolHealth': 'school', 'schools': 'school',
  'students': 'school', 'timetable': 'school', 'league': 'school',

  // server plumbing — carries no student content
  'cron': 'ops', 'devEmailPreview': 'ops', 'emails': 'ops',
  'networkRules': 'ops', 'notifications': 'ops', 'ops': 'ops',
}

/**
 * The student-facing inventory. One entry per category, in plain words.
 *
 * `when` is the honest trigger, not a euphemism. `optional` marks the flows a
 * student can actually switch off — calling a flow optional when it is not
 * would be the same lie in a smaller font.
 */
export const DATA_FLOWS = [
  {
    id: 'account', category: 'account',
    what: 'Your name, email, class and board',
    when: 'When you sign in',
    where: 'Your Kyno account',
    appliesWhen: 'signed-in', optional: false,
  },
  {
    id: 'twin', category: 'twin',
    what: 'Your whole learning history — quiz answers, mistakes, flashcards, notes, focus sessions, XP',
    when: 'While you are signed in, a few seconds after each change',
    where: 'Your private Kyno backup',
    appliesWhen: 'signed-in', optional: false,
    note: 'This is what makes your progress survive a lost phone. Sign out and it stops. Delete it below and it is gone.',
  },
  {
    id: 'ai', category: 'ai',
    what: 'What you ask — doubts, essays, topics you want quizzed',
    when: 'Each time you use an AI feature',
    where: 'Kyno server, then the AI model that answers',
    appliesWhen: 'on-use', optional: false,
    note: 'This one has to leave: the models are far too large to run inside your browser.',
  },
  {
    id: 'media', category: 'media',
    what: 'Photos, documents and answers you upload',
    when: 'Each time you snap a question, add a file, photograph a written answer, or explain something out loud',
    where: 'Kyno server, then the AI model that reads it',
    appliesWhen: 'on-use', optional: false,
  },
  {
    id: 'telemetry', category: 'telemetry',
    what: 'Which screens you open — the screen name and the time, never what you typed',
    when: 'As you move around the app',
    where: 'Kyno server logs',
    appliesWhen: 'always', optional: true,
    note: 'It tells us which features are worth keeping. You can turn it off and nothing else changes.',
  },
  {
    id: 'school', category: 'school',
    what: 'Attendance, marks and fees',
    when: 'Only if your school set up Kyno for you',
    where: 'Your school, who can see it',
    appliesWhen: 'school-mode', optional: false,
  },
  {
    id: 'ops', category: 'ops',
    what: 'Nothing about you — server health and scheduled jobs',
    when: 'Background',
    where: 'Kyno server',
    appliesWhen: 'never-personal', optional: false,
  },
]

/**
 * Which flows are live for THIS student right now.
 *
 * The honest answer differs per person, which is exactly why one fixed
 * sentence was never going to be right for everyone.
 */
export function activeFlows({ signedIn = false, schoolMode = false, telemetry = true } = {}) {
  return DATA_FLOWS.filter(f => {
    if (f.category === 'ops') return false                 // carries nothing personal
    if (f.id === 'telemetry') return telemetry
    if (f.appliesWhen === 'signed-in') return signedIn
    if (f.appliesWhen === 'school-mode') return schoolMode
    return true                                            // on-use, always
  })
}

/**
 * The one-line summary above the table.
 *
 * Local mode with telemetry off is the only state where the strong claim is
 * true — so it is the only state allowed to make it.
 */
export function privacyHeadline({ signedIn = false, schoolMode = false, telemetry = true } = {}) {
  if (!signedIn && !telemetry) {
    return 'Nothing leaves this device, except what you ask the AI. Everything else is stored in this browser only — and not backed up, so clearing your browser data erases it.'
  }
  if (!signedIn) {
    return 'Your work stays in this browser. The only things that leave are what you ask the AI and which screens you open.'
  }
  if (schoolMode) {
    return 'Your work is stored on this device and backed up to your Kyno account, and your school can see attendance, marks and fees. Here is everything that leaves, and when.'
  }
  return 'Your work is stored on this device and backed up to your Kyno account, so you can pick it up on another phone. Here is everything that leaves, and when.'
}
