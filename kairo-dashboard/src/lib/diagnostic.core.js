/**
 * The onboarding diagnostic (audit task 10) — five quick MCQs so that no
 * panel reads zero at the end of the first session: the answers are tracked
 * as REAL quiz events (with payloads), so Mistake Analysis, the weakness
 * lists, Today's 3 and the Museum all have genuine entries from minute one.
 *
 * Deterministic and offline by design: onboarding must never wait on an AI
 * call. Questions are original wording of standard Class 9–10 facts,
 * board-neutral. Selection prioritises the subjects the student DECLARED
 * weak — their declaration is the prior; these answers are the first
 * evidence.
 */

export const DIAGNOSTIC_BANK = {
  Physics: [
    { q: 'A car covers 100 m in 5 s at steady speed. Its speed is…',
      options: ['20 m/s', '500 m/s', '0.05 m/s', '105 m/s'], correctIndex: 0, topic: 'motion', difficulty: 0.3 },
    { q: 'The weight of an object on Earth is the force due to…',
      options: ['gravity', 'friction', 'magnetism', 'air pressure'], correctIndex: 0, topic: 'gravitation', difficulty: 0.3 },
    { q: 'Sound cannot travel through…',
      options: ['a vacuum', 'water', 'steel', 'air'], correctIndex: 0, topic: 'sound', difficulty: 0.35 },
    { q: 'In V = IR, doubling the resistance at fixed voltage makes the current…',
      options: ['half', 'double', 'unchanged', 'zero'], correctIndex: 0, topic: 'electricity', difficulty: 0.45 },
  ],
  Chemistry: [
    { q: 'The smallest particle of an element that keeps its identity is…',
      options: ['an atom', 'a molecule', 'an electron', 'a cell'], correctIndex: 0, topic: 'atoms and molecules', difficulty: 0.3 },
    { q: 'A pH of 3 means the solution is…',
      options: ['acidic', 'basic', 'neutral', 'a salt'], correctIndex: 0, topic: 'acids and bases', difficulty: 0.35 },
    { q: 'Evaporating sea water leaves salt behind. This separation works because…',
      options: ['water evaporates, salt does not', 'salt melts', 'water freezes', 'salt is magnetic'], correctIndex: 0, topic: 'separation of mixtures', difficulty: 0.3 },
    { q: 'In the periodic table, elements in one GROUP share…',
      options: ['similar chemical properties', 'the same mass', 'the same number of shells', 'the same colour'], correctIndex: 0, topic: 'periodic table', difficulty: 0.45 },
  ],
  Mathematics: [
    { q: 'If 3x − 5 = 10, then x =',
      options: ['5', '3', '15', '−5'], correctIndex: 0, topic: 'linear equations', difficulty: 0.3 },
    { q: 'The probability of rolling an even number on a fair die is…',
      options: ['1/2', '1/6', '1/3', '2/3'], correctIndex: 0, topic: 'probability', difficulty: 0.35 },
    { q: 'A triangle with sides 3, 4, 5 is…',
      options: ['right-angled', 'equilateral', 'obtuse', 'impossible'], correctIndex: 0, topic: 'triangles', difficulty: 0.4 },
    { q: 'The zero of the polynomial p(x) = x − 7 is…',
      options: ['7', '0', '−7', '1/7'], correctIndex: 0, topic: 'polynomials', difficulty: 0.4 },
  ],
  Biology: [
    { q: 'The organelle that releases energy from food is the…',
      options: ['mitochondrion', 'nucleus', 'cell wall', 'chloroplast'], correctIndex: 0, topic: 'cell', difficulty: 0.3 },
    { q: 'Photosynthesis mainly happens in the…',
      options: ['leaves', 'roots', 'flowers', 'bark'], correctIndex: 0, topic: 'life processes', difficulty: 0.3 },
    { q: 'Blood is pumped around the body by the…',
      options: ['heart', 'lungs', 'kidneys', 'liver'], correctIndex: 0, topic: 'transportation', difficulty: 0.25 },
    { q: 'Which carries oxygen in the blood?',
      options: ['red blood cells', 'white blood cells', 'platelets', 'plasma proteins'], correctIndex: 0, topic: 'transportation', difficulty: 0.4 },
  ],
}

export const DIAGNOSTIC_SIZE = 5

/**
 * Pick the diagnostic set: declared-weak subjects first (their declaration
 * is the hypothesis to test), then round-robin the rest. Deterministic —
 * same inputs, same five questions. Options are rotated per-question by a
 * stable amount so "always A" never leaks.
 */
export function pickDiagnostic({ weak = [], max = DIAGNOSTIC_SIZE } = {}) {
  const subjects = Object.keys(DIAGNOSTIC_BANK)
  const weakFirst = [
    ...subjects.filter(s => weak.some(w => String(w).toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(String(w).toLowerCase()))),
    ...subjects.filter(s => !weak.some(w => String(w).toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(String(w).toLowerCase()))),
  ]

  const cursors = Object.fromEntries(subjects.map(s => [s, 0]))
  const picked = []
  let i = 0
  while (picked.length < max && i < max * subjects.length) {
    const s = weakFirst[i % weakFirst.length]
    const bank = DIAGNOSTIC_BANK[s]
    const q = bank[cursors[s]]
    if (q) {
      cursors[s]++
      picked.push({ ...rotate(q, picked.length), subject: s })
    }
    i++
  }
  return picked
}

/** Stable option rotation so the correct answer isn't always option A. */
function rotate(q, seed) {
  const n = q.options.length
  const k = (seed + q.q.length) % n
  const options = q.options.map((_, i) => q.options[(i + k) % n])
  return { ...q, options, correctIndex: ((q.correctIndex - k) % n + n) % n }
}
