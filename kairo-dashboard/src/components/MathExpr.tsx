/**
 * MathExpr — KaTeX-rendered math for any LaTeX-ish string.
 *
 * Accepts the kinds of inputs the Solver tends to pin:
 *   $F = ma$
 *   $$\frac{F}{m}$$
 *   F = ma                  (no delimiters — still rendered as math)
 *
 * Strips outer dollar-sign delimiters, collapses internal whitespace
 * (because formulas pulled from chat sometimes carry a soft-wrap newline),
 * and falls back to the raw string on parse failure so the card never
 * goes blank — partial math is better than nothing.
 *
 * KaTeX CSS is loaded once via the CDN link in index.html, so this
 * component just emits the spans/MathML and inherits page typography.
 */
import { useMemo } from 'react'
import katex from 'katex'

interface Props {
  /** LaTeX source, with or without `$`/`$$` delimiters. */
  expr: string
  /** Block-style math (centered, bigger). Inferred from `$$…$$`. */
  displayMode?: boolean
  /** Inherit the parent's font colour by default — KaTeX uses `currentColor`. */
  style?: React.CSSProperties
  className?: string
}

export default function MathExpr({ expr, displayMode, style, className }: Props) {
  const { html, didFall } = useMemo(() => {
    let src   = (expr ?? '').trim()
    let block = !!displayMode

    // Detect delimiters.
    if (src.startsWith('$$') && src.endsWith('$$')) {
      src   = src.slice(2, -2).trim()
      block = true
    } else if (src.startsWith('$') && src.endsWith('$')) {
      src = src.slice(1, -1).trim()
    }

    // Some pinned formulas carry soft-wrap newlines from the chat UI.
    src = src.replace(/\s+/g, ' ')

    try {
      const out = katex.renderToString(src, {
        displayMode: block,
        throwOnError: false,
        // Soft pink on errors so the parse failure is visible without
        // crashing the card.
        errorColor: '#A5B4FC',
        // Allow plain words (Solver sometimes writes 'kinetic energy = ...')
        strict: false as any,
      })
      return { html: out, didFall: false }
    } catch {
      return { html: expr, didFall: true }
    }
  }, [expr, displayMode])

  return (
    <span
      className={className}
      style={style}
      // KaTeX-rendered HTML is trusted (we generated it from our own pinned
      // strings, not arbitrary user input on the network).
      dangerouslySetInnerHTML={{ __html: html }}
      data-math-fallback={didFall || undefined}
    />
  )
}
