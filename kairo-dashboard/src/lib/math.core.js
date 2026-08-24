/**
 * Math-delimiter normalisation (audit task 1).
 *
 * The render pipeline is remark-math + rehype-katex, which understands
 * $…$ / $$…$$ but NOT LaTeX-style \(…\) / \[…\] — and the models emit both,
 * so inline math was reaching students as raw source. This module converts
 * every model output to the one convention the renderer accepts, and repairs
 * the delimiter damage models actually produce (dangling $$, doubled $$$$).
 *
 * Pure string→string; applied at every ReactMarkdown call site that renders
 * model output. Code fences and inline code are left untouched — a \( inside
 * a code sample is content, not math.
 */

import { normalizeMath } from './normalizeMath.js'

/**
 * The one entry point every render site should use. Two layers, in order:
 *  1. delimiter conversion + repair (this module): \(…\)/\[…\] → $/$$,
 *     doubled/dangling $$ fixed;
 *  2. bare-command wrapping (normalizeMath.js): `V = I \times R` with no
 *     delimiters at all gets wrapped — running it second means the newly
 *     converted $…$ spans are protected ranges it will not touch.
 */
export function prepMathMarkdown(input) {
  return normalizeMath(normalizeMathDelimiters(input))
}

/** \(…\) → $…$ and \[…\] → $$…$$, outside code, with $$-balance repair. */
export function normalizeMathDelimiters(input) {
  const text = String(input ?? '')
  if (!text) return ''

  // Split out fenced code blocks and inline code; only transform the rest.
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/)
  const out = parts.map((part, i) => (i % 2 === 1 ? part : transformProse(part)))
  return out.join('')
}

function transformProse(s) {
  let t = s

  // Display math: \[ … \]  →  $$ … $$   (multiline allowed)
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`)

  // Inline math: \( … \)  →  $ … $
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body.trim()}$`)

  // A whole line that is just [ …LaTeX… ] — models emit this for display math
  // when they drop the backslashes. Only when the content is unmistakably
  // maths (has a \command or sub/superscript braces), never for prose lists.
  t = t.replace(/^[ \t]*\[\s*([\s\S]*?)\s*\][ \t]*$/gm, (whole, body) =>
    (body.includes('\\') || /[_^{}]/.test(body)) ? `$$${body}$$` : whole)

  // Models sometimes double up: $$$$x$$$$ → $$x$$. Function replacer on
  // purpose — in a replacement STRING, "$$" collapses to one "$".
  t = t.replace(/\${4}/g, () => '$$')

  // Repair dangling display delimiters: an odd number of $$ means one is an
  // orphan (the "= \frac{4±8}{4}$$ with a lost left side" case). Dropping the
  // LAST unmatched $$ renders the content as prose instead of eating the rest
  // of the answer as one giant math block.
  const pairs = (t.match(/\$\$/g) || []).length
  if (pairs % 2 === 1) {
    const idx = t.lastIndexOf('$$')
    t = t.slice(0, idx) + t.slice(idx + 2)
  }

  return t
}

/**
 * The one-delimiter instruction appended to every maths/science system
 * prompt, so future outputs stop mixing conventions at the source.
 */
export const MATH_STYLE_RULE =
  'Write ALL mathematics with dollar delimiters only: $...$ for inline math and $$...$$ for display math, each $$...$$ on its own line. Never use \\(...\\), \\[...\\], or bare LaTeX outside delimiters. Never leave an unmatched $$.'
