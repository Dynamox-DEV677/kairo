/**
 * Battles between two humans -- the server holds the match.
 *
 * The bank is built once from the formula sheet and the syllabus graph
 * (src/lib/arena.core.js). The server keeps the answers; a client only ever
 * receives questions and options. Scoring is server-side, so a fast client
 * cannot award itself points.
 *
 * Matching is random within a mastery band (±1), never by name, never with
 * anyone in a block pair with the caller, never with someone whose "Allow
 * battles" switch is off. Nobody waiting → the client offers a solo timed
 * round; a fake opponent is never invented here.
 *
 * DISCONNECT = VOID FOR BOTH. Every poll is a heartbeat; an opponent silent
 * for ROUND.opponentTimeoutMs voids the round. Indian mobile data drops
 * constantly, and punishing that teaches a student the app is unfair.
 *
 * No AI anywhere in this file.
 */
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'
import { loadGraph } from '../../src/lib/syllabusGraph.core.js'
import { ROUND, SUBJECTS, buildBank, pickQuestions, publicQuestion, scoreAnswer, subjectCounts } from '../../src/lib/arena.core.js'
import { ensureSocialProfile, profilesFor, blockedSet, isMissingTable } from './social.js'

const require = createRequire(import.meta.url)
let _bank = null, _byId = null
export function bank() {
  if (!_bank) {
    const formulas = require('../../src/data/formulas.cbse10.json').formulas
    const graph = loadGraph(require('../../src/data/syllabusGraph/cbse10.json'))
    _bank = buildBank(formulas, graph)
    _byId = new Map(_bank.map(q => [q.id, q]))
  }
  return _bank
}
export function questionById(id) { bank(); return _byId.get(id) || null }
export function subjects() { const c = subjectCounts(bank()); return SUBJECTS.map(name => ({ name, questions: c[name] || 0 })) }

const QUEUE_TTL_MS = 60_000
const ANY_BAND_AFTER_MS = 8_000
const MATCH_TTL_MS = 120_000
const iso = t => new Date(t).toISOString()
const MATCH_COLS = 'id, subject, question_ids, p1, p2, p1_score, p2_score, p1_answers, p2_answers, p1_seen, p2_seen, status, started_at, ended_at'

export { isMissingTable }

async function liveMatchFor(userId) {
  const { data, error } = await supabaseAdmin.from('battle_matches').select(MATCH_COLS)
    .or(`p1.eq.${userId},p2.eq.${userId}`).eq('status', 'live').gt('started_at', iso(Date.now() - MATCH_TTL_MS))
    .order('started_at', { ascending: false }).limit(1)
  if (error) throw error
  return data && data[0] ? data[0] : null
}

/** Join the queue, or find out whether it already paired you. Idempotent: poll it. */
export async function joinQueue(userId, subject, band) {
  if (!SUPABASE_CONFIGURED) return { offline: true }
  if (!SUBJECTS.includes(subject)) return { error: 'unknown subject' }
  const me = await ensureSocialProfile(userId)
  if (me.offline) return { offline: true }
  if (me.allow_battles === false) return { disabled: true }

  // Already paired while waiting? Then we are done here.
  const live = await liveMatchFor(userId)
  if (live) { await supabaseAdmin.from('battle_queue').delete().eq('user_id', userId); return { matchId: live.id } }

  const now = Date.now()
  await supabaseAdmin.from('battle_queue').delete().lt('since', iso(now - QUEUE_TTL_MS))
  const { data: myRow } = await supabaseAdmin.from('battle_queue').select('since').eq('user_id', userId).maybeSingle()
  const waitedMs = myRow ? Math.max(0, now - Date.parse(myRow.since)) : 0

  const blocked = await blockedSet(userId)
  const { data: waiting, error } = await supabaseAdmin.from('battle_queue').select('user_id, band, since')
    .eq('subject', subject).neq('user_id', userId).order('since', { ascending: true })
  if (error) throw error
  const candidates = (waiting || []).filter(w => !blocked.has(w.user_id) && (Math.abs((w.band || 2) - band) <= 1 || waitedMs >= ANY_BAND_AFTER_MS))
  const profiles = await profilesFor(candidates.map(w => w.user_id))
  for (const w of candidates) {
    if (profiles.get(w.user_id)?.allow_battles === false) continue
    // Claim atomically: whoever deletes the row owns the pairing.
    const { data: claimed } = await supabaseAdmin.from('battle_queue').delete().eq('user_id', w.user_id).select('user_id')
    if (!claimed || !claimed.length) continue
    await supabaseAdmin.from('battle_queue').delete().eq('user_id', userId)
    const id = randomUUID()
    const qs = pickQuestions(bank(), subject, id)
    const { error: insErr } = await supabaseAdmin.from('battle_matches').insert({ id, subject, question_ids: qs.map(q => q.id), p1: w.user_id, p2: userId })
    if (insErr) throw insErr
    return { matchId: id }
  }

  const { error: upErr } = await supabaseAdmin.from('battle_queue')
    .upsert({ user_id: userId, subject, band: Math.max(1, Math.min(3, band | 0)) || 2, since: myRow ? myRow.since : iso(now) }, { onConflict: 'user_id' })
  if (upErr) throw upErr
  return { waiting: true, waitedMs, giveUpAfterMs: ROUND.waitSeconds * 1000 }
}

