/**
 * Local preview for Notes — dev only.
 *
 * Seeds three notes with provenance (a doubt, a teach-back, one written by
 * hand), cloze cards from each filed in the scheduler and indexed to their
 * note, a repeated "formula-not-written" slip so Ohm's law carries the amber
 * flag, and a weak topic so Watch & listen has something to choose. Stubs the
 * two AI calls. Vite only builds index.html.
 *
 * Open http://localhost:3002/notes-preview.html
 */
import { createRoot } from 'react-dom/client'
import Notes from './pages/Notes'
import { PreviewFrame } from './preview-shared'
import { saveToNotebook } from './lib/notebook'
import { saveProfile, recordFlashcard, recordMistake, track } from './lib/twin'
import { cardsForNote, attachCards } from './lib/notes.core'
import { getJSON, setJSON } from './lib/storage'

const DAY = 86_400_000

async function seed() {
  if (localStorage.getItem('kyno:notes-preview-seeded')) return
  saveProfile({ name: 'Preview', cls: '10', board: 'CBSE', mode: 'personal' } as any)

  const notes = [
    { kind: 'doubt' as const, source: 'doubt-solving', title: 'A ball is dropped from 20 m. How long does it take to hit the ground?', subject: 'Physics', topic: 'motion under gravity',
      content: '## 1. Write down what you know\nThe ball is dropped from rest, so u = 0.\nu = 0 m/s, a = 9.8 m/s², s = 20 m\n\n## 2. Choose the equation\nDistance and acceleration are given and time is asked, so the second equation of motion fits.\ns = ut + ½at²\n\n## 3. Substitute\n20 = 0 + 0.5 × 9.8 × t²\nt = 2.02 s' },
    { kind: 'note' as const, source: 'teach-back', title: 'Teach-back · refraction', subject: 'Physics', topic: 'refraction',
      content: '**You said:** light bends towards the normal when it goes into glass because it slows down, and the denser medium has a bigger refractive index.\n\n- Named the mechanism: speed change causes bending\n\n**What was missing**\n- Snell\'s law: the ratio sin i / sin r is constant for a pair of media.' },
    { kind: 'note' as const, source: 'manual', title: 'Ohm\'s law — the three forms', subject: 'Physics', topic: 'electricity',
      content: 'Current through a conductor is directly proportional to the potential difference across it, at constant temperature.\nV = I R\nR = V / I\nI = V / R\nThe graph of V against I is a straight line through the origin.' },
  ]
  let index = getJSON<Record<string, string[]>>('kyno:notes:cards') || {}
  for (const n of notes) {
    const { id } = await saveToNotebook({ kind: n.kind, title: n.title, content: n.content, subject: n.subject, tags: [n.topic], source: n.source })
    const ids: string[] = []
    for (const c of cardsForNote(n.title, n.content, { max: 3 })) ids.push(recordFlashcard({ front: c.front, back: c.back, subject: n.subject, topic: n.topic, source: 'auto-from-note' }).id)
    index = attachCards(index, id, ids)
  }
  setJSON('kyno:notes:cards', index)

  // a real pattern: the formula line skipped, twice, in written answers
  for (let i = 0; i < 2; i++) recordMistake({ topic: 'electricity', subject: 'Physics', errType: 'formula', signature: 'formula-not-written', marksLost: 2, source: 'written', why: 'You went straight to numbers.' })
  // a weak topic with some wrong answers
  for (let i = 0; i < 3; i++) track({ type: 'quiz_answered', subject: 'Physics', topic: 'refraction', correct: false, score: 0, modality: 'interactive', durationMs: 30_000, difficulty: 0.6, payload: { q: `Refraction ${i}`, options: ['a', 'b'], correctIndex: 0, chosenIndex: 1 } } as any)
  for (let i = 0; i < 2; i++) track({ type: 'quiz_answered', subject: 'Physics', topic: 'electricity', correct: true, score: 100, modality: 'interactive', payload: { q: `Electricity ${i}` } } as any)

  // the second note was saved "12 Aug"
  try {
    const raw = JSON.parse(localStorage.getItem('kyno:notebook:entries') || '[]')
    if (raw[1]) { raw[1].createdAt = Date.now() - 22 * DAY; raw[1].updatedAt = raw[1].createdAt }
    localStorage.setItem('kyno:notebook:entries', JSON.stringify(raw))
  } catch { /* ignore */ }
  localStorage.setItem('kyno:notes-preview-seeded', '1')
}

const real = window.fetch.bind(window)
window.fetch = ((url: any, init?: any) => {
  const u = String(url)
  const json = (b: unknown, ms = 700) => new Promise<Response>(res => setTimeout(() => res(new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })), ms))
  if (u.includes('/api/notes-scheme/scheme')) return json({ generated: true, requirements: [
    { point: 'Definition of respiration', marks: 1, keywords: ['respiration is', 'release of energy', 'breakdown of glucose'] },
    { point: 'The word equation', marks: 1, keywords: ['glucose + oxygen', 'carbon dioxide + water', 'word equation'] },
    { point: 'Where it happens — mitochondria', marks: 1, keywords: ['mitochondria'] },
    { point: 'Two differences from photosynthesis', marks: 2, keywords: ['photosynthesis', 'unlike photosynthesis', 'whereas photosynthesis'] },
  ] })
  if (u.includes('/api/practice/grade')) return json({ total: 5, awarded: 3, verdict: 'You lost two marks on the comparison', steps: [
    { line: 1, type: 'method', marks: 1, awarded: 1, title: 'Definition present', reason: 'Clear and correct.' },
    { line: 2, type: 'method', marks: 1, awarded: 1, title: 'Word equation written', reason: 'Both sides, arrow in the right direction.' },
    { line: 3, type: 'answer', marks: 1, awarded: 1, title: 'Site named', reason: 'Mitochondria — the one word the scheme looks for.' },
    { line: null, type: 'answer', marks: 2, awarded: 0, title: 'Comparison missing', reason: 'The question asks for two differences from photosynthesis. Two short lines would have earned two marks.' },
  ] }, 1200)
  return real(url, init)
}) as typeof window.fetch

seed().then(() => {
  createRoot(document.getElementById('root')!).render(
    <PreviewFrame active="notes">
      <Notes onOpenDoubt={s => alert('Opens Doubt Solving with:\n\n' + s)} onPractice={f => alert('Opens Practice with:\n\n' + JSON.stringify(f))} />
    </PreviewFrame>,
  )
})
