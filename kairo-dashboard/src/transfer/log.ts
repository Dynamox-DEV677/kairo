// Tiny structured logger for the device-transfer subsystem. Kept separate so
// every module logs with the same prefix and we can silence it in one place.
// NOTE: transfer logging is LOCAL only — nothing here is ever sent anywhere.

type Level = 'debug' | 'info' | 'warn' | 'error'

let VERBOSE = false
export function setTransferVerbose(on: boolean) { VERBOSE = on }

function emit(level: Level, scope: string, msg: string, extra?: unknown) {
  if (level === 'debug' && !VERBOSE) return
  const tag = `[transfer:${scope}]`
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  if (extra !== undefined) fn(tag, msg, extra)
  else fn(tag, msg)
}

export function makeLog(scope: string) {
  return {
    debug: (m: string, e?: unknown) => emit('debug', scope, m, e),
    info:  (m: string, e?: unknown) => emit('info',  scope, m, e),
    warn:  (m: string, e?: unknown) => emit('warn',  scope, m, e),
    error: (m: string, e?: unknown) => emit('error', scope, m, e),
  }
}
