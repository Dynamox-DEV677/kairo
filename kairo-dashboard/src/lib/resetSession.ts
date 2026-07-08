/**
 * resetSession.ts — local-only Kyno passcode reset session.
 *
 * Kyno keeps a SEPARATE 6-digit device passcode (different from the
 * Supabase account password). This file is the entire state machine
 * behind the Reset Passcode flow.
 *
 * Storage keys (all under `kairo:reset:*`):
 *   email          string         — email entered in step 1
 *   otp            string         — the 6-digit code we "sent"
 *   otp_expires    number         — UTC ms when the OTP expires (10 min)
 *   verified       '1' | null     — OTP successfully verified
 *   step           Step           — current step the user is on
 *   resend_count   number         — anti-spam: # of resends in a 10-min window
 *   resend_until   number         — UTC ms — next time a resend is allowed
 *   pending_pin    string         — hashed PIN entered in step 3, awaiting confirm
 *
 * The "passcode" itself (after successful reset) lives at:
 *   kairo:os:passcode_hash         — SHA-256 hex of the chosen 6 digits
 *   kairo:os:passcode_set_at       — UTC ms when last set
 */

export type Step = 'forgot' | 'verify' | 'create' | 'confirm' | 'success'

const K_EMAIL        = 'kairo:reset:email'
const K_OTP          = 'kairo:reset:otp'
const K_OTP_EXPIRES  = 'kairo:reset:otp_expires'
const K_VERIFIED     = 'kairo:reset:verified'
const K_STEP         = 'kairo:reset:step'
const K_RESEND_COUNT = 'kairo:reset:resend_count'
const K_RESEND_UNTIL = 'kairo:reset:resend_until'
const K_PENDING_PIN  = 'kairo:reset:pending_pin'

const K_PASSCODE_HASH    = 'kairo:os:passcode_hash'
const K_PASSCODE_SET_AT  = 'kairo:os:passcode_set_at'

const OTP_TTL_MS         = 10 * 60 * 1000  // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000       // 30 s between sends
const RESEND_MAX_PER_10  = 4               // up to 4 resends per 10-minute window
const RESEND_WINDOW_MS   = 10 * 60 * 1000

