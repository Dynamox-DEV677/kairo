/**
 * Phase 2. Every assertion here is a string taken from the live event log.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalTopic, normalizeTopicText, classifyChatTurn,
  formulaSignature, isSameFormula, findRecentDuplicate, sameText,
  DEDUPE_WINDOW_MS,
} from '../../src/lib/knowledgeHygiene.js'

// --- topics ---------------------------------------------------------------

test('Trigonometry is one topic however it is typed', () => {
  const forms = ['Trigonometry', 'trigonometry', ' TRIGONOMETRY ', 'trig', 'Trigonometery', 'trigo']
  const keys = new Set(forms.map(f => canonicalTopic(f).key))
  assert.equal(keys.size, 1, `still ${keys.size} topics: ${[...keys]}`)
})

test("Ohm's Law variants collapse to one topic key", () => {
  const keys = new Set(["Ohm's Law", 'ohms law', 'Ohm Law', 'OHMS-LAW'].map(f => canonicalTopic(f).key))
  assert.equal(keys.size, 1, `${keys.size} keys: ${[...keys]}`)
})

test('the "Ai" node is rejected', () => {
  // A real concept node in the live graph.
  assert.equal(canonicalTopic('Ai'), null)
  assert.equal(canonicalTopic('AI'), null)
})

test('"General" is rejected, not treated as a subject', () => {
  // 48 of 55 events were tagged this. Accepting it makes every derived list
  // meaningless.
  assert.equal(canonicalTopic('General'), null)
  assert.equal(canonicalTopic('misc'), null)
  assert.equal(canonicalTopic(''), null)
  assert.equal(canonicalTopic(null), null)
})

test('a sentence is not a topic', () => {
  assert.equal(canonicalTopic('R = V x I = 12 x 3 = 36 ohms and that is my answer'), null)
  assert.equal(canonicalTopic('no create it in flashcards please do it now'), null)
})

test('a real topic survives and gets a display name', () => {
  const t = canonicalTopic('  chemical   reactions ')
  assert.equal(t.key, 'chemical reactions')
  assert.equal(t.display, 'Chemical Reactions')
})

test('normalizeTopicText strips punctuation and collapses space', () => {
  assert.equal(normalizeTopicText("  Ohm's,  Law!! "), 'ohms law')
})

// --- chat classification --------------------------------------------------

test('commands from the live log are not doubts', () => {
  for (const s of [
    'Make Flashcard Abt This',
    'No Create It In Flashcards',
    'make flashcards',
    'save this to my notebook',
    'create a quiz on this',
    'put it in notes',
  ]) {
    assert.equal(classifyChatTurn(s), 'command', `"${s}" was not classified as a command`)
  }
})

test("the student's wrong answer is an attempt, not a doubt", () => {
  // Stored as a doubt in the live log, so the app believed the student had
  // ASKED this.
  assert.equal(classifyChatTurn('R = V x I = 12 x 3 = 36 ohms'), 'attempt')
  assert.equal(classifyChatTurn('x = 5'), 'attempt')
  assert.equal(classifyChatTurn('sin30 + cos60 = 1'), 'attempt')
})

test('real questions are still questions', () => {
  for (const s of [
    'What is Ohm\'s law?',
    'why does current drop when resistance rises',
    'explain mitosis',
    'How do I derive the quadratic formula?',
    'define electromagnetic induction',
  ]) {
    assert.equal(classifyChatTurn(s), 'question', `"${s}" was not classified as a question`)
  }
})

test('ambiguous text is "other" and is not stored as a doubt', () => {
  // A false doubt is worse than a missing one — it becomes a permanent
  // weakness in the student's profile.
  assert.equal(classifyChatTurn('ok'), 'empty')
  assert.equal(classifyChatTurn('thanks'), 'other')
  assert.equal(classifyChatTurn(''), 'empty')
})

// --- formula grouping -----------------------------------------------------

test("all six Ohm's Law rearrangements share one signature", () => {
  // This is the Formula Sheet bug exactly.
  const variants = ['V = I R', 'V = I × R', 'R = V / I', 'I = V / R', 'V=IR', 'R=V÷I']
  const sigs = new Set(variants.map(formulaSignature))
  assert.equal(sigs.size, 1, `${sigs.size} signatures: ${[...sigs]}`)
})

test('genuinely different formulas keep different signatures', () => {
  assert.notEqual(formulaSignature('V = I R'), formulaSignature('P = V I'))
  assert.notEqual(formulaSignature('E = m c^2'), formulaSignature('F = m a'))
})

test('same formula for the same topic is a duplicate; different topic is not', () => {
  const a = { expr: 'V = I R', topic: "Ohm's Law" }
  const b = { expr: 'R = V / I', topic: 'ohms law' }
  const c = { expr: 'R = V / I', topic: 'Magnetism' }
  assert.ok(isSameFormula(a, b))
  assert.ok(!isSameFormula(a, c))
})

// --- recency dedupe -------------------------------------------------------

test('an equivalent formula inside the hour is caught', () => {
  const now = Date.parse('2026-08-15T12:00:00Z')
  const existing = [{ ts: now - 2 * 60 * 1000, expr: 'V = I R', topic: "Ohm's Law" }]
  const dup = findRecentDuplicate(existing, { expr: 'R = V / I', topic: 'ohms law' }, isSameFormula, now)
  assert.ok(dup, 'the 2-minute-later rearrangement was not caught')
})

test('the same formula a day later is allowed through', () => {
  const now = Date.parse('2026-08-15T12:00:00Z')
  const existing = [{ ts: now - 25 * 60 * 60 * 1000, expr: 'V = I R', topic: "Ohm's Law" }]
  assert.equal(findRecentDuplicate(existing, { expr: 'V = I R', topic: "Ohm's Law" }, isSameFormula, now), null)
})

test('the dedupe window is one hour', () => {
  assert.equal(DEDUPE_WINDOW_MS, 3600_000)
})

test('cards and concepts dedupe on normalised text', () => {
  assert.ok(sameText('Mitosis Overview', '  mitosis   overview  '))
  assert.ok(!sameText('Mitosis', 'Meiosis'))
  assert.ok(!sameText('', ''))
})
