/**
 * Onboarding diagnostic (audit task 10) — deterministic, well-formed, and
 * weak-subject-first, because these five answers seed every "weakness" panel.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickDiagnostic, DIAGNOSTIC_BANK, DIAGNOSTIC_SIZE } from '../../src/lib/diagnostic.core.js'

test('every bank question is well-formed', () => {
  for (const [subject, bank] of Object.entries(DIAGNOSTIC_BANK)) {
    for (const q of bank) {
      assert.equal(q.options.length, 4, `${subject}: 4 options`)
      assert.equal(new Set(q.options.map(o => o.toLowerCase())).size, 4, `${subject}: distinct options`)
      assert.ok(q.correctIndex >= 0 && q.correctIndex < 4)
      assert.ok(q.topic && q.q.length > 10)
    }
  }
})

test('DONE WHEN: declared-weak subjects lead the pick, deterministically', () => {
  const a = pickDiagnostic({ weak: ['Chemistry'] })
  const b = pickDiagnostic({ weak: ['Chemistry'] })
  assert.deepEqual(a, b, 'same inputs, same five questions')
  assert.equal(a.length, DIAGNOSTIC_SIZE)
  assert.equal(a[0].subject, 'Chemistry', 'weak subject asked first')
  // still a spread, not five chemistry questions
  assert.ok(new Set(a.map(q => q.subject)).size >= 3)
})

test('rotation keeps answers correct and not always option A', () => {
  const picked = pickDiagnostic({})
  for (const q of picked) {
    const original = DIAGNOSTIC_BANK[q.subject].find(o => o.q === q.q)
    assert.equal(q.options[q.correctIndex], original.options[original.correctIndex], 'rotated key still points at the true answer')
  }
  assert.ok(picked.some(q => q.correctIndex !== 0), 'not all correct answers sit at A')
})
