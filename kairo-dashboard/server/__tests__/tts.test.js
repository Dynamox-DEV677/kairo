/**
 * HD voice route — the pure parts. The bar: never send unbounded text to the
 * model (Vercel's 10s ceiling), never mid-word cuts, never an invalid voice.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampSpeechText, pickVoice, MAX_CHARS, TTS_VOICES, TTS_MODEL } from '../routes/tts.js'

test('text is clamped to the cap on a sentence edge, never mid-word', () => {
  const sentence = 'This is a proper sentence about photosynthesis. '
  const long = sentence.repeat(30) // ~1440 chars
  const out = clampSpeechText(long)
  assert.ok(out.length <= MAX_CHARS)
  assert.match(out, /\.$/, 'ends on a sentence boundary')

  const oneBlob = 'a'.repeat(50) + ' ' + 'b'.repeat(700) // no sentence stops
  const out2 = clampSpeechText(oneBlob)
  assert.ok(out2.length <= MAX_CHARS)
  assert.ok(!/\w$/.test(oneBlob.slice(out2.length, out2.length + 1)) || out2.endsWith('a'.repeat(50)), 'cut at a space')
})

test('junk in, null out — the route can 400 cleanly', () => {
  assert.equal(clampSpeechText(''), null)
  assert.equal(clampSpeechText('   '), null)
  assert.equal(clampSpeechText(null), null)
  assert.equal(clampSpeechText('  hello   world '), 'hello world')
})

test('voice is whitelisted; anything else gets the default', () => {
  assert.equal(pickVoice('troy'), 'troy')
  assert.equal(pickVoice('HANNAH'), 'hannah')
  assert.equal(pickVoice('<script>'), TTS_VOICES[0])
  assert.equal(pickVoice(undefined), TTS_VOICES[0])
  assert.match(TTS_MODEL, /orpheus/, 'current Groq TTS family (playai-tts was retired)')
})
