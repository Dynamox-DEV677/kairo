/**
 * Local preview for Progress (space 6) -- dev only.
 *
 * Seeds a CBSE class 10 twin with touched chapters (some solid, some shaky),
 * reviewed cards falling due this week (so the fading lens has something to
 * say), a little XP and focus history. Simulates the league group, the arena
 * (matching after a few polls, an opponent that answers over time, answers
 * checked against the real bank) and the social profile. Rooms are pretend.
 *
 * Open http://localhost:3002/progress-preview.html (add ?full for breakpoints).
 */
import { createRoot } from 'react-dom/client'
import Progress from './pages/Progress'
import { PreviewFrame } from './preview-shared'
import { saveProfile, track, recordFlashcard, reviewFlashcard } from './lib/twin'
import { setJSON } from './lib/storage'
import { awardXP } from './lib/game'
import { loadGraph } from './lib/syllabusGraph.core'
import { buildBank, pickQuestions, scoreAnswer, ROUND } from './lib/arena.core'
import SHEET from './data/formulas.cbse10.json'
import GRAPH from './data/syllabusGraph/cbse10.json'

;(window as any).__kynoFakeRooms = true

const DAY = 86_400_000
if (!localStorage.getItem('kyno:progress-preview-seeded')) {
  saveProfile({ name: 'Preview', cls: '10', board: 'CBSE', mode: 'personal' } as any)
  // touched chapters: electricity solid-ish, light shaky, quadratic shaky, triangles solid
  const hits = (subject: string, topic: string, right: number, wrong: number) => {
    for (let i = 0; i < right; i++) track({ type: 'quiz_answered', subject, topic, correct: true, score: 100, modality: 'interactive', payload: { q: `${topic} ${i}` } } as any)
    for (let i = 0; i < wrong; i++) track({ type: 'quiz_answered', subject, topic, correct: false, score: 0, modality: 'interactive', payload: { q: `${topic} w${i}`, options: ['a', 'b'], correctIndex: 0, chosenIndex: 1 } } as any)
  }
  hits('Physics', 'electricity', 9, 1); hits('Physics', 'refraction', 3, 3); hits('Mathematics', 'quadratic equations', 4, 3); hits('Mathematics', 'triangles', 8, 1); hits('Chemistry', 'acids and bases', 2, 2)
  // reviewed cards due soon → the fading lens
  const due = (subject: string, topic: string, front: string, back: string) => {
    const c = recordFlashcard({ front, back, subject, topic, source: 'manual' })
    try { reviewFlashcard(c.id, 3) } catch { /* ok */ }
    return c.id
  }
  due('Physics', 'ohm\'s law', 'V = ?', 'I R')
  due('Mathematics', 'quadratic formula', 'x = ?', '[−b ± √(b² − 4ac)] / 2a')
  due('Physics', 'refraction', 'Snell\'s law?', 'sin i / sin r = constant')
  for (let i = 0; i < 6; i++) awardXP('card_retained')
  awardXP('session_done')
  localStorage.setItem('kyno:focus:history', JSON.stringify([{ ts: Date.now() - DAY, focusedMs: 40 * 60_000, plannedMs: 40 * 60_000, drifts: 0 }, { ts: Date.now() - 2 * DAY, focusedMs: 25 * 60_000, plannedMs: 25 * 60_000, drifts: 1 }]))
  setJSON('kyno:student_profile', { examDates: [{ name: 'Half-yearly', date: new Date(Date.now() + 12 * DAY).toISOString().slice(0, 10) }] })
  localStorage.setItem('kyno:progress-preview-seeded', '1')
}

// Force a few reviewed cards to fall due this week: the FSRS scheduler set them weeks out.
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('kyno:twin')) continue
    const st = JSON.parse(localStorage.getItem(key) || 'null')
    if (!st || !Array.isArray(st.flashcards)) continue
    let i = 0
    for (const c of st.flashcards) { if (c.reviews >= 1 && i < 3) { c.dueAt = Date.now() + [2, 0, 5][i] * DAY; i++ } }
    localStorage.setItem(key, JSON.stringify(st))
  }
} catch { /* ignore */ }

