import { AlertTriangle, RotateCcw } from 'lucide-react'
import { AiError } from '../lib/aiError.core'

/**
 * The one way a failure is shown to a student.
 *
 * Screens pass the thrown value and nothing else. They do not write copy, and
 * they do not decide whether a retry is worth offering — AiError already knows
 * both, so a screen cannot accidentally invent a reassuring cause or leak an
 * HTTP status the way several of them used to.
 *
 * It also looks like a problem. The Flashcards error was purple-on-dark with a
 * 5%-opacity background, which read as an informational note; combined with
 * sitting below the card grid, that is most of why a failure there registered
 * as "the button did nothing".
 */
export default function ErrorNote({
  error,
  onRetry,
  compact = false,
}: {
  /** whatever was thrown — string, Error, AiError, anything */
  error: unknown
  /** shown only when the failure is actually worth retrying */
  onRetry?: () => void
  compact?: boolean
}) {
  if (!error) return null
  const e = AiError.from(error)

  return (
    <div
      role="alert"
      style={{
        marginTop: 14,
        padding: compact ? '10px 12px' : '13px 15px',
        borderRadius: 12,
        background: 'rgba(226, 88, 92, 0.09)',
        border: '1px solid rgba(226, 88, 92, 0.34)',
        color: '#F0B4B6',
        fontSize: compact ? 12 : 13,
        lineHeight: 1.55,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <AlertTriangle size={compact ? 14 : 16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1, minWidth: 180 }}>{e.message}</span>

      {onRetry && e.retryable && (
        <button
          onClick={onRetry}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 9,
            background: 'rgba(226, 88, 92, 0.14)',
            border: '1px solid rgba(226, 88, 92, 0.4)',
            color: '#F0B4B6', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <RotateCcw size={12} /> Try again
        </button>
      )}
    </div>
  )
}
