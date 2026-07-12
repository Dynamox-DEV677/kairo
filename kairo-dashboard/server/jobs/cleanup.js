import cron from 'node-cron'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'

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
    if (!e.message?.includes('does not exist')) {
      console.error('[Cleanup] Unexpected error (login_logs):', e.message)
    }
  }
}

async function runAllCleanup() {
  await deleteExpiredNotifications()
  await deleteOldLoginLogs()
}

export function startCleanupJob() {
  if (!SUPABASE_CONFIGURED) {
    console.log('[Cleanup] ⏭  Supabase not configured — cleanup job skipped.')
    return
  }

  runAllCleanup()

  cron.schedule('0 * * * *', () => {
    console.log('[Cleanup] ⏰ Hourly cleanup triggered')
    runAllCleanup()
  })

  console.log('[Cleanup] ✓ Hourly cleanup job scheduled (notifications + login_logs)')
}
