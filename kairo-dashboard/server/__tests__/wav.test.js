/**
 * WAV encoder (the neural voice's safety net) — the header must be exactly
 * right or every audio player rejects the clip silently.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wavBytesFromFloat32 } from '../../src/lib/wav.core.js'

test('produces a valid 16-bit mono PCM WAV', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
  const rate = 24000
  const bytes = wavBytesFromFloat32(samples, rate)
  const v = new DataView(bytes.buffer)

  assert.equal(bytes.length, 44 + samples.length * 2)
  const tag = (off, len) => String.fromCharCode(...bytes.slice(off, off + len))
  assert.equal(tag(0, 4), 'RIFF')
  assert.equal(tag(8, 4), 'WAVE')
  assert.equal(tag(12, 4), 'fmt ')
  assert.equal(tag(36, 4), 'data')
  assert.equal(v.getUint32(24, true), rate)
  assert.equal(v.getUint16(22, true), 1, 'mono')
  assert.equal(v.getUint16(34, true), 16, 'bit depth')
  assert.equal(v.getUint32(40, true), samples.length * 2, 'data size')
  // clipping is clamped, not wrapped
  assert.equal(v.getInt16(44 + 3 * 2, true), 0x7FFF)
  assert.equal(v.getInt16(44 + 4 * 2, true), -0x8000)
})

test('empty input still yields a playable (silent) file', () => {
  const bytes = wavBytesFromFloat32(null, 24000)
  assert.equal(bytes.length, 44)
})
