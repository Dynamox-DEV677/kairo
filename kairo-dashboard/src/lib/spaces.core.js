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
  quiz: 'practice/quiz',
  adaptive: 'practice/quiz',
  'adaptive-quiz': 'practice/quiz',
  'exam-hall': 'practice/mock',
  mock: 'practice/mock',
  simulator: 'practice/simulator',
  'teach-back': 'practice/teachback',
  essay: 'notes/write',
  grader: 'notes/write',

  // Performance — the repeating mistakes
  mistakes: 'performance',
  museum: 'performance',
  'explain-mistake': 'performance',

  // Plan — one horizon
  goal: 'plan',
  'study-plan': 'plan',
  'exam-planner': 'plan',
  'topic-architect': 'plan',
  focus: 'plan/focus',
  pomodoro: 'plan/focus',
  planner: 'plan',
  timetable: 'plan',
  tasks: 'plan',

  // Notes — one library
  notebook: 'notes',
  formula: 'notes/formulas',
  listen: 'notes/watch',
  writing: 'notes/write',
  reels: 'notes/watch',

  // Progress — the map, the league, battles, the room
  battle: 'progress/battle',
  league: 'progress/league',
  knowledge: 'progress/map',
  'concept-map': 'progress/map',
  'knowledge-graph': 'progress/map',
  rooms: 'progress/room',
  'study-room': 'progress/room',

  // Profile — settings. Everything Settings held was MOVED into Profile
  // (account, backup and devices, privacy, this device, developer), so the
  // redirect no longer loses anything.
  settings: 'profile',

  // the pre-cutover door, now gone
  new: 'progress',
}

/**
 * Resolve an old id to the space AND the screen inside it.
 *
 * A redirect that only names the space drops the student on an index and
 * makes them find the thing again -- #/formula landing on the Notes home is
 * not the formula sheet. An alias may therefore be "space/view", and the
 * view is handed to the space so it opens on the right screen.
 */
export function resolveRoute(id, role) {
  // THE SEVEN SPACES ARE THE STUDENT APP. Teacher, admin and parent navigation
  // was deliberately left alone by the cutover, so their routes must not be
  // redirected: a teacher's Flashcards and Grader, and an admin's Timetable,
  // are their own tools and would otherwise vanish into a student space.
  if (role && role !== 'student') return { space: id, view: null }
  const target = SPACE_ALIASES[id] || id
  const slash = target.indexOf('/')
  if (slash === -1) return { space: target, view: null }
  return { space: target.slice(0, slash), view: target.slice(slash + 1) }
}

/** Just the space. Anything that is not an alias is returned as-is. */
export function resolveSpace(id, role) {
  return resolveRoute(id, role).space
}

/** The event a space listens for to open on a particular screen. */
export const SPACE_VIEW_EVENT = 'kyno:space-view'
