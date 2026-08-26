/**
 * Model registry + per-key deadness.
 *
 * The bug this pins: a student saw "All AI models failed" because
 * gpt-oss-120b was 429 and llama-3.3-70b answered 404 "does not exist or you
 * do not have access to it". The pool holds keys from ~10 DIFFERENT Groq
 * accounts, so that 404 is a fact about ONE ACCOUNT, not about the model.
 * Blacklisting the model globally would disable it for the nine accounts
 * that can serve it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PRODUCTION_MODELS, isDeadModelError, markModelDead, isModelDead,
  isModelDeadForKey, liveModels, modelForKey, noteKeyUsed, keyId,
} from '../utils/models.js'

const KEY_A = 'gsk_aaaaaaaaaaaaaaaaaaaaaaAAAAAA'
const KEY_B = 'gsk_bbbbbbbbbbbbbbbbbbbbbbBBBBBB'
const KEY_C = 'gsk_ccccccccccccccccccccccCCCCCC'
const MODEL = 'llama-3.3-70b-versatile'

test('the chain is deep enough to survive two failures', () => {
  const all = [...PRODUCTION_MODELS.smart, ...PRODUCTION_MODELS.fast, ...PRODUCTION_MODELS.backstop]
  assert.ok(new Set(all).size >= 4, `only ${new Set(all).size} distinct models — one 429 + one 404 ends the day`)
  // the backstop must be a different capacity pool, not another llama
  assert.match(PRODUCTION_MODELS.backstop[0], /^groq\//)
})

test('recognises the "no access" family of upstream errors', () => {
  assert.equal(isDeadModelError(404, ''), true)
  assert.equal(isDeadModelError(400, 'model_not_found'), true)
  assert.equal(isDeadModelError(400, 'The model ... does not exist or you do not have access to it'), true)
  assert.equal(isDeadModelError(429, 'Rate limit reached'), false, 'a rate limit is NOT deadness')
  assert.equal(isDeadModelError(500, ''), false)
})

test('DONE WHEN: one account\'s 404 never disables the model for the others', () => {
  noteKeyUsed(KEY_A); noteKeyUsed(KEY_B); noteKeyUsed(KEY_C)
  markModelDead(MODEL, 'HTTP 404', KEY_A)

  assert.equal(isModelDeadForKey(MODEL, KEY_A), true)
  assert.equal(isModelDeadForKey(MODEL, KEY_B), false, 'other accounts unaffected')
  assert.equal(isModelDead(MODEL), false, 'NOT globally dead off one account')
  assert.ok(liveModels([MODEL, 'llama-3.1-8b-instant']).includes(MODEL), 'still offered to the pool')

  // key A should be steered to a model it has not refused
  assert.notEqual(modelForKey([MODEL, 'llama-3.1-8b-instant'], KEY_A), MODEL)
  assert.equal(modelForKey([MODEL, 'llama-3.1-8b-instant'], KEY_B), MODEL)
})

test('only when EVERY key has refused it does a model count as gone', () => {
  markModelDead(MODEL, 'HTTP 404', KEY_B)
  assert.equal(isModelDead(MODEL), false, 'one key still untested')
  markModelDead(MODEL, 'HTTP 404', KEY_C)
  assert.equal(isModelDead(MODEL), true, 'every known key refused it')
  // and even then the caller still gets something to try
  assert.deepEqual(liveModels([MODEL]), [MODEL], 'never returns an empty chain')
})

test('key identity is a fingerprint, never the key', () => {
  const id = keyId(KEY_A)
  assert.ok(id.length <= 6)
  assert.ok(!KEY_A.includes(id) || KEY_A.endsWith(id))
  assert.ok(!id.startsWith('gsk_'))
})
