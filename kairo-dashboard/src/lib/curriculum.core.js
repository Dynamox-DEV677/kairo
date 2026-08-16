/**
 * Which curriculum a student follows, and what that means for the AI.
 *
 * Before this file, the Board selector was decoration. `student.board` was
 * pushed into the prompt as a bare token — the model saw the word "CBSE" in a
 * profile line and was told nothing about what to do with it. Two students on
 * two different curricula got the same answer with a different label attached.
 *
 * Three board lists also existed (Settings, Onboarding, Login), all different.
 * Onboarding offered IGCSE, Settings did not, so a student could choose IGCSE
 * at signup and find Settings showing CBSE. BOARD_OPTIONS below is now the
 * only list.
 *
 * ── COPYRIGHT (the rule this file is built around) ──────────────────────────
 * Nothing here reproduces textbook text, and the directives explicitly forbid
 * the model from doing so either. What IS encoded is curriculum *structure* —
 * topic names and the shape of an expected answer — taken from the syllabus
 * and specification documents that boards publish for teachers. A chapter
 * title is a fact about how a course is organised; a chapter's prose is not
 * ours to copy. See src/data/syllabus/*.json for the topic maps and their
 * provenance fields.
 *
 * Plain .js with a sibling .d.ts so the plain-ESM server and the TS client
 * both import the same module. Same pattern as selectors.core.js.
 */

/** The one board list. Settings, Onboarding and Login all render this. */
export const BOARD_OPTIONS = [
  { value: 'CBSE',        label: 'CBSE',              hint: 'NCERT books · India' },
  { value: 'ICSE',        label: 'ICSE',              hint: 'CISCE · India' },
  { value: 'Cambridge',   label: 'Cambridge IGCSE',   hint: 'Cambridge International' },
  { value: 'IB',          label: 'IB',                hint: 'International Baccalaureate' },
  { value: 'State Board', label: 'State Board',       hint: 'India · state syllabus' },
  { value: 'Other',       label: 'Other',             hint: '' },
]

/**
 * Curriculum profiles.
 *
 * `syllabusBoard` is the key into src/data/syllabus/<id>.json — null where we
 * have no verified topic map. Nothing here invents a chapter structure for a
 * board we have not actually sourced; `mapped: false` makes the app say so
 * rather than show an Indian chapter list to a Cambridge student.
 */
