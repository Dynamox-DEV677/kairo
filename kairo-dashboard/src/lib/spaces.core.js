/**
 * The seven spaces, as data: ids, labels, and where every old route now goes.
 *
 * Pure and icon-free so the test runner can import it. src/lib/spaces.ts adds
 * the lucide icons on top; the drawer, the desktop sidebar, the bottom bar and
 * the hash router all read this.
 */

export const SPACE_META = [
  { id: 'doubt-solving', label: 'Doubt Solving', sub: 'ask a question, get stepped answers' },
  { id: 'practice',      label: 'Practice',      sub: 'timed sessions, flashcards, written grading' },
  { id: 'performance',   label: 'Performance',   sub: 'your repeating mistakes' },
  { id: 'plan',          label: 'Plan',          sub: 'exam countdown and syllabus coverage' },
  { id: 'notes',         label: 'Notes',         sub: 'one library, nothing kept without a return date' },
  { id: 'progress',      label: 'Progress',      sub: 'what you know, and the people studying beside you' },
  { id: 'profile',       label: 'Profile',       sub: 'your username, your studies, who can see you' },
]

export const SPACE_IDS = new Set(SPACE_META.map(s => s.id))

/**
 * Every old route, pointed at the space that absorbed it. Nothing is deleted:
 * an old bookmark, a deep link in a note, or a button somewhere Kyno has not
 * been reread yet all resolve here instead of landing nowhere.
 *
 * The pages NOT listed still exist under their own ids and stay in the drawer:
 * Home, Kyno OS, Study Mode Live, Revision Reels, Concept Tools, Switched
 * board, Which stream, School tasks, and every teacher/admin/parent screen.
 * Those are not part of a space, so redirecting them would lose them.
 */
export const SPACE_ALIASES = {
  // Doubt Solving — chat, solver, camera
  doubt: 'doubt-solving',
  'solver-classic': 'doubt-solving',
  camera: 'doubt-solving',
  'camera-study': 'doubt-solving',

  // Practice — flashcards, quizzes, mocks, written grading, teach-back
  flashcards: 'practice',
  quiz: 'practice',
  'exam-hall': 'practice',
  simulator: 'practice',
  'teach-back': 'practice',
  essay: 'practice',

  // Performance — the repeating mistakes
  mistakes: 'performance',
  museum: 'performance',
  'explain-mistake': 'performance',

  // Plan — one horizon
  goal: 'plan',
  'study-plan': 'plan',
  'exam-planner': 'plan',
  'topic-architect': 'plan',
  focus: 'plan',
  pomodoro: 'plan',

  // Notes — one library
  notebook: 'notes',
  formula: 'notes',
  listen: 'notes',
  writing: 'notes',

  // Progress — the map, the league, battles, the room
  battle: 'progress',
  league: 'progress',
  knowledge: 'progress',
  'concept-map': 'progress',
  rooms: 'progress',

  // Profile — settings
  settings: 'profile',

  // the pre-cutover door, now gone
  new: 'progress',
}

/** Resolve an old id to the space that absorbed it; anything else is returned as-is. */
export function resolveSpace(id) {
  return SPACE_ALIASES[id] || id
}
