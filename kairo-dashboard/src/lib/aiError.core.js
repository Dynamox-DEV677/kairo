/**
 * One place that decides what a student sees when something breaks.
 *
 * Three rules, all of them learned from an outage that went unnoticed until a
 * user screenshotted it:
 *
 *  1. No student ever reads an HTTP status. "AI request failed. Last error:
 *     HTTP 401" is a debug string that happened to reach a 15-year-old.
 *
 *  2. Never invent a reassuring cause. The app told students "a lot of students
 *     are using it" for failures that had nothing to do with load — because
 *     friendlyError() mapped EVERY 5xx to a busy message. That is false to the
 *     student, and it masked the real fault from us for as long as it lasted.
 *     A busy message now requires an actual 429 or a timeout.
 *
 *  3. Say whose fault it is. "Something's broken on our side, not yours" costs
 *     nothing and stops a student re-typing their work believing they did it
 *     wrong.
 *
 * Screens must not write their own error strings. They render `.message` and,
 * if they want a retry button, honour `.retryable`.
 */

const SPECS = {
  AUTH_EXPIRED: {
    message: 'You were signed out. Sign in again and your work is still here.',
    retryable: false,
  },
  RATE_LIMITED: {
    // The ONLY message allowed to blame load, and only on a real 429.
    message: 'Kyno is busy right now — a lot of students are using it. Try again in a moment.',
    retryable: true,
    retryAfter: 20,
  },
  TIMEOUT: {
    message: 'That took too long to come back. Try again — it usually works second time.',
    retryable: true,
    retryAfter: 3,
  },
  OFFLINE: {
    message: 'Can’t reach Kyno — check your connection and try again.',
    retryable: true,
    retryAfter: 3,
  },
  SERVER_FAULT: {
    message: 'Something’s broken on our side, not yours. We’ve been alerted.',
    retryable: true,
    retryAfter: 30,
  },
  NOT_CONFIGURED: {
    message: 'This feature isn’t switched on yet. Nothing you did — we’re on it.',
    retryable: false,
  },
  BAD_RESPONSE: {
    message: 'Kyno’s answer came back unreadable. Try rephrasing, or run it again.',
    retryable: true,
    retryAfter: 1,
  },
  UNKNOWN: {
    message: 'Something went wrong. Try that again.',
    retryable: true,
    retryAfter: 3,
  },
}

export class AiError extends Error {
  /** @param {string} code @param {unknown} [cause] */
  constructor(code, cause) {
    const spec = SPECS[code] ?? SPECS.UNKNOWN
    super(spec.message)
    this.name = 'AiError'
    this.code = code
    this.retryable = spec.retryable
    this.retryAfter = spec.retryAfter
    this.cause = cause
  }

  /** Classify anything thrown by fetch, the proxy, or a parser. */
  static from(e) {
    if (e instanceof AiError) return e

    const status = e?.status ?? e?.response?.status
    const raw = String(e?.message ?? e ?? '')
    const low = raw.toLowerCase()

    if (status === 401 || status === 403 ||
        /\b(401|403)\b/.test(raw) ||
        /missing bearer|invalid or expired token|not authenticated|auth_unavailable/i.test(raw)) {
      return new AiError('AUTH_EXPIRED', e)
    }

    // Load. This is the only path to a "busy" message.
    if (status === 429 || /\b429\b/.test(raw) || /rate.?limit|too many requests/i.test(low)) {
      return new AiError('RATE_LIMITED', e)
    }

    if (e?.name === 'AbortError' ||
        /timeout|timed out|the operation was aborted|etimedout/i.test(low)) {
      return new AiError('TIMEOUT', e)
    }

    if (/failed to fetch|networkerror|network request failed|load failed|err_internet/i.test(low)) {
      return new AiError('OFFLINE', e)
    }

    if (/not configured|no live groq keys|groq_api_keys/i.test(low)) {
      return new AiError('NOT_CONFIGURED', e)
    }

    if (/empty response|unexpected token|returned 0 valid|unreadable|json/i.test(low)) {
      return new AiError('BAD_RESPONSE', e)
    }

    // A 5xx is a fault on our side. It is NOT load, and must not claim to be.
    if ((typeof status === 'number' && status >= 500) || /\b5\d\d\b/.test(raw)) {
      return new AiError('SERVER_FAULT', e)
    }

    return new AiError('UNKNOWN', e)
  }
}

/**
 * The student-safe sentence for anything thrown, with no leaked internals.
 *
 * Drop-in for the old friendlyError(), which returned `e.message` verbatim
 * whenever it did not recognise the shape — which is how raw statuses reached
 * the screen in the first place.
 */
export function studentMessage(e) {
  const mapped = AiError.from(e)

  // A recognised failure always uses the map's copy.
  if (mapped.code !== 'UNKNOWN') return mapped.message

  // An UNRECOGNISED message might still be a good one. Plenty of routes send
  // real, useful sentences ("You already have a deck with that name"), and
  // flattening those to "Something went wrong" would be a downgrade dressed up
  // as a fix. So keep it — but only if it cannot be leaking internals.
  const raw = String(e?.message ?? e ?? '').trim()
  return isSafeForStudents(raw) ? raw : mapped.message
}

/**
 * Would this string embarrass us on a student's screen?
 *
 * Deliberately strict, and it fails closed: anything unrecognised goes to the
 * map. A false negative costs a slightly generic sentence; a false positive
 * puts a stack trace in front of a 15-year-old.
 */
export function isSafeForStudents(raw) {
  if (!raw || raw.length < 8 || raw.length > 160) return false

  const banned = [
    /[1-5]\d\d/,                     // any HTTP-looking status
    /HTTP|status\s*code/i,
    /error:|exception|stack|trace/i,
    /undefined|null|NaN|\[object/i,
    /[{}<>\\]|\$\{|=>/,                  // code, templates, JSX
    /\/[a-z_]+\/[a-z_]+/,                // unix-ish paths
    /[A-Za-z]:\\/,                       // windows paths
    /ECONN|ENOTFOUND|ETIMEDOUT|EPERM|EACCES/i,
    /at\s+\w+\s*\(/,                   // stack frame
    /select |insert |relation |column |constraint/i,  // SQL
    /api[_-]?key|token|bearer|secret|password/i,
    /localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+/,
  ]
  if (banned.some(re => re.test(raw))) return false

  // Has to read like a sentence a person wrote, not a symbol someone threw.
  return /^[A-Z]/.test(raw) && /[a-z]/.test(raw) && /\s/.test(raw)
}

/**
 * A detail you can safely append to your own sentence.
 *
 * For domains that are not the AI - camera permissions, microphone, a clash the
 * server explains better than we can - where the surrounding copy is already
 * written and only the detail is untrusted. Returns the fallback rather than
 * anything that could leak.
 */
export function safeDetail(e, fallback) {
  const raw = String(e?.message ?? e ?? '').trim()
  return isSafeForStudents(raw) ? raw : fallback
}
