/**
 * What the public /status page can honestly say, from /api/ops/health.
 *
 * The page was written against /api/ops/status - user counts, schools, error
 * log, deploy info. That endpoint was locked to operators (it leaked exactly
 * that), the page was pointed at the public health probe instead, and nobody
 * changed what it read: `snap.deploy.region` on a payload with no `deploy`
 * crashed it to a blank screen in production.
 *
 * The public probe answers { ok, ts, ai: { windowMinutes, calls, failures,
 * failRate, p50ms, p95ms, pool } }. This turns that, plus the round trip the
 * browser measured, into service rows and an overall verdict. Nothing it
 * shows is about a user.
 */

/** "10/10 keys live, 0 in cooldown" -> { live: 10, total: 10 } */
export function parsePool(pool) {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(String(pool || ''))
  return m ? { live: Number(m[1]), total: Number(m[2]) } : null
}

const SLOW_ROUND_TRIP_MS = 1500
const SLOW_AI_P95_MS = 8000
const BAD_FAIL_RATE = 0.25
const MIN_CALLS_FOR_RATE = 5

export function readHealth(payload, roundTripMs) {
  const ai = payload && typeof payload === 'object' ? payload.ai || null : null
  const up = !!(payload && payload.ok === true)

  const api = {
    id: 'api',
    label: 'Kyno server',
    body: up ? `Answered in ${Math.round(roundTripMs)} ms` : 'Not answering',
    health: !up ? 'down' : roundTripMs >= SLOW_ROUND_TRIP_MS ? 'degraded' : 'ok',
  }

  const pool = parsePool(ai?.pool)
  const calls = Number(ai?.calls) || 0
  const failures = Number(ai?.failures) || 0
  const rate = calls > 0 ? failures / calls : null
  const p95 = Number.isFinite(ai?.p95ms) ? ai.p95ms : null

  let aiHealth = 'ok'
  if (!ai || (pool && pool.live === 0)) aiHealth = 'down'
  else if ((rate != null && calls >= MIN_CALLS_FOR_RATE && rate > BAD_FAIL_RATE) || (p95 != null && p95 > SLOW_AI_P95_MS)) aiHealth = 'degraded'

  const minutes = Number(ai?.windowMinutes) || 60
  const aiBody = !ai
    ? 'No AI health reported'
    : [
        pool ? `${pool.live} of ${pool.total} AI keys working` : null,
        calls > 0
          ? `${failures} of ${calls} requests failed in the last ${minutes} min`
          : `no AI requests in the last ${minutes} min on this server`,
      ].filter(Boolean).join(' · ')

  const services = [api, { id: 'ai', label: 'AI tutor', body: aiBody, health: aiHealth }]
  const overall = services.some(s => s.health === 'down') ? 'down'
    : services.some(s => s.health === 'degraded') ? 'degraded' : 'ok'

  return {
    services,
    overall,
    stats: { calls, failRate: rate, p95ms: p95 },
    checkedAt: Number(payload?.ts) || Date.now(),
  }
}
