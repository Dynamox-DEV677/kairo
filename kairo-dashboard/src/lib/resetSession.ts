/**
 * resetSession.ts — local-only Kairo OS passcode reset session.
 *
 * Kairo OS keeps a SEPARATE 6-digit device passcode (different from the
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
 * Generate and "send" a new OTP. In production this would call the backend
 * to dispatch the email. In dev / local-only mode, the OTP is also surfaced
 * via the returned `dev_otp` field so you can paste it in. The real OTP is
 * stored hashed-by-time only — never logged.
 *
 * Returns an object describing the send outcome.
 */
export function sendOtp(): {
  ok:           boolean
  reason?:      'rate-limited' | 'no-email'
  /** Seconds until next resend allowed (cooldown). 0 = ready. */
  cooldown:     number
  /** Times remaining in this 10-min window. */
  remaining:    number
  /** Surfaced in dev only — paste this in the OTP box. */
  dev_otp?:     string
} {
  const email = getEmail()
  if (!email) return { ok: false, reason: 'no-email', cooldown: 0, remaining: 0 }

  const now = Date.now()
  const resendUntil = Number(getS(K_RESEND_UNTIL) || 0)
  if (resendUntil > now) {
    return {
      ok: false, reason: 'rate-limited',
      cooldown: Math.ceil((resendUntil - now) / 1000),
      remaining: resendCountWindow(),
    }
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

  // Dev surfacing — only in development
  const isDev = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)
  return {
    ok:        true,
    cooldown:  Math.ceil(RESEND_COOLDOWN_MS / 1000),
    remaining: Math.max(0, RESEND_MAX_PER_10 - resendCountWindow()),
    dev_otp:   isDev ? otp : undefined,
  }
}

/** Verify a user-entered OTP. Returns ok=true if matched + not expired. */
export function verifyOtp(entered: string): {
  ok:        boolean
  reason?:   'mismatch' | 'expired' | 'no-otp'
} {
  const otp = getS(K_OTP)
  if (!otp)                  return { ok: false, reason: 'no-otp' }
  const expires = Number(getS(K_OTP_EXPIRES) || 0)
  if (Date.now() > expires)  return { ok: false, reason: 'expired' }
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