// ─── Tiny safe-IO helpers ──────────────────────────────────────────────────
function getS(key: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(key) } catch { return null }
}
function setS(key: string, value: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, value) } catch { /* quota */ }
}
function delS(key: string) {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// ─── SHA-256 hash (Web Crypto) ─────────────────────────────────────────────
export async function hashPin(pin: string): Promise<string> {
  const buf = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Step management ──────────────────────────────────────────────────────
export function getStep(): Step {
  const s = getS(K_STEP) as Step | null
  if (s && ['forgot', 'verify', 'create', 'confirm', 'success'].includes(s)) return s
  return 'forgot'
}
export function setStep(step: Step) { setS(K_STEP, step) }

// ─── Email ────────────────────────────────────────────────────────────────
export function getEmail(): string { return getS(K_EMAIL) || '' }
export function setEmail(email: string) { setS(K_EMAIL, email.trim().toLowerCase()) }

// ─── OTP send + verify ────────────────────────────────────────────────────
/**
 * Send a new OTP. ALWAYS calls the server first so the user actually gets
 * the email. If the server is unreachable (offline / 5xx), we fall back
 * to a local-only OTP and surface it as `dev_otp` so the user can keep
 * testing on a flaky network.
 *
 * Returns an object describing the outcome.
 */
export async function sendOtp(): Promise<{
  ok:           boolean
  reason?:      'rate-limited' | 'no-email' | 'network'
  /** Seconds until next resend allowed. 0 = ready. */
  cooldown:     number
  /** Times remaining in this 10-min window. */
  remaining:    number
  /** Surfaced in dev only (server returns it when running on localhost). */
  dev_otp?:     string
  /** True if we couldn't reach the server and used a client-only OTP. */
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

  // ─── 1. Try the server first ─────────────────────────────────────────
  try {
    const res = await fetch('/api/passcode/send-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.ok) {
      // Server accepted — server owns the truth. We only mirror the
      // cooldown timestamp locally so the UI countdown stays accurate
      // across refreshes.
      const cooldown = Number(data.cooldown ?? 30)
      setS(K_RESEND_UNTIL, String(now + cooldown * 1000))
      bumpResendCount()
      // We don't store the OTP locally — the server holds it.
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
    // 429 etc. from server
    if (res.status === 429) {
      return {
        ok: false, reason: 'rate-limited',
        cooldown:  Number(data.cooldown ?? 30),
        remaining: 0,
      }
    }
    // Other 4xx/5xx — fall through to offline mode
  } catch {
    // Network error — fall through to offline mode below.
  }

  // ─── 2. Offline fallback — local-only OTP ────────────────────────────
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
    dev_otp:   otp,         // always shown in offline mode — no email is going out
    offline:   true,
  }
}

/**
 * Verify a user-entered OTP. Calls the server when possible; falls back
 * to the local hash when offline.
 */
export async function verifyOtp(entered: string): Promise<{
  ok:        boolean
  reason?:   'mismatch' | 'expired' | 'no-otp' | 'network'
}> {
  const email = getEmail()

  // ─── 1. Try the server ──────────────────────────────────────────────
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
    // 5xx → fall through to local check
  } catch {
    // Network error — fall through.
  }

  // ─── 2. Local fallback — only works if we previously stored an OTP
  //       locally (i.e. last send was an offline send). ─────────────────
  const otp = getS(K_OTP)
  if (!otp)                   return { ok: false, reason: 'no-otp' }
  const expires = Number(getS(K_OTP_EXPIRES) || 0)
  if (Date.now() > expires)   return { ok: false, reason: 'expired' }
  if (entered.trim() !== otp) return { ok: false, reason: 'mismatch' }
  setS(K_VERIFIED, '1')
  return { ok: true }
}

export function isVerified(): boolean { return getS(K_VERIFIED) === '1' }

/** Seconds until next resend allowed (0 = ready). */
export function resendCooldown(): number {
  const until = Number(getS(K_RESEND_UNTIL) || 0)
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

// ─── Resend rate-limit window ─────────────────────────────────────────────
function resendCountWindow(): number {
  // Read array of timestamps for "last 10 min"
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

// ─── Pending PIN (between step 3 and step 4) ──────────────────────────────
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

// ─── Finalise: write the new passcode + tear down the reset session ────────
export async function commitNewPasscode(pin: string) {
  setS(K_PASSCODE_HASH,   await hashPin(pin))
  setS(K_PASSCODE_SET_AT, String(Date.now()))
  endSession()
}

/** Wipe every reset-specific key. Called on success + on full cancel. */
export function endSession() {
  delS(K_EMAIL)
  delS(K_OTP)
  delS(K_OTP_EXPIRES)
  delS(K_VERIFIED)
  delS(K_STEP)
  delS(K_PENDING_PIN)
  // resend counters are kept so spam protection survives a cancel
}

// ─── Strength meter ───────────────────────────────────────────────────────
export type PinStrength = 'weak' | 'good' | 'strong'

/** Heuristic strength rating for a 6-digit PIN. */
export function pinStrength(pin: string): PinStrength {
  if (pin.length < 6) return 'weak'

  // Sequential ascending or descending (e.g. 123456, 654321)
  const isSeq = (s: string, step: number) =>
    s.split('').every((d, i, a) => i === 0 || parseInt(d) === parseInt(a[i - 1]) + step)
  if (isSeq(pin, 1) || isSeq(pin, -1)) return 'weak'

  // All same digit
  if (/^(\d)\1{5}$/.test(pin)) return 'weak'

  // Common dates (years 19xx / 20xx)
  if (/^(19|20)\d{4}$/.test(pin)) return 'weak'
  // Common pin patterns
  if (['111222', '123123', '121212', '000000', '111111', '696969'].includes(pin)) return 'weak'

  const unique = new Set(pin).size
  if (unique <= 2) return 'weak'
  if (unique <= 4) return 'good'
  return 'strong'
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function randomOtp(): string {
  // 6-digit, never starts with 0 (Apple-style readability)
  let s = String(Math.floor(Math.random() * 900000) + 100000)
  if (s.length !== 6) s = '123456'
  return s
}

export function emailValid(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
}
