/**
 * Minimal WAV encoding — the safety net for neural TTS output when the
 * library's own blob helper isn't available. Pure bytes-in-bytes-out so it
 * tests under node like every other core.
 */

/** Float32 samples (-1..1) → complete 16-bit PCM WAV file bytes. */
export function wavBytesFromFloat32(samples, sampleRate) {
  const n = samples?.length || 0
  const rate = Math.max(1, Math.round(sampleRate || 24000))
  const dataSize = n * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buf)

  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)            // PCM
  v.setUint16(22, 1, true)            // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)     // byte rate
  v.setUint16(32, 2, true)            // block align
  v.setUint16(34, 16, true)           // bits per sample
  str(36, 'data'); v.setUint32(40, dataSize, true)

  let off = 44
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    off += 2
  }
  return new Uint8Array(buf)
}