/* ── mock server ─────────────────────────────────────────────────────────── */
const graph = loadGraph(GRAPH)
const bank = buildBank((SHEET as any).formulas, graph)
const me = { username: 'quietstorm42', show_in_leagues: true, allow_battles: true, join_rooms: true, username_changed_at: null }
const group = {
  week: '2026-08-31', band: 2, size: 9, small: false,
  rows: [['brightcomet7', 310], ['lunarpebble08', 260], ['steadyfalcon3', 240], ['quietstorm42', 190], ['coralrobin51', 150], ['jadeotter12', 120], ['sunnymaple90', 80], ['onyxplanet44', 40], ['zestylotus5', 10]]
    .map(([u, xp]) => ({ username: u as string, xp: xp as number, you: u === 'quietstorm42' })),
}
let queuePolls = 0
let match: any = null
const real = window.fetch.bind(window)
window.fetch = (async (url: any, init?: any) => {
  const u = String(url)
  const body = () => { try { return JSON.parse(init?.body || '{}') } catch { return {} } }
  const json = (b: unknown, status = 200, ms = 250) => new Promise<Response>(res => setTimeout(() => res(new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })), ms))
  if (u.includes('/api/social/me')) return json(me)
  if (u.includes('/api/social/report')) return json({ ok: true })
  if (u.includes('/api/league/xp')) return json({ ok: true })
  if (u.includes('/api/league/group')) return json(group, 200, 500)
  if (u.includes('/api/arena/me')) return json({ played: 6, won: 4, drawn: 1 })
  if (u.includes('/api/arena/queue') && (init?.method || 'GET') === 'DELETE') { queuePolls = 0; return json({ ok: true }) }
  if (u.includes('/api/arena/queue')) {
    queuePolls++
    if (queuePolls < 3) return json({ waiting: true, waitedMs: queuePolls * 2000, giveUpAfterMs: 15000 })
    const subject = body().subject || 'Physics'
    const qs = pickQuestions(bank, subject, 'preview-' + Date.now())
    match = { id: 'm-preview', subject, question_ids: qs.map(q => q.id), qs, started: Date.now(), me: { score: 0, answers: [] as any[] }, opp: { score: 0, answered: 0, plan: qs.map((q, i) => ({ at: 3000 + i * 6500, correct: Math.random() < 0.7 })) }, status: 'live' }
    queuePolls = 0
    return json({ matchId: 'm-preview' })
  }
  if (u.includes('/api/arena/match/m-preview/answer')) {
    const { index, choice, elapsedMs } = body()
    const q = match.qs[index]
    const correct = q.answer === choice
    const points = scoreAnswer(correct, elapsedMs)
    match.me.answers.push({ index, choice, correct, points, at: Date.now() }); match.me.score += points
    return json({ correct, points, correctIndex: q.answer, score: match.me.score }, 200, 120)
  }
  if (u.includes('/api/arena/match/m-preview')) {
    const t = Date.now() - match.started
    const answered = match.opp.plan.filter((p: any) => p.at <= t).length
    match.opp.answered = answered
    match.opp.score = match.opp.plan.slice(0, answered).reduce((s: number, p: any) => s + (p.correct ? 12 : 0), 0)
    const done = (match.me.answers.length >= match.qs.length && answered >= match.qs.length) || t > ROUND.seconds * 1000 + ROUND.graceMs
    if (done) match.status = 'done'
    return json({
      id: 'm-preview', subject: match.subject, status: match.status, startedAt: match.started, endsAt: match.started + ROUND.seconds * 1000, now: Date.now(),
      questions: match.qs.map((q: any, index: number) => ({ index, id: q.id, subject: q.subject, kind: q.kind, text: q.text, options: q.options })),
      me: { username: me.username, score: match.me.score, answers: match.me.answers },
      opp: { username: 'steadyfalcon3', score: match.opp.score, answered, connected: true },
    }, 200, 120)
  }
  return real(url, init)
}) as typeof window.fetch

createRoot(document.getElementById('root')!).render(
  <PreviewFrame active="progress">
    <Progress onPractice={f => alert('Opens Practice filtered to:\n\n' + JSON.stringify(f))} onOpenProfile={() => alert('Opens Profile')} />
  </PreviewFrame>,
)
