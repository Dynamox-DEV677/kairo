/**
 * Nothing secret in the public bundle.
 *
 * src/config/flags.ts read import.meta.env[`VITE_FLAG_${name}`]. Vite cannot
 * resolve a computed key at build time, so it inlined the entire env object -
 * every VITE_ variable on the Vercel project - into game-*.js. One of them was
 * a live OpenRouter key that no code even used. Found by grepping the deployed
 * JavaScript on 2026-10-20.
 *
 * These pin both halves: no computed or whole-object reads of import.meta.env
 * anywhere in the client, and no secret-shaped string in a built bundle.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')

function* files(dir, re) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name)
    if (f.isDirectory()) { if (f.name !== 'node_modules') yield* files(p, re) }
    else if (re.test(f.name)) yield p
  }
}

test('the client never reads import.meta.env by a computed key or as a whole object', () => {
  const offenders = []
  for (const p of files(join(ROOT, 'src'), /\.(ts|tsx|js|jsx)$/)) {
    // CRLF too: git on Windows checks these out with \r\n, and a trailing \r
    // stops `.*$` from matching, so comments stopped being recognised.
    readFileSync(p, 'utf-8').split(/\r?\n/).forEach((line, i) => {
      // Comments may quote the old pattern to explain it; only code counts.
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*(\/\*|\*).*$/, '')
      if (/import\.meta\.env\s*\[/.test(code) ||
          /\.\.\.\s*import\.meta\.env\b/.test(code) ||
          /Object\.(keys|values|entries|assign)\([^)]*import\.meta\.env\s*[,)]/.test(code) ||
          /=\s*import\.meta\.env\s*;?\s*$/.test(code)) {
        offenders.push(`${p.slice(ROOT.length + 1)}:${i + 1}`)
      }
    })
  }
  assert.deepEqual(offenders, [], 'each import.meta.env.VITE_X must be written out by name')
})

test('no secret-shaped string in a built bundle', { skip: !existsSync(join(ROOT, 'dist', 'assets')) && 'no build in dist/' }, () => {
  const SECRET = /sk-or-v1-[a-f0-9]{16,}|gsk_[A-Za-z0-9]{20,}|rzp_live_[A-Za-z0-9]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY/
  // Supabase keys are JWTs. The anon key is public by design; the service-role
  // key bypasses every RLS policy, so decode each token and look at its role.
  const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g
  const hits = []
  for (const p of files(join(ROOT, 'dist'), /\.(js|html|json|map)$/)) {
    const text = readFileSync(p, 'utf-8')
    if (SECRET.test(text)) hits.push(p.slice(ROOT.length + 1))
    for (const m of text.matchAll(JWT)) {
      try {
        const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf-8'))
        if (payload.role === 'service_role') hits.push(`${p.slice(ROOT.length + 1)} (service_role JWT)`)
      } catch { /* not a JWT after all */ }
    }
  }
  assert.deepEqual(hits, [])
})
