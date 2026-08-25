
export type Step = 'forgot' | 'verify' | 'create' | 'confirm' | 'success'

const K_EMAIL        = 'kyno:reset:email'
const K_OTP          = 'kyno:reset:otp'
const K_OTP_EXPIRES  = 'kairo:reset:otp_expires'
const K_VERIFIED     = 'kairo:reset:verified'
const K_STEP         = 'kairo:reset:step'
const K_RESEND_COUNT = 'kairo:reset:resend_count'
const K_RESEND_UNTIL = 'kairo:reset:resend_until'
const K_PENDING_PIN  = 'kairo:reset:pending_pin'

const K_PASSCODE_HASH    = 'kairo:os:passcode_hash'
const K_PASSCODE_SET_AT  = 'kairo:os:passcode_set_at'

const OTP_TTL_MS         = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 30 * 1000
const RESEND_MAX_PER_10  = 4
const RESEND_WINDOW_MS   = 10 * 60 * 1000

function getS(key: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(key) } catch { return null }
}
function setS(key: string, value: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, value) } catch {  }
}
function delS(key: string) {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch {  }
}

export async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getStep(): Step {
  const s = getS(K_STEP) as Step | null
  if (s && ['forgot', 'verify', 'create', 'confirm', 'success'].includes(s)) return s
  return 'forgot'
}
export function setStep(step: Step) { setS(K_STEP, step) }

export function getEmail(): string { return getS(K_EMAIL) || '' }
export function setEmail(email: string) { setS(K_EMAIL, email.trim().toLowerCase()) }

export async function sendOtp(): Promise<{
  ok:           boolean
  reason?:      'rate-limited' | 'no-email' | 'network'
  cooldown:     number
  remaining:    number
  dev_otp?:     string
  offline?:     boolean
}> {
  const email = getEmail()
  if (!email) return { ok: false, reason: 'no-email', cooldown: 0, remaining: 0 }

  const now = Date.now()
  const localUntil = Number(getS(K_RESEND_UNTIL) || 0)
  if (localUntil > now) {
    return {
      ok: false, reason: 'rate-limited',
      cooldown: Math.ceil((localUntil - now) / 1000),
      remaining: resendCountWindow(),
    }
  }

  try {
    const res = await fetch('/api/passcode/send-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.ok) {
      const cooldown = Number(data.cooldown ?? 30)
      setS(K_RESEND_UNTIL, String(now + cooldown * 1000))
      bumpResendCount()
      delS(K_OTP)
      setS(K_OTP_EXPIRES, String(now + (Number(data.expires_in_sec ?? 600) * 1000)))
      delS(K_VERIFIED)
      return {
        ok:        true,
        cooldown,
        remaining: Number(data.remaining ?? 3),
        dev_otp:   data.dev_otp,
      }
    }
    if (res.status === 429) {
      return {
        ok: false, reason: 'rate-limited',
        cooldown:  Number(data.cooldown ?? 30),
        remaining: 0,
      }
    }
  } catch {
  }

  if (resendCountWindow() >= RESEND_MAX_PER_10) {
    return {
      ok: false, reason: 'rate-limited',
      cooldown: Math.ceil(RESEND_WINDOW_MS / 1000),
      remaining: 0,
    }
  }
  const otp = randomOtp()
  setS(K_OTP,          otp)
  setS(K_OTP_EXPIRES,  String(now + OTP_TTL_MS))
  setS(K_RESEND_UNTIL, String(now + RESEND_COOLDOWN_MS))
  bumpResendCount()
  delS(K_VERIFIED)
  return {
    ok:        true,
    cooldown:  Math.ceil(RESEND_COOLDOWN_MS / 1000),
    remaining: Math.max(0, RESEND_MAX_PER_10 - resendCountWindow()),
    dev_otp:   otp,
    offline:   true,
  }
}

export async function verifyOtp(entered: string): Promise<{
  ok:        boolean
  reason?:   'mismatch' | 'expired' | 'no-otp' | 'network'
}> {
  const email = getEmail()

  try {
    const res = await fetch('/api/passcode/verify-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, code: entered.trim() }),
    })
    if (res.ok) {
      setS(K_VERIFIED, '1')
      return { ok: true }
    }
    if (res.status === 400 || res.status === 401) {
      const data = await res.json().catch(() => ({}))
      const reason = (data?.reason as any) || 'mismatch'
      return { ok: false, reason }
    }
  } catch {
  }

  const otp = getS(K_OTP)
  if (!otp)                   return { ok: false, reason: 'no-otp' }
  const expires = Number(getS(K_OTP_EXPIRES) || 0)
  if (Date.now() > expires)   return { ok: false, reason: 'expired' }
  if (entered.trim() !== otp) return { ok: false, reason: 'mismatch' }
  setS(K_VERIFIED, '1')
  return { ok: true }
}

export function isVerified(): boolean { return getS(K_VERIFIED) === '1' }

export function resendCooldown(): number {
  const until = Number(getS(K_RESEND_UNTIL) || 0)
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

function resendCountWindow(): number {
  const raw = getS(K_RESEND_COUNT) || ''
  const all = raw.split(',').map(Number).filter(Boolean)
  const cutoff = Date.now() - RESEND_WINDOW_MS
  const recent = all.filter(t => t > cutoff)
  if (recent.length !== all.length) setS(K_RESEND_COUNT, recent.join(','))
  return recent.length
}
function bumpResendCount() {
  const cur = (getS(K_RESEND_COUNT) || '').split(',').filter(Boolean)
  cur.push(String(Date.now()))
  setS(K_RESEND_COUNT, cur.join(','))
}

export async function setPendingPin(pin: string) {
  setS(K_PENDING_PIN, await hashPin(pin))
}
export function getPendingPinHash(): string | null { return getS(K_PENDING_PIN) }
export async function confirmPin(pin: string): Promise<boolean> {
  const pending = getPendingPinHash()
  if (!pending) return false
  const h = await hashPin(pin)
  return h === pending
}

export async function commitNewPasscode(pin: string) {
  setS(K_PASSCODE_HASH,   await hashPin(pin))
  setS(K_PASSCODE_SET_AT, String(Date.now()))
  endSession()
}

export function endSession() {
  delS(K_EMAIL)
  delS(K_OTP)
  delS(K_OTP_EXPIRES)
  delS(K_VERIFIED)
  delS(K_STEP)
  delS(K_PENDING_PIN)
}

export type PinStrength = 'weak' | 'good' | 'strong'

export function pinStrength(pin: string): PinStrength {
  if (pin.length < 6) return 'weak'

  const isSeq = (s: string, step: number) =>
    s.split('').every((d, i, a) => i === 0 || parseInt(d) === parseInt(a[i - 1]) + step)
  if (isSeq(pin, 1) || isSeq(pin, -1)) return 'weak'

  if (/^(\d)\1{5}$/.test(pin)) return 'weak'

  if (/^(19|20)\d{4}$/.test(pin)) return 'weak'
  if (['111222', '123123', '121212', '000000', '111111', '696969'].includes(pin)) return 'weak'

  const unique = new Set(pin).size
  if (unique <= 2) return 'weak'
  if (unique <= 4) return 'good'
  return 'strong'
}

function randomOtp(): string {
  let s = String(Math.floor(Math.random() * 900000) + 100000)
  if (s.length !== 6) s = '123456'
  return s
}

export function emailValid(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
}
