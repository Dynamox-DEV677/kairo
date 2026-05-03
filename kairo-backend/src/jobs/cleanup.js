/**
 * Cleanup Job — periodic deletion of expired / stale records
 *
 * Tasks:
 *   1. Delete expired notifications (expires_at < NOW)
 *   2. Delete login_logs older than 90 days
 *
 * Runs every hour via node-cron (called from src/index.js → startCleanupJob).
 * The pg_cron approach (commented in schema files) is the preferred production
 * solution when Supabase pg_cron is enabled — this node-cron version works without it.
 */
import cron from 'node-cron'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'

// ── Delete expired notifications ───────────────────────────────────────────────
async function deleteExpiredNotifications() {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .lt('expires_at', now)
      .select('id')

    const count = data?.length ?? 0
    if (count > 0) {
      console.log(`[Cleanup] 🗑  Deleted ${count} expired notification(s)`)
    }
    if (error) {
      console.error('[Cleanup] Error deleting notifications:', error.message)
    }
  } catch (e) {
    console.error('[Cleanup] Unexpected error (notifications):', e.message)
  }
}

// ── Delete old login logs (90-day retention) ───────────────────────────────────
async function deleteOldLoginLogs() {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('login_logs')
      .delete()
      .lt('created_at', cutoff)
      .select('id')

    const count = data?.length ?? 0
    if (count > 0) {
      console.log(`[Cleanup] 🗑  Deleted ${count} old login log(s) (>90 days)`)
    }
    if (error) {
      console.error('[Cleanup] Error deleting login logs:', error.message)
    }
  } catch (e) {
    // login_logs table may not exist yet (migration pending) — don't crash
    if (!e.message?.includes('does not exist')) {
      console.error('[Cleanup] Unexpected error (login_logs):', e.message)
    }
  }
}

// ── Run all cleanup tasks ──────────────────────────────────────────────────────
async function runAllCleanup() {
  await deleteExpiredNotifications()
  await deleteOldLoginLogs()
}

// ── Schedule ───────────────────────────────────────────────────────────────────
export function startCleanupJob() {
  if (!SUPABASE_CONFIGURED) {
    console.log('[Cleanup] ⏭  Supabase not configured — cleanup job skipped.')
    return
  }

  // Run once immediately on startup to clear any stale rows
  runAllCleanup()

  // Then every hour at :00
  cron.schedule('0 * * * *', () => {
    console.log('[Cleanup] ⏰ Hourly cleanup triggered')
    runAllCleanup()
  })

  console.log('[Cleanup] ✓ Hourly cleanup job scheduled (notifications + login_logs)')
}
