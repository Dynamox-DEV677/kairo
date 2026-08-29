/**
 * No component may put a raw error message on screen.
 *
 * This is how "AI request failed. Last error: HTTP 401" and "Server returned
 * 500" reached students: 94 call sites did `setErr(e.message)`, which renders
 * whatever the server, the proxy or fetch happened to throw.
 *
 * Everything now goes through studentMessage() (safe copy, and it keeps a
 * genuinely useful server sentence when there is one) or safeDetail() (for
 * non-AI domains where the surrounding sentence is already written).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..', 'src')

/** The sanctioned ways to turn a thrown value into something renderable. */
const SANCTIONED = /studentMessage|safeDetail|AiError|friendlyError/

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) yield p
  }
}

test('no screen renders a raw error message', () => {
  const offenders = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    // the mapper itself has to touch e.message — that is its job
    if (rel === 'lib/aiError.core.js') continue

    readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
      if (SANCTIONED.test(line)) return
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return

      // setErr(e.message) / setError(String(err)) and friends.
      //
      // The receiver has to look like a caught error. `setMsg(r.message)` where
      // r is a server RESPONSE is a success path — flagging that would push
      // people to route a "Credentials saved!" confirmation through an error
      // mapper, which is worse than the bug.
      const ERRISH = String.raw`(e|err|error|ex|reason|cause)\d?`
      const raw =
        new RegExp(String.raw`\bset(Err|Error|ErrorMsg|Msg)\s*\(\s*[^)]*\b${ERRISH}\??\.message`).test(line) ||
        new RegExp(String.raw`\bset(Err|Error|ErrorMsg|Msg)\s*\(\s*String\s*\(\s*${ERRISH}\b`).test(line)

      if (raw) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 92)}`)
    })
  }

  assert.deepEqual(offenders, [],
    'These put a raw thrown message into state, which renders it to the student. ' +
    'Use studentMessage(e), or safeDetail(e, fallback) when you are writing the ' +
    'sentence yourself:\n  ' + offenders.join('\n  '))
})

test('no user-facing string interpolates an HTTP status', () => {
  const offenders = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('*')) return

      // A thrown Error carrying the status is fine — AiError classifies on it
      // and the string never reaches a screen. What is not fine is baking the
      // status into copy that a student reads.
      if (/\bthrow\b|new Error\(/.test(line)) return

      if (/set(Err|Error|ErrorMsg|Msg)\s*\([^)]*(\$\{[^}]*status[^}]*\}|['"`]\s*\+\s*\w*\.?status)/.test(line)) {
        offenders.push(`${rel}:${i + 1}  ${t.slice(0, 92)}`)
      }
    })
  }

  assert.deepEqual(offenders, [],
    'These build a student-facing string containing an HTTP status:\n  ' + offenders.join('\n  '))
})