const CURRICULA = {
  ncert: {
    id: 'ncert',
    label: 'CBSE / NCERT',
    syllabusBoard: 'cbse',
    region: 'India',
    currency: '₹ (Indian rupees)',
    /** What the AI is told about how to teach. */
    style: [
      'Follow the NCERT treatment of the topic, not a general or international one.',
      "Use NCERT's own terminology. NCERT says \"displacement reaction\", not \"single replacement\"; \"uniform circular motion\", not \"UCM\".",
      'Teach the method NCERT teaches for this chapter, even where a faster method exists. A shortcut may be mentioned afterwards, clearly marked as extra.',
      'Match NCERT depth: thorough on what the chapter covers, and do not drag in material from a later class to explain it.',
    ],
    /** What the AI is told about how the student will be examined. */
    exam: [
      'The student sits CBSE board exams. Marks are awarded step by step, so show every step — a correct final answer with missing working loses marks.',
      'Where a question carries marks, structure the answer to earn each one: statement, formula, substitution, result with unit.',
      'Diagrams are marked. Say when one is expected and what must be labelled.',
    ],
    examples: [
      'Use Indian context in examples and word problems: rupees (₹) for money, Indian cities, distances in km, cricket rather than baseball.',
      'Use names a student in India would recognise (Aarav, Priya, Ravi) rather than defaulting to Western names.',
    ],
  },

  cambridge: {
    id: 'cambridge',
    label: 'Cambridge IGCSE',
    syllabusBoard: 'cambridge',
    region: 'international',
    currency: null, // Cambridge papers deliberately vary the currency
    style: [
      'Follow the Cambridge IGCSE treatment: the syllabus learning objectives define the scope, and anything beyond them is enrichment, not the answer.',
      'Use Cambridge terminology and the SI conventions the syllabus specifies.',
      'Respect the Core / Extended split. If content is Extended-only, say so, so a Core candidate is not revising material they will never be asked.',
      'Cambridge questions frequently apply a familiar idea to an unfamiliar context. Teach the principle in a way that transfers, not a memorised script.',
    ],
    exam: [
      'The student sits Cambridge IGCSE papers, which are marked against a points-based mark scheme: each creditable point earns a mark, and repeating the question earns nothing.',
      'The command word in a question controls the shape of the answer. Answer the command word that was actually asked — an "explain" answer to a "state" question wastes time; a "state" answer to an "explain" question loses the marks.',
      'Where a question carries marks, aim for at least that many distinct creditable points.',
    ],
    examples: [
      'Use international context in examples and word problems. Do not assume the student lives in India.',
      'Use SI units. Where money is needed, use a neutral currency ($ or a named local one), never assume rupees.',
    ],
  },

  /**
   * Boards we can style for but have NOT built a verified topic map for.
   * Deliberately listed rather than silently falling back to NCERT: an ICSE
   * student being taught the NCERT method is a wrong answer delivered
   * confidently.
   */
  icse: {
    id: 'icse', label: 'ICSE', syllabusBoard: null, region: 'India', currency: '₹ (Indian rupees)',
    style: ['Follow the ICSE/CISCE treatment, which generally goes into more descriptive detail than NCERT. Do not substitute the NCERT method and call it ICSE.'],
    exam: ['The student sits ICSE board exams. Show full working; ICSE papers reward detailed, structured answers.'],
    examples: ['Use Indian context in examples: rupees (₹), Indian places and names.'],
  },
  ib: {
    id: 'ib',
    label: 'IB Diploma Programme',
    syllabusBoard: 'ib',
    region: 'international',
    currency: null,
    style: [
      'Follow the IB Diploma Programme treatment. The DP sciences are organised around themes and concepts rather than a chapter list, so explain how the idea fits the bigger theme, not only the isolated fact.',
      'Distinguish SL from HL. If content is HL-only ("Additional higher level"), say so, so an SL student is not revising material they will never be asked.',
      'Nature of Science matters in the DP: where relevant, say how the knowledge was arrived at — the evidence, the model, its limitations.',
      'Use IB terminology and the codes the guides use (Physics themes A-E, Chemistry Structure/Reactivity, Biology theme+level codes like C1.2), so the student can find the topic in their own materials.',
    ],
    exam: [
      'The student sits IB assessments, marked against published criteria and command terms. An unjustified correct answer scores poorly — the reasoning carries the marks.',
      'IB command terms are precise and differ from everyday usage. "State" wants a fact, "outline" a brief account, "explain" a reasoned account, "discuss" a balanced review. Answer the term that was asked.',
      'Internal assessment and data-based questions are a large share of the grade. Where data is involved, address uncertainty, error and the limits of the conclusion.',
    ],
    examples: [
      'Use international context in examples and word problems. Do not assume the student lives in any one country.',
      'Use SI units and IB conventions. Where money is needed use a neutral currency, never assume rupees.',
    ],
  },
  generic: {
    id: 'generic', label: 'school syllabus', syllabusBoard: null, region: null, currency: null,
    style: [], exam: [], examples: [],
  },
}

/**
 * Class as a number. The profile stores it as "Class 9", "9", "IX" or blank
 * depending on which screen collected it.
 */
