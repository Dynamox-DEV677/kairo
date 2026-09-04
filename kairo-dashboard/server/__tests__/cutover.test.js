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
import { SPACE_META as SPACES, SPACE_IDS, SPACE_ALIASES, resolveSpace } from '../../src/lib/spaces.core.js'

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
  for (const [from, to] of Object.entries(SPACE_ALIASES)) {
    assert.ok(SPACE_IDS.has(to), `${from} redirects to ${to}, which is not a space`)
    assert.equal(resolveSpace(from), to)
    assert.equal(SPACE_ALIASES[to], undefined, `${to} is both a redirect target and a source`)
  }
  // the consolidations each brief promised
  for (const [from, to] of [
    ['flashcards', 'practice'], ['exam-hall', 'practice'], ['essay', 'practice'], ['quiz', 'practice'],
    ['mistakes', 'performance'], ['museum', 'performance'],
    ['goal', 'plan'], ['study-plan', 'plan'], ['exam-planner', 'plan'], ['focus', 'plan'], ['pomodoro', 'plan'],
    ['notebook', 'notes'], ['formula', 'notes'], ['listen', 'notes'], ['writing', 'notes'],
    ['battle', 'progress'], ['league', 'progress'], ['knowledge', 'progress'], ['concept-map', 'progress'], ['rooms', 'progress'],
    ['settings', 'profile'], ['camera', 'doubt-solving'], ['new', 'progress'],
  ]) assert.equal(resolveSpace(from), to, `#/${from} should land in ${to}`)
  // an id nobody redirected is left alone
  for (const keep of ['home', 'kairo-os', 'camera-live', 'reels', 'concept', 'bridge', 'stream', 'school']) {
    assert.equal(resolveSpace(keep), keep, `${keep} belongs to no space and must keep its own route`)
    assert.ok(registered.has(keep), `${keep} is no longer a registered page`)
  }
})

test('the hash router and navigate() both resolve old ids', () => {
  const fromHash = dashboard.slice(dashboard.indexOf('function pageFromHash'), dashboard.indexOf('export default function Dashboard'))
  assert.match(fromHash, /resolveSpace\(/, 'a pasted #/flashcards link must resolve')
  const nav = dashboard.slice(dashboard.indexOf('const navigate = useCallback'), dashboard.indexOf('const navigate = useCallback') + 600)
  assert.match(nav, /resolveSpace\(/, 'in-app buttons still using old ids must resolve')
  assert.match(nav, /__kynoExamLock/, 'the mock lockout still guards the help routes')
})

test('the drawer is seven groups, one per space, and nothing is orphaned', () => {
  const block = drawer.slice(drawer.indexOf('const DRAWER_STUDENT'), drawer.indexOf('const DRAWER_TEACHER'))
  const titles = [...block.matchAll(/title: '([^']+)'/g)].map(m => m[1])
  assert.deepEqual(titles, SPACES.map(s => s.label))
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
