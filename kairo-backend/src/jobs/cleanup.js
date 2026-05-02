/**
 * Cleanup Job — auto-delete expired notifications
 *
 * Runs every hour via node-cron.
 * Called from src/index.js → startCleanupJob()
 *
 * This is a belt-and-suspenders measure alongside the Supabase DB-level
 * `expires_at` filtering in the notifications routes. The pg_cron approach
 * (commented in schema.sql) is the preferred production solution when
 * Supabase pg_cron is enabled — this node-cron version works without it.
 */
import cron                              from 'node-cron'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'

// ── Run once on startup ────────────────────────────────────────────────────────
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
    console.error('[Cleanup] Unexpected error:', e.message)
  }
}

// ── Schedule: every hour at :00 ───────────────────────────────────────────────
export function startCleanupJob() {
  if (!SUPABASE_CONFIGURED) {
    console.log('[Cleanup] ⏭  Supabase not configured — cleanup job skipped.')
    return
  }

  // Run once immediately on startup to clear any stale rows
  deleteExpiredNotifications()

  // Then every hour
  cron.schedule('0 * * * *', () => {
    console.log('[Cleanup] ⏰ Hourly cleanup triggered')
    deleteExpiredNotifications()
  })

  console.log('[Cleanup] ✓ Hourly notification cleanup job scheduled')
}
