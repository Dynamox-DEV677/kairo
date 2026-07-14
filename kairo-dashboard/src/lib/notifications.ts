import { getRaw, setRaw } from './storage'

export interface KynoNotification { id: string; text: string; icon: string; ts: number; read: boolean }

function nkey(): string {
  try {
    const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
    return 'kairo:notifs:' + (p.id || p.user_id || '_local')
  } catch { return 'kairo:notifs:_local' }
}

export function listNotifications(): KynoNotification[] {
  try { return JSON.parse(getRaw(nkey()) || '[]') as KynoNotification[] } catch { return [] }
}

export function unreadCount(): number {
  return listNotifications().filter(n => !n.read).length
}

export function addNotification(text: string, icon = '✨'): void {
  if (typeof window === 'undefined') return
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
