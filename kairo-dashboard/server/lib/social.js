/**
 * Social identity on the server: the username and the three switches.
 *
 * Every response that reaches ANOTHER student goes through here. Routes never
 * read `users.name`, `avatar_url`, `class_name` or an email for someone else;
 * they ask this module for usernames and switches by id and get nothing else.
 *
 * Degrades honestly: before server/db/2026-09-04_social.sql has been run the
 * table is missing, so every account gets a deterministic `student_xxxxxx`
 * placeholder -- never a real name -- and the switches read as their defaults
 * (rooms OFF). Nothing throws, nothing leaks.
 */
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'
import { generateUsername, fallbackHandle, normaliseUsername } from '../../src/lib/username.core.js'

export const DEFAULT_SWITCHES = { show_in_leagues: true, allow_battles: true, join_rooms: false }
const COLS = 'user_id, username, show_in_leagues, allow_battles, join_rooms, username_changed_at'
const CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000

export function isMissingTable(err) {
  const m = String(err?.message || err || '').toLowerCase()
  return m.includes('does not exist') || m.includes('schema cache')
}

const placeholder = (userId) => ({ user_id: userId, username: fallbackHandle(userId), ...DEFAULT_SWITCHES, username_changed_at: null, offline: true })

/** The caller's own profile, created with a generated handle on first sight. */
export async function ensureSocialProfile(userId) {
  if (!SUPABASE_CONFIGURED || !userId) return placeholder(userId)
  try {
    const { data, error } = await supabaseAdmin.from('social_profiles').select(COLS).eq('user_id', userId).maybeSingle()
    if (error) throw error
    if (data) return data
    for (let i = 0; i < 14; i++) {
      const username = i < 12 ? generateUsername() : fallbackHandle(userId, i)
      const { data: row, error: insErr } = await supabaseAdmin.from('social_profiles').insert({ user_id: userId, username }).select(COLS).single()
      if (!insErr) return row
      if (insErr.code !== '23505') throw insErr
      // unique violation: either the handle is taken (try another) or a
      // parallel request already created this account's row (return it)
      const { data: again } = await supabaseAdmin.from('social_profiles').select(COLS).eq('user_id', userId).maybeSingle()
      if (again) return again
    }
    throw new Error('could not allocate a username')
  } catch (e) {
    if (isMissingTable(e)) return placeholder(userId)
    throw e
  }
}

/** Profiles for a set of ids -- creating handles for accounts that have none yet. */
export async function profilesFor(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  const out = new Map()
  if (!ids.length) return out
  if (!SUPABASE_CONFIGURED) { for (const id of ids) out.set(id, placeholder(id)); return out }
  try {
    const { data, error } = await supabaseAdmin.from('social_profiles').select(COLS).in('user_id', ids)
    if (error) throw error
    for (const row of data || []) out.set(row.user_id, row)
    const missing = ids.filter(id => !out.has(id))
    // Bounded: a board asks for a few dozen ids at most, and this only runs
    // for accounts the backfill has not reached.
    for (const id of missing.slice(0, 40)) {
      try { out.set(id, await ensureSocialProfile(id)) } catch { out.set(id, placeholder(id)) }
    }
    for (const id of missing.slice(40)) out.set(id, placeholder(id))
    return out
  } catch (e) {
    if (isMissingTable(e)) { for (const id of ids) out.set(id, placeholder(id)); return out }
    throw e
  }
}

export async function usernamesFor(userIds) {
  const profiles = await profilesFor(userIds)
  const out = new Map()
  for (const [id, p] of profiles) out.set(id, p.username)
  return out
}

/** Everyone this student has blocked, and everyone who has blocked them. */
export async function blockedSet(userId) {
  const out = new Set()
  if (!SUPABASE_CONFIGURED || !userId) return out
  try {
    const { data, error } = await supabaseAdmin.from('user_blocks').select('user_id, blocked_id').or(`user_id.eq.${userId},blocked_id.eq.${userId}`)
    if (error) throw error
    for (const r of data || []) out.add(r.user_id === userId ? r.blocked_id : r.user_id)
    return out
  } catch (e) {
    if (isMissingTable(e)) return out
    throw e
  }
}

export async function updateSwitches(userId, patch) {
  const current = await ensureSocialProfile(userId)
  if (current.offline) return current
  const clean = {}
  for (const k of ['show_in_leagues', 'allow_battles', 'join_rooms']) if (typeof patch?.[k] === 'boolean') clean[k] = patch[k]
  const { data, error } = await supabaseAdmin.from('social_profiles').update({ ...clean, updated_at: new Date().toISOString() }).eq('user_id', userId).select(COLS).single()
  if (error) throw error
  return data
}

/** @returns {{ profile } | { taken: true } | { tooSoon: true } | { offline: true }} */
export async function changeUsername(userId, username) {
  const current = await ensureSocialProfile(userId)
  if (current.offline) return { offline: true }
  const u = normaliseUsername(username)
  if (u === current.username) return { profile: current }
  if (current.username_changed_at && Date.now() - Date.parse(current.username_changed_at) < CHANGE_COOLDOWN_MS) return { tooSoon: true }
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('social_profiles')
    .update({ username: u, username_changed_at: now, updated_at: now }).eq('user_id', userId).select(COLS).single()
  if (error) {
    if (error.code === '23505') return { taken: true }
    throw error
  }
  return { profile: data }
}

/**
 * Report + block in one silent step. The reporter gets the same answer whether
 * or not the name exists, so the endpoint cannot be used to test usernames.
 * A block removes the pair from each other's matching pools for good.
 */
export async function reportUser(reporterId, username, context = '') {
  if (!SUPABASE_CONFIGURED || !reporterId) return
  const u = normaliseUsername(username)
  if (!u) return
  try {
    const { data: target } = await supabaseAdmin.from('social_profiles').select('user_id').eq('username', u).maybeSingle()
    if (!target || target.user_id === reporterId) return
    await supabaseAdmin.from('user_reports').insert({ reporter_id: reporterId, reported_id: target.user_id, context: String(context || '').slice(0, 40) || null })
    await supabaseAdmin.from('user_blocks').upsert({ user_id: reporterId, blocked_id: target.user_id }, { onConflict: 'user_id,blocked_id', ignoreDuplicates: true })
  } catch (e) {
    if (!isMissingTable(e)) throw e
  }
}
