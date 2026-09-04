import { Router } from 'express'
import { sendPasscodeOtpEmail } from '../email/index.js'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

const _codes = new Map()
const TTL_MS = 10 * 60 * 1000

// Codes are keyed by email and only removed on success, so an abandoned
// request would sit in memory for the life of the warm instance.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of _codes) if (now > v.expires) _codes.delete(k)
}, 5 * 60 * 1000).unref?.()

function newCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

router.post('/email-change/request', async (req, res) => {
  const email = (req.body?.new_email || '').toString().trim().toLowerCase()
  const name  = (req.body?.name || '').toString().slice(0, 60)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }
  const code = newCode()
  _codes.set(email, { code, expires: Date.now() + TTL_MS })
  try {
    await sendPasscodeOtpEmail({ to: email, name, code, expiresInMinutes: 10 })
    res.json({ ok: true, sent: true })
  } catch (e) {
    console.error('[account] otp send failed:', e.message)
    res.status(502).json({ error: 'Could not send the code — email service unavailable.' })
  }
})

// SECURITY: this endpoint reassigns a login email, so it must be authenticated
// and it must act on the CALLER. It previously took `user_id` from the request
// body with no auth at all: an attacker could request a code to their own
// address, verify it, pass a victim's user_id, and take over that account.
router.post('/email-change/verify', requireSupabaseAuth, async (req, res) => {
  const email = (req.body?.new_email || '').toString().trim().toLowerCase()
  const code  = (req.body?.code || '').toString().trim()
  // Identity comes from the verified token only — never from the body.
  const userId = (req.user?.sub || req.user?.id || '').toString().trim()
  if (!userId) return res.status(401).json({ error: 'Could not identify your account — sign in again.' })

  const entry = _codes.get(email)
  if (!entry) return res.status(400).json({ error: 'No code requested for this email (or it expired) — request a new one.' })
  if (Date.now() > entry.expires) {
    _codes.delete(email)
    return res.status(400).json({ error: 'Code expired — request a new one.' })
  }
  if (entry.code !== code) return res.status(400).json({ error: 'Wrong code — check the 6 digits and try again.' })
  _codes.delete(email)

  let authUpdated = false
  if (SUPABASE_CONFIGURED && userId) {
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email, email_confirm: true,
      })
      authUpdated = !error
      if (error) console.warn('[account] auth email update:', error.message)
    } catch (e) {
      console.warn('[account] auth email update threw:', e.message)
    }
  }
  res.json({ ok: true, verified: true, authUpdated })
})

/* ── DPDP obligations: download everything, delete everything ─────────────
   Not features. Download returns every row the server holds about the caller
   as JSON (the client adds the on-device twin to it). Delete really deletes
   rows -- league, battle, snapshot, social, report rows and the account
   itself -- then removes the auth user. No soft flag anywhere. */

// Every table that can hold a row keyed by this student. Tables that are not
// set up on a given project are simply reported as skipped.
const USER_TABLES = [
  ['social_profiles', 'user_id'], ['league_scores', 'user_id'], ['battle_scores', 'user_id'],
  ['battle_queue', 'user_id'], ['twin_snapshots', 'user_id'], ['question_reports', 'user_id'],
  ['user_reports', 'reporter_id'], ['user_blocks', 'user_id'], ['user_blocks', 'blocked_id'],
  ['topic_mastery', 'user_id'], ['study_sessions', 'user_id'], ['exam_plans', 'user_id'],
  ['ai_memory', 'user_id'], ['concept_relations', 'user_id'], ['notes', 'user_id'],
  ['parent_marks', 'student_id'], ['notifications', 'user_id'],
]

router.get('/export', requireSupabaseAuth, async (req, res) => {
  const id = req.user.id
  const out = {
    exported_at: new Date().toISOString(),
    account: { id, name: req.user.name || null, role: req.user.role || null, school_id: req.user.school_id || null, avatar_url: req.user.avatar_url || null, email: req.supabaseUser?.email || null },
    tables: {},
  }
  if (!SUPABASE_CONFIGURED) return res.json({ ...out, offline: true })
  for (const [table, col] of USER_TABLES) {
    if (table === 'user_blocks' && col === 'blocked_id') continue   // who blocked you is not your data
    try {
      const { data, error } = await supabaseAdmin.from(table).select('*').eq(col, id)
      if (error) throw error
      out.tables[table] = data || []
    } catch (e) {
      out.tables[table] = { unavailable: true }
    }
  }
  try {
    const { data } = await supabaseAdmin.from('battle_matches').select('*').or(`p1.eq.${id},p2.eq.${id}`)
    // the opponent is a username at most; their id is not this student's data
    out.tables.battle_matches = (data || []).map(m => ({ ...m, p1: m.p1 === id ? id : null, p2: m.p2 === id ? id : null }))
  } catch { out.tables.battle_matches = { unavailable: true } }
  res.setHeader('Content-Disposition', 'attachment; filename="kyno-account-export.json"')
  res.json(out)
})

router.post('/delete', requireSupabaseAuth, async (req, res) => {
  if (String(req.body?.confirm || '') !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm.' })
  const id = req.user.id
  const results = {}
  if (SUPABASE_CONFIGURED) {
    for (const [table, col] of USER_TABLES) {
      try {
        const { error } = await supabaseAdmin.from(table).delete().eq(col, id)
        results[`${table}.${col}`] = error ? (/does not exist|schema cache/i.test(error.message) ? 'skipped' : 'error') : 'deleted'
        if (error && !/does not exist|schema cache/i.test(error.message)) console.warn('[account] delete', table, error.message)
      } catch { results[`${table}.${col}`] = 'skipped' }
    }
    // Battle records the OTHER player keeps stay intact but nameless: this
    // student's side is detached rather than the opponent's history erased.
    try {
      await supabaseAdmin.from('battle_matches').update({ p1: null }).eq('p1', id)
      await supabaseAdmin.from('battle_matches').update({ p2: null }).eq('p2', id)
      results.battle_matches = 'detached'
    } catch { results.battle_matches = 'skipped' }
    try {
      const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
      results.users = error ? 'error' : 'deleted'
      if (error) console.warn('[account] delete users row:', error.message)
    } catch { results.users = 'error' }
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
      results.auth = error ? 'error' : 'deleted'
      if (error) console.warn('[account] delete auth user:', error.message)
    } catch (e) { results.auth = 'error' }
  }
  res.json({ ok: true, results })
})

export default router
