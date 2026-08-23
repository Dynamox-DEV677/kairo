/**
 * Revise with your ears — turning the student's OWN cards into speakable
 * scripts. Pure text transforms + playlist assembly; the actual speaking is
 * the browser's Speech Synthesis (see tts.ts), which costs nothing and works
 * offline.
 *
 * speakableText exists because cards carry markdown and LaTeX: reading
 * "$v = u + at$" aloud as "dollar v equals u plus at dollar" would be a joke.
 * The table below is deliberately small and covers what school formulas
 * actually use; anything unrecognised degrades to plain words, never to
 * TeX noise.
 */

/** Markdown + LaTeX + unit symbols → something a voice can say. */
export function speakableText(input) {
  let s = String(input || '')

  // markdown first
  s = s.replace(/```[\s\S]*?```/g, ' ')
  s = s.replace(/`([^`]*)`/g, '$1')
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/^#{1,6}\s+/gm, '')
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2')
  s = s.replace(/(\*|_)(.*?)\1/g, '$2')
  s = s.replace(/^\s*[-*+]\s+/gm, '')

  // LaTeX blocks: transform the inside, drop the fences
  s = s.replace(/\$\$?([^$]+)\$\$?/g, (_, tex) => ` ${texToWords(tex)} `)

  // stray TeX outside $…$ still gets a pass
  s = texToWords(s)

  // unit + symbol talk
  s = s
    .replace(/°C/g, ' degrees Celsius')
    .replace(/°F/g, ' degrees Fahrenheit')
    .replace(/°/g, ' degrees')
    .replace(/µ/g, 'micro ')
    .replace(/Δ/g, 'delta ')
    .replace(/θ/g, 'theta ')
    .replace(/λ/g, 'lambda ')
    .replace(/Ω/g, ' ohm')
    .replace(/²/g, ' squared')
    .replace(/³/g, ' cubed')
    .replace(/→/g, ' gives ')
    .replace(/±/g, ' plus or minus ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/≈/g, ' is about ')
    .replace(/≠/g, ' is not equal to ')
    .replace(/≥/g, ' is at least ')
    .replace(/≤/g, ' is at most ')
    // "m/s" style unit slashes → per (letters around a slash, not dates/fractions of digits)
    .replace(/([A-Za-z])\s*\/\s*([A-Za-z])/g, '$1 per $2')

  return s.replace(/\s+/g, ' ').trim()
}

/** The small TeX table. */
export function texToWords(tex) {
  let t = String(tex || '')
  // \frac{a}{b} → a over b (innermost first, run twice for nesting)
  for (let i = 0; i < 2; i++) {
    t = t.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 over $2 ')
  }
  t = t
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, ' square root of $1 ')
    .replace(/\\times/g, ' times ')
    .replace(/\\cdot/g, ' times ')
    .replace(/\\pm/g, ' plus or minus ')
    .replace(/\\div/g, ' divided by ')
    .replace(/\\(alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|sigma|omega|phi)/gi, ' $1 ')
    .replace(/\\(left|right|,|;|!)/g, ' ')
    .replace(/\^\{?2\}?/g, ' squared')
    .replace(/\^\{?3\}?/g, ' cubed')
    .replace(/\^\{?([^{}\s]+)\}?/g, ' to the power $1')
    .replace(/_\{?([^{}\s]+)\}?/g, ' $1')
    .replace(/\\[a-zA-Z]+/g, ' ') // anything else TeXy: drop, don't read
    .replace(/[{}]/g, ' ')
  return t
}

export const PLAYLIST_CAP = 12

/**
 * The playlist: the student's own reel cards (already due-first from
 * reels.core.buildDeck), each turned into a spoken script. Flashcards read as
 * question → beat → answer; formulas read the name then the expression.
 */
export function buildPlaylist(deck, { max = PLAYLIST_CAP } = {}) {
  const items = []
  for (const c of deck || []) {
    if (!c || !c.front) continue
    const front = speakableText(c.front)
    const back = speakableText(c.back || '')
    if (!front && !back) continue
    const script = c.kind === 'formula'
      ? `${front}. ${back ? `The formula is: ${back}.` : ''}`
      : `${front}${/[?.!]$/.test(front) ? '' : '?'} ... The answer: ${back || 'check your notes for this one'}.`
    items.push({
      id: c.id,
      title: String(c.front).slice(0, 90),
      sub: `${c.subject || 'General'}${c.topic ? ` · ${c.topic}` : ''}${c.due ? ' · due for review' : ''}`,
      due: !!c.due,
      script: script.trim(),
    })
    if (items.length >= max) break
  }
  return items
}