export async function leaveQueue(userId) {
  if (!SUPABASE_CONFIGURED) return
  await supabaseAdmin.from('battle_queue').delete().eq('user_id', userId)
}

function side(m, userId) {
  const isP1 = m.p1 === userId
  return {
    isP1,
    mine: { answers: isP1 ? m.p1_answers : m.p2_answers, score: isP1 ? m.p1_score : m.p2_score, seenCol: isP1 ? 'p1_seen' : 'p2_seen', answersCol: isP1 ? 'p1_answers' : 'p2_answers', scoreCol: isP1 ? 'p1_score' : 'p2_score' },
    theirs: { id: isP1 ? m.p2 : m.p1, answers: isP1 ? m.p2_answers : m.p1_answers, score: isP1 ? m.p2_score : m.p1_score, seen: Date.parse(isP1 ? m.p2_seen : m.p1_seen) },
  }
}
const done = (answers, m) => (answers || []).length >= (m.question_ids || []).length

/** The match as this player may see it. Also this player's heartbeat. */
export async function getMatch(id, userId) {
  const { data: m, error } = await supabaseAdmin.from('battle_matches').select(MATCH_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!m || (m.p1 !== userId && m.p2 !== userId)) return null
  const { mine, theirs } = side(m, userId)
  const t = Date.now()
  const started = Date.parse(m.started_at), endsAt = started + ROUND.seconds * 1000
  let status = m.status
  const patch = { [mine.seenCol]: iso(t) }
  if (status === 'live') {
    if ((done(mine.answers, m) && done(theirs.answers, m)) || t > endsAt + ROUND.graceMs) { status = 'done'; patch.status = 'done'; patch.ended_at = iso(t) }
    else if (theirs.id && t - theirs.seen > ROUND.opponentTimeoutMs && !done(theirs.answers, m)) { status = 'void'; patch.status = 'void'; patch.ended_at = iso(t) }
  }
  await supabaseAdmin.from('battle_matches').update(patch).eq('id', id)
  const names = await profilesFor([userId, theirs.id].filter(Boolean))
  return {
    id: m.id, subject: m.subject, status, startedAt: started, endsAt, now: t,
    questions: (m.question_ids || []).map((qid, index) => ({ index, ...(publicQuestion(questionById(qid)) || { id: qid, text: 'This question is no longer in the bank.', options: [], subject: m.subject, kind: 'missing' }) })),
    me: { username: names.get(userId)?.username || 'you', score: mine.score || 0, answers: mine.answers || [] },
    opp: theirs.id
      ? { username: names.get(theirs.id)?.username || 'student', score: theirs.score || 0, answered: (theirs.answers || []).length, connected: t - theirs.seen <= ROUND.opponentTimeoutMs }
      : { username: null, score: theirs.score || 0, answered: (theirs.answers || []).length, connected: false },
  }
}

export async function answer(id, userId, index, choice, elapsedMs) {
  const { data: m, error } = await supabaseAdmin.from('battle_matches').select(MATCH_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!m || (m.p1 !== userId && m.p2 !== userId)) return { error: 'not your match', status: 404 }
  if (m.status !== 'live') return { error: 'this round is over', status: 409 }
  const { mine, theirs } = side(m, userId)
  const i = index | 0
  if (i < 0 || i >= (m.question_ids || []).length) return { error: 'no such question', status: 400 }
  if ((mine.answers || []).some(a => a.index === i)) return { error: 'already answered', status: 409 }
  const t = Date.now()
  if (t > Date.parse(m.started_at) + ROUND.seconds * 1000 + ROUND.graceMs) return { error: 'time is up', status: 409 }
  const q = questionById(m.question_ids[i])
  if (!q) return { error: 'question missing', status: 410 }
  const correct = q.answer === (choice | 0)
  const points = scoreAnswer(correct, Math.max(0, Number(elapsedMs) || 0))
  const answers = [...(mine.answers || []), { index: i, choice: choice | 0, correct, points, at: t }]
  const patch = { [mine.answersCol]: answers, [mine.scoreCol]: (mine.score || 0) + points, [mine.seenCol]: iso(t) }
  if (done(answers, m) && done(theirs.answers, m)) { patch.status = 'done'; patch.ended_at = iso(t) }
  const { error: upErr } = await supabaseAdmin.from('battle_matches').update(patch).eq('id', id)
  if (upErr) throw upErr
  return { correct, points, correctIndex: q.answer, score: (mine.score || 0) + points }
}

export async function stats(userId) {
  if (!SUPABASE_CONFIGURED) return { played: 0, won: 0, drawn: 0, offline: true }
  const { data, error } = await supabaseAdmin.from('battle_matches').select('p1, p2, p1_score, p2_score, status')
    .or(`p1.eq.${userId},p2.eq.${userId}`).eq('status', 'done').limit(2000)
  if (error) throw error
  let played = 0, won = 0, drawn = 0
  for (const m of data || []) {
    const mine = m.p1 === userId ? m.p1_score : m.p2_score, theirs = m.p1 === userId ? m.p2_score : m.p1_score
    played++
    if (mine > theirs) won++
    else if (mine === theirs) drawn++
  }
  return { played, won, drawn }
}
