import { useMemo } from 'react'
import katex from 'katex'

interface Props {
  expr: string
  displayMode?: boolean
  style?: React.CSSProperties
  className?: string
}

export default function MathExpr({ expr, displayMode, style, className }: Props) {
  const { html, didFall } = useMemo(() => {
    let src   = (expr ?? '').trim()
    let block = !!displayMode

    if (src.startsWith('$$') && src.endsWith('$$')) {
      src   = src.slice(2, -2).trim()
      block = true
    } else if (src.startsWith('$') && src.endsWith('$')) {
      src = src.slice(1, -1).trim()
    }

    src = src.replace(/\s+/g, ' ')

    try {
      const out = katex.renderToString(src, {
        displayMode: block,
        throwOnError: false,
        errorColor: '#A5B4FC',
        strict: false as any,
      })
      return { html: out, didFall: false }
    } catch {
      // The fallback goes into innerHTML too, and `expr` is AI output: escape
      // it, or a formula KaTeX could not parse becomes markup.
      const safe = String(expr)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      return { html: safe, didFall: true }
    }
  }, [expr, displayMode])

  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
      data-math-fallback={didFall || undefined}
    />
  )
}
