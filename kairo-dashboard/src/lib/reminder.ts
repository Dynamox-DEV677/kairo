/**
 * The daily study reminder -- honest version.
 *
 * A web app cannot ping a closed phone without a push server, and Kyno has
 * none. So this fires while Kyno is OPEN: at the chosen minute it adds an
 * in-app notification and, if the student allowed it, a system one. Once a
 * day, by wall clock, so a backgrounded tab that wakes up late still fires.
 */
import { getRaw, setRaw, removeRaw } from './storage'
import { addNotification } from './notifications'

const KEY = 'kyno:reminder:time'
const FIRED = 'kyno:reminder:fired'
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function getReminderTime(): string | null {
  const t = getRaw(KEY)
  return t && /^\d\d:\d\d$/.test(t) ? t : null
}

export function setReminderTime(t: string | null): void {
  if (t && /^\d\d:\d\d$/.test(t)) setRaw(KEY, t)
  else removeRaw(KEY)
}

/** Ask once, from a tap. Returns whether system notifications are allowed. */
export async function askNotificationPermission(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    return (await Notification.requestPermission()) === 'granted'
  } catch { return false }
}

function due(now = new Date()): boolean {
  const t = getReminderTime()
  if (!t) return false
  const [h, m] = t.split(':').map(Number)
  const target = new Date(now); target.setHours(h, m, 0, 0)
  // due once the minute has passed today, and not yet fired today
  return now.getTime() >= target.getTime() && getRaw(FIRED) !== ymd(now)
}

/** Start the once-a-minute check. Returns the stop function. */
export function startReminderClock(): () => void {
  const tick = () => {
    try {
      if (!due()) return
      setRaw(FIRED, ymd())
      addNotification('Study time — your plan is waiting.', '⏰', 'study')
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('Kyno', { body: 'Study time — your plan is waiting.' }) } catch { /* not allowed here */ }
      }
    } catch { /* never let a reminder break the app */ }
  }
  tick()
  const id = setInterval(tick, 30_000)
  return () => clearInterval(id)
}
