/**
 * The Razorpay webhook signature check.
 *
 * Razorpay signs the exact bytes it sends. The old check signed
 * JSON.stringify(req.body) -- a re-serialisation -- so a genuine webhook whose
 * bytes differed from that (spacing, escaped characters) failed, and the school
 * that paid never activated. Pinned here: the check runs on the raw bytes,
 * compares in constant time, refuses anything malformed, and app.js hands the
 * route its raw bytes ahead of express.json().
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import http from 'node:http'
import express from 'express'
import { verifyRazorpaySignature } from '../lib/razorpay.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')
const SECRET = 'test_webhook_secret'
const sign = (bytes) => createHmac('sha256', SECRET).update(bytes).digest('hex')

// Valid JSON written the way many senders write it -- escaped slashes and a
// \u-escaped non-ASCII letter -- which JSON.stringify does not reproduce.
const RAW = Buffer.from(
  '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1","notes":{"school_id":"s1","school":"Vidy\\u0101laya","site":"https:\\/\\/example.in"}}}}}',
  'utf8',
)

test('a genuine signature over the raw bytes is accepted', () => {
  assert.equal(verifyRazorpaySignature(RAW, sign(RAW), SECRET), true)
  assert.equal(verifyRazorpaySignature(RAW, sign(RAW).toUpperCase(), SECRET), true)
})

test('the old re-serialised check would have rejected that same genuine webhook', () => {
  const reserialised = JSON.stringify(JSON.parse(RAW.toString('utf8')))
  assert.notEqual(reserialised, RAW.toString('utf8'))
  assert.notEqual(sign(Buffer.from(reserialised, 'utf8')), sign(RAW))
})

test('a changed body, a wrong secret or a malformed signature is refused', () => {
  const changed = Buffer.from(RAW.toString('utf8').replace('"s1"', '"s2"'), 'utf8')
  assert.equal(verifyRazorpaySignature(changed, sign(RAW), SECRET), false)
  assert.equal(verifyRazorpaySignature(RAW, sign(RAW), 'another_secret'), false)
  for (const bad of ['', 'abc', sign(RAW).slice(0, 63), sign(RAW) + '00', 'z'.repeat(64), undefined, null, 42]) {
    assert.equal(verifyRazorpaySignature(RAW, bad, SECRET), false, `signature ${String(bad)}`)
  }
  assert.equal(verifyRazorpaySignature(RAW.toString('utf8'), sign(RAW), SECRET), false, 'a string is not the raw bytes')
  assert.equal(verifyRazorpaySignature(RAW, sign(RAW), ''), false, 'no secret, no pass')
})

test('raw-before-json hands the webhook a Buffer and still parses JSON everywhere else', async () => {
  const app = express()
  app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }))
  app.use(express.json({ limit: '10mb' }))
  app.post('/api/payments/webhook', (req, res) => res.json({
    raw: Buffer.isBuffer(req.body),
    verified: verifyRazorpaySignature(req.body, req.headers['x-razorpay-signature'], SECRET),
  }))
  app.post('/api/other', (req, res) => res.json({ raw: Buffer.isBuffer(req.body), body: req.body }))

  const server = http.createServer(app)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const hook = await fetch(`${base}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': sign(RAW) },
      body: RAW,
    })
    assert.deepEqual(await hook.json(), { raw: true, verified: true })

    const other = await fetch(`${base}/api/other`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a": 1}',
    })
    assert.deepEqual(await other.json(), { raw: false, body: { a: 1 } })
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

test('app.js mounts the raw parser for the webhook before express.json, and the route no longer re-serialises', () => {
  const app = read('server', 'app.js')
  const raw  = app.indexOf("app.use('/api/payments/webhook', express.raw(")
  const json = app.indexOf('app.use(express.json(')
  assert.ok(raw > -1, 'the express.raw mount for the webhook is missing')
  assert.ok(raw < json, 'express.raw must come before express.json, or the bytes are already parsed')

  const payments = read('server', 'routes', 'payments.js')
  assert.doesNotMatch(payments, /JSON\.stringify\(req\.body\)/)
  assert.match(payments, /verifyRazorpaySignature\(req\.body,/)
})
