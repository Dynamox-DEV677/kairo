/**
 * Local preview for Performance — dev only.
 *
 * Seeds a realistic mistake history straight into the twin event log (the real
 * source of truth), so every screen has something honest to show: three live
 * patterns, one beaten, a mock to chart, topics in both groups. The diagnose
 * route is stubbed. Vite only builds index.html, so this never ships.
 *
 * Open http://localhost:3002/performance-preview.html
 */
import { createRoot } from 'react-dom/client'
import Performance from './pages/Performance'
import { PreviewFrame } from './preview-shared'
import { track } from './lib/twin'

const DAY = 86_400_000
const NOW = Date.now()

try {
  if (!localStorage.getItem('kyno:perf-preview-seeded')) {
    const written = (daysAgo: number, signature: string, lines: string[], divergedAt: number | null, habit: string, marks = 1, title = 'Mark lost') =>
      track({
        type: 'essay_graded', topic: 'motion under gravity', subject: 'Physics', score: 80, correct: false, modality: 'text',
        payload: {
          source: 'written', q: 'A ball is dropped from 20 m. Find the time to reach the ground. (5 marks)', marks: 5, awarded: 5 - marks, lines,
          steps: [
            { line: 1, type: 'method', marks: 1, awarded: 1, title: 'Formula stated' },
            { line: divergedAt, type: 'substitution', marks, awarded: 0, title, reason: 'Write the substitution on its own line before you multiply anything.', signature, habit },
            { line: 3, type: 'answer', marks: 2, awarded: 2, title: 'Answer correct' },
            { line: 3, type: 'units', marks: 1, awarded: 1, title: 'Units carried' },
          ],
        },
        // the twin stamps ts itself; we patch it below
      } as any)

    // ── pattern 1: drops the ½ (written, 6×, still happening) ──
    for (const d of [1, 4, 9, 15, 22, 40]) {
      written(d, 'drops-half-in-suvat', ['s = ut + ½at²', '20 = 9.8 × t²', 't² = 2.04', 't = 1.43 s'], 2, 'You multiplied ½ × 9.8 in your head and wrote 9.8.', 1, 'The ½ disappeared')
    }
    // ── pattern 2: omits units (mock + written, 11×, getting better) ──
    for (const d of [2, 3, 16, 17, 18, 19, 20, 21, 23, 25, 27]) {
      track({ type: 'mistake', topic: 'motion under gravity', subject: 'Physics', correct: false, score: 0, modality: 'text',
        payload: { errType: 'careless', signature: 'omits-units', marksLost: 1, source: d < 10 ? 'mock' : 'written', why: 'You wrote the number and moved on.' } } as any)
    }
    // ── pattern 3: formula not written (3×) ──
    for (const d of [5, 12, 19]) {
      track({ type: 'mistake', topic: 'newton laws', subject: 'Physics', correct: false, score: 0, modality: 'text',
        payload: { errType: 'formula', signature: 'formula-not-written', marksLost: 2, source: 'written', why: 'You went straight to the numbers.' } } as any)
    }
    // ── beaten: sign errors, last seen 24+ days ago ──
    for (const d of [24, 31, 45]) {
      track({ type: 'mistake', topic: 'vectors', subject: 'Physics', correct: false, score: 0, modality: 'text',
        payload: { errType: 'careless', signature: 'sign-flip', marksLost: 1, source: 'quiz' } } as any)
    }
    // ── conceptual gaps in optics (RELEARN group) ──
    for (const d of [3, 6, 8]) {
      track({ type: 'quiz_answered', topic: 'refraction', subject: 'Physics', correct: false, score: 0, modality: 'interactive', durationMs: 40_000, difficulty: 0.6,
        payload: { source: 'quiz', q: 'Light enters glass from air. Which way does it bend?', options: ['Towards the normal', 'Away from the normal', 'Does not bend', 'Reflects'], correctIndex: 0, chosenIndex: 1 } } as any)
    }
    // ── the mock: score 61, losses 12 conceptual + 11 careless + 8 formula + 5 calc + 3 incomplete = 39 ──
    track({ type: 'quiz_completed', subject: 'Physics', score: 61, payload: { mock: true, total: 100, name: 'Half-yearly mock' } } as any)
    const mockLoss = (errType: string, signature: string, marksLost: number, topic = 'motion under gravity') =>
      track({ type: 'mistake', topic, subject: 'Physics', correct: false, score: 0, modality: 'interactive', payload: { errType, signature, marksLost, source: 'mock' } } as any)
    mockLoss('conceptual', 'concept-refraction', 12, 'refraction')
    mockLoss('careless', 'omits-units', 11)
    mockLoss('formula', 'formula-not-written', 8, 'newton laws')
    mockLoss('calculation', 'drops-half-in-suvat', 5)
    mockLoss('incomplete', 'ran-out-of-time', 3, 'work energy')

    // Backdate: the twin stamps Date.now() on every event. Rewrite ts by walking
    // the log in insertion order with the days-ago schedule above.
    const key = Object.keys(localStorage).find(k => k.startsWith('kyno:twin:'))
    if (key) {
      const st = JSON.parse(localStorage.getItem(key) || '{}')
      const schedule = [1, 4, 9, 15, 22, 40, 2, 3, 16, 17, 18, 19, 20, 21, 23, 25, 27, 5, 12, 19, 24, 31, 45, 3, 6, 8, 1, 1, 1, 1, 1, 1]
      const evs = (st.events || []).slice(-schedule.length)
      evs.forEach((e: any, i: number) => { e.ts = NOW - schedule[i] * DAY - (i % 7) * 3600_000 })
      // mock + its losses land inside the mock's window
      const mockIdx = (st.events || []).findIndex((e: any) => e.type === 'quiz_completed')
      if (mockIdx >= 0) {
        const mt = NOW - 1 * DAY
        st.events[mockIdx].ts = mt
        for (let i = mockIdx + 1; i < st.events.length; i++) st.events[i].ts = mt - 30 * 60_000
      }
      st.events.sort((a: any, b: any) => a.ts - b.ts)
      localStorage.setItem(key, JSON.stringify(st))
    }
    localStorage.setItem('kyno:perf-preview-seeded', '1')
  }
} catch (e) { console.warn('seed failed', e) }

const real = window.fetch.bind(window)
window.fetch = ((url: any, init?: any) => {
  const u = String(url)
  if (u.includes('/api/performance/diagnose')) {
    return new Promise<Response>(res => setTimeout(() => res(new Response(JSON.stringify({
      diagnosis: 'You know the formula — you write s = ut + ½at² correctly every time. The ½ disappears on the NEXT line, when you substitute and multiply in one move.',
      fix: 'Write the substitution on its own line before you multiply anything.',
      code: 's = ut + ½at²\n20 = 0 + ½ × 9.8 × t²     ← write this line, unmultiplied\n20 = 4.9 t²\nt = 2.02 s',
      why: 'You multiply ½ × 9.8 in your head and write 9.8 instead of 4.9.',
      cost: 'three seconds, and it earns a method mark even when the answer is wrong',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })), 900))
  }
  return real(url, init)
}) as typeof window.fetch

createRoot(document.getElementById('root')!).render(
  <PreviewFrame active="performance">
    <Performance
      onOpenDoubt={seed => alert('Opens Doubt Solving with:\n\n' + seed)}
      onDrill={f => alert('Opens Practice filtered to:\n\n' + JSON.stringify(f, null, 2))}
    />
  </PreviewFrame>,
)
