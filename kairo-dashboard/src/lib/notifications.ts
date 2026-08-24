import { getRaw, setRaw } from './storage'
import { storedProfileRaw } from '../lib/storage'

export interface KynoNotification { id: string; text: string; icon: string; ts: number; read: boolean }

function nkey(): string {
  try {
    const p = JSON.parse(storedProfileRaw() || '{}')
    return 'kairo:notifs:' + (p.id || p.user_id || '_local')
  } catch { return 'kairo:notifs:_local' }
}

export function listNotifications(): KynoNotification[] {
  try { return JSON.parse(getRaw(nkey()) || '[]') as KynoNotification[] } catch { return [] }
}

export function unreadCount(): number {
  return listNotifications().filter(n => !n.read).length
}

/**
 * Notification kinds, kept separate so a student can silence one without
 * silencing the others.
 *
 * `study` is what they signed up for — a nudge about their own plan. `product`
 * is us talking about ourselves, so it defaults OFF: a 14-year-old should not
 * have to opt out of being marketed to inside a study app. `achievement` is
 * their own progress, which is the one kind that is always welcome.
 */
export type NotificationKind = 'study' | 'achievement' | 'product'

export interface NotificationPrefs {
  study: boolean
  achievement: boolean
  product: boolean
}

const PREFS_KEY = 'kyno:notifs:prefs'
const DEFAULT_PREFS: NotificationPrefs = { study: true, achievement: true, product: false }

export function getNotificationPrefs(): NotificationPrefs {
  try {
    const raw = getRaw(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch (e) {
    console.warn('[notifications] prefs unreadable, using defaults:', e)
    return { ...DEFAULT_PREFS }
  }
}

export function setNotificationPref(kind: NotificationKind, on: boolean): NotificationPrefs {
  const next = { ...getNotificationPrefs(), [kind]: on }
  try { setRaw(PREFS_KEY, JSON.stringify(next)) }
  catch (e) { console.warn('[notifications] could not save prefs:', e) }
  try { window.dispatchEvent(new Event('kairo:notif')) } catch { /* no window in tests */ }
  return next
}

export function addNotification(text: string, icon = '✨', kind: NotificationKind = 'study'): void {
  if (typeof window === 'undefined') return
  // The Settings toggle used to be pure component state — nothing persisted it
  // and nothing read it, so turning reminders off did nothing at all. This is
  // the read that makes it real.
  if (!getNotificationPrefs()[kind]) return
  const list = listNotifications()
  if (list[0] && list[0].text === text && Date.now() - list[0].ts < 60_000) return
  const n: KynoNotification = {
    id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text, icon, ts: Date.now(), read: false,
  }
  try { setRaw(nkey(), JSON.stringify([n, ...list].slice(0, 40))) } catch {  }
  try { window.dispatchEvent(new Event('kairo:notif')) } catch {  }
}

export function markAllRead(): void {
  try { setRaw(nkey(), JSON.stringify(listNotifications().map(n => ({ ...n, read: true })))) } catch {  }
  try { window.dispatchEvent(new Event('kairo:notif')) } catch {  }
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}
