/**
 * THE CUTOVER: the seven spaces are the app now.
 *
 * The drawer is seven groups, "More" is gone, the pre-cutover #/new door is
 * gone, and every old route redirects to the space that absorbed it. The last
 * one is the part that matters most: a student's bookmark, a link in their
 * notes, or a button in a corner of the app nobody has reread must still land
 * somewhere real. These tests pin all of it, plus the real-device rules the
 * spaces promised.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SPACE_META as SPACES, SPACE_IDS, SPACE_ALIASES, resolveSpace, resolveRoute } from '../../src/lib/spaces.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

const dashboard = read('src', 'pages', 'Dashboard.tsx')
const drawer = read('src', 'components', 'MobileShell.tsx')
const sidebar = read('src', 'components', 'Sidebar.tsx')

/** Every id the Dashboard registers as a real page. */
const registered = new Set([...dashboard.matchAll(/^\s+'?([a-z0-9-]+)'?:\s+'[^']+',$/gm)].map(m => m[1]))

test('there are seven spaces and every one is a registered page rendered in the frame', () => {
  assert.equal(SPACES.length, 7)
  assert.deepEqual(SPACES.map(s => s.id),
    ['doubt-solving', 'practice', 'performance', 'plan', 'notes', 'progress', 'profile'])
  for (const s of SPACES) {
    assert.ok(registered.has(s.id), `${s.id} is missing from PAGE_TITLES`)
    assert.match(dashboard, new RegExp(`<SpaceFrame active="${s.id}"`), `${s.id} does not render inside SpaceFrame`)
  }
})

test('every old route redirects to a space, and no redirect points at a dead end', () => {
  for (const [from, target] of Object.entries(SPACE_ALIASES)) {
    const { space } = resolveRoute(from)
    assert.ok(SPACE_IDS.has(space), `${from} redirects to ${target}, whose space is not real`)
    assert.equal(resolveSpace(from), space)
    assert.equal(SPACE_ALIASES[space], undefined, `${space} is both a redirect target and a source`)
  }
  // the consolidations each brief promised
  for (const [from, to] of [
    ['flashcards', 'practice'], ['exam-hall', 'practice'], ['essay', 'notes'], ['quiz', 'practice'],
    ['mistakes', 'performance'], ['museum', 'performance'],
    ['goal', 'plan'], ['study-plan', 'plan'], ['exam-planner', 'plan'], ['focus', 'plan'], ['pomodoro', 'plan'],
    ['notebook', 'notes'], ['formula', 'notes'], ['listen', 'notes'], ['writing', 'notes'],
    ['battle', 'progress'], ['league', 'progress'], ['knowledge', 'progress'], ['concept-map', 'progress'], ['rooms', 'progress'],
    ['camera', 'doubt-solving'], ['new', 'progress'],
  ]) assert.equal(resolveSpace(from), to, `#/${from} should land in ${to}`)

  /**
   * A redirect must land on the SCREEN, not the space's index. Sending
   * #/formula to the Notes home makes the student go and find the formula
   * sheet themselves, which is barely better than a 404.
   */
  for (const [from, space, view] of [
    ['formula', 'notes', 'formulas'], ['listen', 'notes', 'watch'], ['writing', 'notes', 'write'],
    ['battle', 'progress', 'battle'], ['league', 'progress', 'league'],
    ['concept-map', 'progress', 'map'], ['knowledge', 'progress', 'map'], ['knowledge-graph', 'progress', 'map'],
    ['rooms', 'progress', 'room'], ['study-room', 'progress', 'room'],
    ['focus', 'plan', 'focus'], ['pomodoro', 'plan', 'focus'],
    ['reels', 'notes', 'watch'],
    // each old Practice route opens the FORMAT it used to be, never the index
    ['quiz', 'practice', 'quiz'], ['adaptive', 'practice', 'quiz'],
    ['exam-hall', 'practice', 'mock'], ['mock', 'practice', 'mock'],
    ['simulator', 'practice', 'simulator'], ['teach-back', 'practice', 'teachback'],
    // the written grader lives on the Notes writing screen, not in Practice
    ['essay', 'notes', 'write'], ['grader', 'notes', 'write'],
  ]) assert.deepEqual(resolveRoute(from), { space, view }, `#/${from} should open ${space}/${view}`)

  // and a plain space alias carries no view
  assert.deepEqual(resolveRoute('notebook'), { space: 'notes', view: null })
  assert.deepEqual(resolveRoute('practice'), { space: 'practice', view: null })
  // an id nobody redirected is left alone
  for (const keep of ['home', 'kairo-os', 'camera-live', 'concept', 'bridge', 'stream', 'school']) {
    assert.equal(resolveSpace(keep), keep, `${keep} belongs to no space and must keep its own route`)
    assert.ok(registered.has(keep), `${keep} is no longer a registered page`)
  }
})

/**
 * A redirect deletes a screen from the student's reach, so it may only point
 * at a space that genuinely rebuilt what it absorbed. Settings failed that
 * test once: Profile had the username, the studies and the privacy switches
 * but NOT cloud backup, device transfer, the passcode, the privacy inventory,
 * telemetry, email change or developer mode. All six were MOVED into Profile,
 * so the redirect is now safe and Settings.tsx is gone.
 */
test('nothing a space did not rebuild is redirected away', () => {
  assert.equal(resolveSpace('settings'), 'profile')
  assert.equal(existsSync(join(ROOT, 'src', 'pages', 'Settings.tsx')), false, 'the old Settings screen is deleted')
  assert.equal(registered.has('settings'), false, "'settings' is no longer its own page")
  const profile = read('src', 'pages', 'Profile.tsx')
  for (const [what, needle] of [
    ['a backup file',       'TwinBackupModal'],
    ['moving to a new phone','DeviceTransferModal'],
    ['the passcode',        'ResetPasscode'],
    ['the privacy inventory','activeFlows'],
    ['the telemetry switch','setTelemetryEnabled'],
    ['changing your email', 'email-change/verify'],
    ['developer mode',      'looksLikeGroqKey'],
    ['cloud sync',          'reconcileWithCloud'],
    ['deleting the cloud copy', 'deleteCloudSnapshot'],
    ['demo data',           'seedDemo'],
    ['resetting the device','resetAllData'],
  ]) assert.ok(profile.includes(needle), `Profile is missing ${what} (${needle}) -- it was only on Settings`)
})

test('the hash router and navigate() both resolve old ids', () => {
  const fromHash = dashboard.slice(dashboard.indexOf('function routeFromHash'), dashboard.indexOf('export default function Dashboard'))
  assert.match(fromHash, /resolveRoute\(/, 'a pasted #/flashcards link must resolve, to a space AND a screen')
  assert.match(fromHash, /function announceView/, 'and the screen must be handed to the space')
  const nav = dashboard.slice(dashboard.indexOf('const navigate = useCallback'), dashboard.indexOf('const navigate = useCallback') + 600)
  assert.match(nav, /resolveRoute\(/, 'in-app buttons still using old ids must resolve')
  assert.match(nav, /announceView\(space, view\)/, 'and must open the right screen inside the space')
  assert.match(nav, /__kynoExamLock/, 'the mock lockout still guards the help routes')
})

test('the drawer is seven groups, one per space, and nothing is orphaned', () => {
  const block = drawer.slice(drawer.indexOf('const DRAWER_STUDENT'), drawer.indexOf('const DRAWER_TEACHER'))
  const titles = [...block.matchAll(/title: '([^']+)'/g)].map(m => m[1])
  assert.deepEqual(titles, SPACES.map(s => s.label))
  // A value re-exported through a barrel gets elided by the TS transform, and
  // the import then throws before React mounts -- the whole app renders blank
  // with only a console error. Values come from the core module directly.
  const barrel = read('src', 'lib', 'spaces.ts')
  assert.doesNotMatch(barrel, /^export \{ SPACE/m, 'do not re-export values through src/lib/spaces.ts')
  assert.match(dashboard, /from '\.\.\/lib\/spaces\.core'/, 'the Dashboard imports the router values directly')

  // every destination in the drawer is a real page and never a redirected id
  for (const m of block.matchAll(/to: '([a-z0-9-]+)'/g)) {
    assert.ok(registered.has(m[1]), `drawer points at ${m[1]}, which is not a page`)
    assert.equal(SPACE_ALIASES[m[1]], undefined, `drawer still lists ${m[1]}, which now redirects`)
  }
  // the old 32-item drawer is gone, not merely hidden
  assert.doesNotMatch(drawer, /DRAWER_STUDENT_LEGACY/)
  assert.doesNotMatch(sidebar, /STUDENT_NAV_LEGACY/)
})

test('"More" and the pre-cutover door are gone', () => {
  assert.doesNotMatch(drawer, />More</)
  assert.doesNotMatch(drawer, /onOpenMore/)
  assert.equal(existsSync(join(ROOT, 'src', 'pages', 'NewIndex.tsx')), false, 'the #/new index page is deleted')
  assert.equal(registered.has('new'), false, "'new' is no longer a route")
  for (const f of ['src/components/MobileShell.tsx', 'src/components/Sidebar.tsx']) {
    assert.equal(read(...f.split('/')).includes('New design (preview)'), false, `${f} still has the preview row`)
  }
  // the drawer is still reachable: the top bar opens it
  assert.match(drawer, /onOpenDrawer/)
})

test('the desktop sidebar leads with the seven spaces', () => {
  const block = sidebar.slice(sidebar.indexOf('const STUDENT_NAV'), sidebar.indexOf('const TEACHER_NAV'))
  const tos = [...block.matchAll(/to: '([a-z0-9-]+)'/g)].map(m => m[1])
  assert.deepEqual(tos.slice(0, 8), ['home', ...SPACES.map(s => s.id)])
  for (const t of tos) assert.equal(SPACE_ALIASES[t], undefined, `sidebar still lists ${t}, which now redirects`)
})

test('teacher, admin and parent navigation is untouched by the cutover', () => {
  for (const name of ['DRAWER_TEACHER', 'DRAWER_ADMIN']) assert.match(drawer, new RegExp(`const ${name} = \\[`))
  for (const name of ['TEACHER_NAV', 'ADMIN_NAV']) assert.match(sidebar, new RegExp(`const ${name}: NavItem\\[\\]`))
  assert.match(drawer, /case 'teacher': return DRAWER_TEACHER/)
  assert.match(drawer, /case 'admin':   return DRAWER_ADMIN/)
})

test('text inputs on the spaces are at least 16px, or iOS zooms the page on focus', () => {
  for (const f of ['DoubtSolving', 'Practice', 'Performance', 'Plan', 'Notes', 'Progress', 'Profile']) {
    const src = read('src', 'pages', `${f}.tsx`)
    const re = /<(input|textarea)\b/g
    let m
    while ((m = re.exec(src))) {
      const rest = src.slice(m.index, m.index + 1400)
      const end = rest.search(/\/>|<\/textarea>/)
      const block = end > 0 ? rest.slice(0, end) : rest.slice(0, 900)
      if (/type="file"|type='file'/.test(block)) continue
      const fs = block.match(/fontSize:\s*([\d.]+)/)
      if (fs) assert.ok(parseFloat(fs[1]) >= 16, `${f}.tsx: <${m[1]}> at offset ${m.index} has fontSize ${fs[1]}`)
    }
  }
})

test('hover styles live inside @media (hover: hover), and no space uses JS hover', () => {
  const css = read('src', 'index.css')
  const guard = css.indexOf('@media (hover: hover)')
  assert.match(css.slice(guard), /\.kyno-space-nav:hover/)
  assert.doesNotMatch(css.slice(0, guard), /kyno-space-nav:hover/)
  assert.doesNotMatch(read('src', 'components', 'SpaceFrame.tsx'), /onMouseEnter/)
})

test('the PWA shell is dark and named Kyno, in both places that define it', () => {
  const manifest = JSON.parse(read('public', 'manifest.webmanifest'))
  assert.equal(manifest.name, 'Kyno')
  assert.equal(manifest.theme_color, '#0B0B14')
  assert.equal(manifest.background_color, '#0B0B14')
  assert.match(read('index.html'), /<meta name="theme-color" content="#0B0B14"/)
  // Vercel builds with ENABLE_PWA=true, so VitePWA generates the manifest that actually ships
  const vite = read('vite.config.ts')
  assert.match(vite, /name:\s*'Kyno',/)
  assert.match(vite, /theme_color:\s*'#0B0B14'/)
  assert.match(vite, /background_color:\s*'#0B0B14'/)
  assert.equal(read('src', 'lib', 'pwa.ts').split('serviceWorker.register(').length - 1, 1)
})

test('no page imports the deleted index, and nothing still links to #/new', () => {
  const walk = dir => readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
  const offenders = []
  for (const f of walk(join(ROOT, 'src')).filter(f => /\.tsx?$/.test(f))) {
    const src = readFileSync(f, 'utf-8')
    if (/from '.*NewIndex'/.test(src)) offenders.push(`${f}: imports NewIndex`)
    if (/setActive\('new'\)|navigate\('new'\)|go\('new'\)/.test(src)) offenders.push(`${f}: navigates to 'new'`)
  }
  assert.deepEqual(offenders, [])
})

/**
 * The seven spaces are the STUDENT app. The cutover deliberately left teacher,
 * admin and parent navigation alone, so their routes must never be redirected
 * into a student space -- a teacher's Flashcards and Grader, and an admin's
 * Timetable, are their own tools and would otherwise disappear.
 */
test('redirects apply to students only, never to staff', () => {
  for (const id of ['flashcards', 'essay', 'timetable', 'quiz', 'settings', 'battle']) {
    for (const role of ['teacher', 'admin', 'parent']) {
      assert.deepEqual(resolveRoute(id, role), { space: id, view: null }, `${role} must keep #/${id}`)
    }
  }
  // a student still gets the space
  assert.equal(resolveSpace('flashcards', 'student'), 'practice')
  assert.equal(resolveSpace('flashcards'), 'practice', 'no role given behaves as before')
  // and the router passes the role through
  assert.match(dashboard, /resolveRoute\(raw, role\)/)
  assert.match(dashboard, /routeFromHash\(role\)/)
})
