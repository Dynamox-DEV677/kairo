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
      return { html: expr, didFall: true }
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
