/**
 * Repair LaTeX the model emitted without delimiters.
 *
 * The observed bug is `V = I \times R` rendering literally in chat. Every one
 * of the 21 render sites already loads remark-math, so the plugin was never
 * missing -- remark-math only looks inside `$...$`, and the model routinely
 * writes commands with no delimiters at all. No prompt fixes this reliably;
 * the renderer has to cope.
 *
 * Conservative by design. Wrapping too eagerly turns prose into broken math,
 * which is worse than a stray backslash: KaTeX renders an error box the
 * student cannot read past.
 */

/** Commands common in school-level maths and science. */
const COMMANDS = [
  'times', 'div', 'pm', 'mp', 'cdot', 'approx', 'neq', 'leq', 'geq',
  'rightarrow', 'leftarrow', 'Rightarrow', 'to', 'implies',
  'frac', 'sqrt', 'sum', 'int', 'lim', 'infty', 'partial',
  'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'pi',
  'sigma', 'omega', 'Delta', 'Omega', 'Sigma',
  'sin', 'cos', 'tan', 'log', 'ln', 'exp',
  'circ', 'degree', 'angle', 'triangle', 'perp', 'parallel',
]

const CMD_RE = new RegExp(`\\\\(${COMMANDS.join('|')})\\b`)

/** Spans already inside $...$, $$...$$, or a fenced/inline code block. */
function protectedRanges(src) {
  const ranges = []
  const patterns = [
    /```[\s\S]*?```/g,   // fenced code
    /`[^`\n]*`/g,        // inline code
    /\$\$[\s\S]*?\$\$/g, // display math
    /\$[^$\n]*\$/g,      // inline math
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(src))) ranges.push([m.index, m.index + m[0].length])
  }
  return ranges
}

/** True if [start,end) touches any protected span. Checking only the line's
 *  start missed inline code sitting mid-line, which then got wrapped. */
const overlaps = (start, end, ranges) =>
  ranges.some(([a, b]) => start < b && end > a)

/**
 * Does this line read as a bare equation, or as a sentence containing one?
 *
 * Wrapping a whole sentence makes KaTeX render an unreadable error box, which
 * is worse than the stray backslash. So the bar is deliberately high: no
 * sentence punctuation anywhere, no commas, and few long prose words.
 */
function looksLikeEquation(s) {
  if (!s || s.length > 120) return false
  if (/[.!?;:,]/.test(s.replace(/\d[.,]\d/g, ''))) return false
  const prose = s.split(/\s+/).filter(w => /^[a-zA-Z]{4,}$/.test(w))
  return prose.length <= 1
}

/**
 * Wrap runs of text that contain a LaTeX command but no delimiters.
 *
 * Works line by line: a line is the natural unit for an equation in the
 * answer format, and it stops a single stray command from swallowing a
 * paragraph.
 */
export function normalizeMath(input) {
  if (!input || !input.includes('\\')) return input

  const ranges = protectedRanges(input)
  const lines = []
  let offset = 0

  for (const line of input.split('\n')) {
    const start = offset
    offset += line.length + 1

    // Leave anything already protected, and anything without a known command.
    if (overlaps(start, start + line.length, ranges) || !CMD_RE.test(line)) {
      lines.push(line); continue
    }
    if (line.includes('$')) { lines.push(line); continue }

    // A whole line that is essentially one expression: wrap it entire.
    const trimmed = line.trim()
    if (looksLikeEquation(trimmed)) {
      const bullet = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)/)
      if (bullet) {
        lines.push(`${bullet[1]}$${trimmed.slice(bullet[1].trim().length).trim()}$`)
      } else {
        const indent = line.match(/^\s*/)?.[0] ?? ''
        lines.push(`${indent}$${trimmed}$`)
      }
      continue
    }

    // Mixed prose and maths: wrap only the command and what binds to it,
    // rather than the sentence around it.
    lines.push(line.replace(
      new RegExp(`([\\w^{}()\\[\\]]*\\s*)?\\\\(${COMMANDS.join('|')})\\b(\\s*[\\w^{}()\\[\\]]*)?`, 'g'),
      (match) => `$${match.trim()}$`,
    ))
  }

  return lines.join('\n')
}