export function classNumber(cls) {
  const m = String(cls ?? '').match(/\d{1,2}/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return n >= 1 && n <= 12 ? n : null
}

/**
 * How hard to pitch the answer.
 *
 * Curriculum alone was not enough: a Class 6 and a Class 9 student on NCERT were
 * getting the same explanation of the same idea, because the only thing the
 * model knew was "CBSE". Grade is the other half — an 11-year-old and a
 * 15-year-old need different sentences for the same physics.
 *
 * Bands rather than per-year rules, because the real jumps are structural:
 * primary/middle school works from the concrete, secondary introduces formal
 * symbols and derivations, and the last two years assume both.
 */
export function gradeBand(cls) {
  const n = classNumber(cls)
  if (n == null) return null
  if (n <= 8)  return 'middle'
  if (n <= 10) return 'secondary'
  return 'senior'
}

const DEPTH = {
  middle: {
    label: 'roughly ages 11-14',
    rules: [
      'Lead with something the student can picture or has seen. Build the idea from the concrete example, do not open with the definition.',
      'Short sentences, one idea each. Everyday words wherever a technical word is not required. When a technical word IS required, introduce it and say what it means in plain language the first time.',
      'Arithmetic only — no algebraic rearrangement, no derivations, no calculus. If a formula is needed, give it directly and substitute numbers.',
      'Keep the whole answer short. A long answer at this level is a worse answer.',
      'Do not reach into later years to explain something. If the honest explanation needs material they have not met, say the fuller reason comes later and give the version that is true at their level.',
    ],
  },
  secondary: {
    label: 'roughly ages 14-16',
    rules: [
      'Use the proper technical vocabulary and expect it back. Define a term once, then use it.',
      'Symbols, units and formal statements are expected. Rearranging a formula is fine; show the rearrangement.',
      'Give the reason as well as the fact — this is the level where "why" starts carrying marks.',
      'Derivations are appropriate where the syllabus expects them, but only those it expects.',
    ],
  },
  senior: {
    label: 'roughly ages 16-18',
    rules: [
      'Full rigour. Abstraction, algebraic generality and quantitative treatment are all expected.',
      'Assume the earlier material and build on it rather than re-teaching it.',
      'State assumptions, limiting cases and where a model stops being valid.',
      'Where the mathematics is part of the answer, do the mathematics — do not describe it in words to avoid it.',
    ],
  },
}

/** Board string (as stored on the profile) → curriculum id. */
export function normaliseBoard(board) {
  const b = String(board || '').trim().toLowerCase()
  if (!b) return 'generic'
  if (b.includes('cambridge') || b.includes('igcse') || b.includes('cie')) return 'cambridge'
  if (b.includes('cbse') || b.includes('ncert')) return 'ncert'
  if (b.includes('icse') || b.includes('cisce')) return 'icse'
  if (b === 'ib' || b.includes('baccalaureate')) return 'ib'
  // "State Board", "Maharashtra", "Tamil Nadu"… all follow an Indian state
  // syllabus. They are close enough to NCERT in scope to be taught that way,
  // but we do not claim to have their chapter map.
  if (b.includes('state') || b.includes('board')) return 'ncert'
  return 'generic'
}

export function getCurriculum(id) {
  return CURRICULA[id] || CURRICULA.generic
}

/**
 * The profile the rest of the app asks for.
 *
 * `mapped` says whether a verified topic map exists for this board AND class.
 * Callers must not present a chapter list when it is false.
 */
export function resolveCurriculum(board, cls) {
  const id = normaliseBoard(board)
  const c = getCurriculum(id)
  return {
    id: c.id,
    label: c.label,
    syllabusBoard: c.syllabusBoard,
    region: c.region,
    currency: c.currency,
    cls: cls != null && String(cls).trim() ? String(cls).trim() : null,
    classNo: classNumber(cls),
    band: gradeBand(cls),
    isCambridge: c.id === 'cambridge',
    isIB: c.id === 'ib',
  }
}

/**
 * The block injected into every AI system prompt.
 *
 * This is Features 1 and 4 in one place: curriculum alignment and localised
 * examples travel together, because they are the same instruction — "teach
 * this student the way their course teaches it."
 */
export function curriculumDirective(board, cls, opts = {}) {
  const id = normaliseBoard(board)
  const c = getCurriculum(id)
  const p = resolveCurriculum(board, cls)

  const lines = []
  lines.push('── CURRICULUM ──')
  lines.push(
    p.cls
      ? `This student follows ${c.label}, class/grade ${p.cls}.`
      : `This student follows ${c.label}.`,
  )

  // Grade depth. Without this the only thing the model knows is the board, and
  // a Class 6 and a Class 9 student on NCERT get the same paragraph.
  const band = gradeBand(cls)
  if (band) {
    const d = DEPTH[band]
    lines.push(
      '',
      `Pitch the answer at class/grade ${p.cls} (${d.label}). This is not a tone setting — it changes what the answer may contain:`,
      ...d.rules.map(r => `- ${r}`),
    )
  }

  if (c.style.length)    lines.push('', 'How to teach it:', ...c.style.map(s => `- ${s}`))
  if (c.exam.length)     lines.push('', 'How they are examined:', ...c.exam.map(s => `- ${s}`))
  if (c.examples.length) lines.push('', 'Examples and word problems:', ...c.examples.map(s => `- ${s}`))

  // The copyright rule, stated to the model, every time.
  lines.push(
    '',
    'Write every explanation in your own words. Never reproduce, quote or closely',
    'paraphrase sentences from a textbook, and never claim to be quoting one. Match',
    'the curriculum\'s scope, terminology and depth — not its prose.',
  )

  if (opts.scope && opts.scope.length) {
    lines.push(
      '',
      'Topics in scope for this student (chosen from their published syllabus — if the',
      'question falls outside this list, say so rather than answering as if it were on it):',
      ...opts.scope.slice(0, 60).map(s => `- ${s}`),
    )
  }

  return lines.join('\n')
}

/* ── Feature 3: Cambridge command words ─────────────────────────────────────
 *
 * Cambridge publishes a command-word list in every syllabus, and marks against
 * it: a "state" question wants a bare fact, an "explain" question wants the
 * reason chain, and answering the wrong one costs marks even when the physics
 * is right. Students lose marks here constantly and never find out why.
 *
 * The `shape` and `why` text below is OUR OWN description of the answer
 * structure each word demands — deliberately not Cambridge's definition
 * wording. The word list is taken from the published syllabuses (IGCSE Physics
 * 0625 and Biology 0610, 2026–2028), which is public structural information.
 */
export const COMMAND_WORDS = {
  state: {
    marksTypically: '1',
    shape: 'One sentence. The fact itself, nothing else — no reasoning, no example, no restating the question.',
    why: 'A "state" question has one creditable point. Extra sentences cannot earn extra marks here, and a wrong extra sentence can lose the mark you already had.',
  },
  give: {
    marksTypically: '1',
    shape: 'The answer only, recalled or read straight off the source. No working.',
    why: 'Like "state" — the mark is for producing the right item, not for justifying it.',
  },
  define: {
    marksTypically: '1–2',
    shape: 'The precise meaning, in the form the syllabus uses — usually "X is Y per unit Z". Include the units where the definition implies them.',
    why: 'Definition marks are awarded for precision. A loose everyday paraphrase does not score.',
  },
  identify: {
    marksTypically: '1',
    shape: 'Name or select the thing. One or two words is often the whole answer.',
    why: 'Recognition only. Explaining your choice earns nothing.',
  },
  describe: {
    marksTypically: '2–4',
    shape: 'The main features or the sequence of what happens, point by point. What, not why. Aim for one distinct point per mark.',
    why: '"Describe" is marked as a list of creditable observations. Reasons belong in "explain" and are not credited here.',
  },
  explain: {
    marksTypically: '2–4',
    shape: 'The reason chain, linked. Say why and how, and connect each step to the next ("...because... which means... therefore..."). Name the principle you are using.',
    why: 'Marks are for the links, not the endpoints. An answer that describes what happens without saying why scores as a "describe" — which is to say, poorly.',
  },
  suggest: {
    marksTypically: '1–3',
    shape: 'Apply what you know to the unfamiliar situation in the question. A reasonable, justified proposal — there is no single expected answer.',
    why: '"Suggest" signals the context is deliberately new. Examiners credit sound reasoning applied to it, so use the details given in the question rather than a memorised answer.',
  },
  calculate: {
    marksTypically: '2–4',
    shape: 'Formula, then substitution with numbers, then the result with its unit. Show each line.',
    why: 'Method marks are awarded separately from the answer mark. Working earns credit even when the arithmetic slips; a bare number scores nothing if it is wrong.',
  },
  determine: {
    marksTypically: '2–4',
    shape: 'Establish the value from what you are given — often read a gradient, an intercept or a value off a graph or table first, then calculate. Show where the numbers came from.',
    why: 'Marks include extracting the right data, not only the arithmetic on it.',
  },
  compare: {
    marksTypically: '2–4',
    shape: 'Linked statements that mention BOTH things in the same sentence ("A is denser than B"), covering similarities and/or differences.',
    why: 'Marks require comparison. Two separate paragraphs — one about A, one about B — do not score as a comparison even if everything in them is true.',
  },
  predict: {
    marksTypically: '1–2',
    shape: 'State what will happen, based on the information given. Brief.',
    why: 'The mark is for the outcome. Reasoning is only credited if the question also asks for it.',
  },
  deduce: {
    marksTypically: '2–3',
    shape: 'State the conclusion and the evidence it rests on. "Since [given fact], it follows that [conclusion]."',
    why: 'The conclusion alone is usually one mark of several; the reasoning that got you there earns the rest.',
  },
  justify: {
    marksTypically: '2–3',
    shape: 'The case, with evidence or argument supporting it. Reference specific data from the question.',
    why: 'An unsupported assertion scores nothing here, however correct it is.',
  },
  evaluate: {
    marksTypically: '3–6',
    shape: 'Both sides, then a judgement. Points for, points against, and a stated conclusion that follows from them. The conclusion is not optional.',
    why: 'This is the one students most often lose marks on: they list advantages and disadvantages and stop. The judgement itself carries marks.',
  },
  outline: {
    marksTypically: '2–3',
    shape: 'The main points only, briefly. No detail, no worked reasoning.',
    why: 'Breadth is credited, depth is not. Long answers here spend time that scores elsewhere.',
  },
  comment: {
    marksTypically: '2–3',
    shape: 'An informed opinion on what the data or situation shows, referring to the specifics.',
    why: 'Credit is for engaging with what is actually in front of you, not for general statements about the topic.',
  },
  sketch: {
    marksTypically: '1–3',
    shape: 'Describe the drawing: axes and what goes on them, the shape of the line, any intercept or asymptote, and what must be labelled.',
    why: 'Sketch marks are for the key features and rough proportions — not for neatness, and not for plotted accuracy.',
  },
}

const CW_KEYS = Object.keys(COMMAND_WORDS)

/**
 * Which command word a question uses.
 *
 * Only matches at the start of a sentence or clause, which is where Cambridge
 * puts them. Matching anywhere would fire on "state of matter" and "explain"
 * inside a student's own aside, and mis-structure the answer.
 */
export function detectCommandWord(text) {
  const t = String(text || '')
  if (!t.trim()) return null
  for (const m of t.matchAll(/(?:^|[.;:?)\]\n]|\b\(\w\)\s*)\s*([A-Za-z]+)/g)) {
    const w = m[1].toLowerCase()
    if (CW_KEYS.includes(w)) return w
  }
  return null
}

/** The Feature-3 block: how to shape a model answer, and why. */
export function commandWordDirective(word) {
  const key = String(word || '').toLowerCase()
  const cw = COMMAND_WORDS[key]
  if (!cw) return ''
  const label = key.charAt(0).toUpperCase() + key.slice(1)
  return [
    '── COMMAND WORD ──',
    `This question uses the Cambridge command word "${label}" (typically worth ${cw.marksTypically} mark(s)).`,
    `Structure the model answer accordingly: ${cw.shape}`,
    '',
    `Then, in one or two sentences under a heading "Why this structure", tell the student: ${cw.why}`,
    'Keep that note short — it is coaching, not a second answer.',
  ].join('\n')
}
