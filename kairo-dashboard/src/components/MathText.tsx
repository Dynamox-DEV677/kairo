/**
 * THE renderer for anything a student or a model wrote.
 *
 * Every screen used to carry its own copy of this: Practice had one, Notes had
 * one, the Solver had one, the chat had one for the assistant and NOTHING for
 * the student. So a fix landed on one surface and missed the rest, three times
 * running -- raw "$$" in a chat bubble, "**bold**" in a doubt step, a class
 * name that matched no CSS. One component ends that.
 *
 * prepMathMarkdown normalises delimiters and maps Unicode maths to LaTeX
 * before KaTeX sees it; KATEX_OPTS turns off strict mode so a Greek letter
 * cannot refuse the whole expression.
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { KATEX_OPTS } from '../lib/katex'
import { prepMathMarkdown } from '../lib/math.core'

type Style = React.CSSProperties

export default function MathText({ text, style, mono, className }: {
  text?: string | null
  style?: Style
  /** Monospace body, for a worked-step block. */
  mono?: boolean
  className?: string
}) {
  const src = String(text ?? '')
  if (!src.trim()) return null
  return (
    <div className={['kyno-math', mono ? 'kyno-math-mono' : '', className || ''].filter(Boolean).join(' ')} style={style}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, KATEX_OPTS]]}>
        {prepMathMarkdown(src)}
      </ReactMarkdown>
    </div>
  )
}
