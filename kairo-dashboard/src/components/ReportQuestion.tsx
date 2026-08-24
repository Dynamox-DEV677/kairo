import { useState } from 'react'
import { authToken } from '../lib/storage'

/**
 * Audit task 6 — answer provenance + the one-tap "this looks wrong".
 *
 * Sits under any model-generated question/answer. Says plainly that the
 * content is AI-generated, and turns doubt into a review-queue entry instead
 * of silent distrust. Reports that can't reach the server (offline, table
 * not migrated yet) queue in localStorage and flush on the next attempt —
 * the student's tap always lands.
 */

const PENDING_KEY = 'kyno:qreports:pending'

interface ReportPayload {
  question: string
  options?: string[]
  claimed?: string | null
  source: string
}

function readPending(): ReportPayload[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') } catch { return [] }
}
function writePending(list: ReportPayload[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-50))) } catch {}
}

async function post(p: ReportPayload): Promise<boolean> {
  try {
    const r = await fetch('/api/quiz/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken() || ''}`,
      },
      body: JSON.stringify(p),
    })
    if (!r.ok) return false
    const d = await r.json()
    return d.stored === true
  } catch { return false }
}

/** Fire the report; on failure queue it and opportunistically flush later. */
export async function sendQuestionReport(p: ReportPayload): Promise<'sent' | 'queued'> {
  // Try to flush any backlog first — cheap, and keeps the queue short.
  const backlog = readPending()
  if (backlog.length) {
    const still: ReportPayload[] = []
    for (const item of backlog) {
      if (!(await post(item))) still.push(item)
    }
    writePending(still)
  }
  if (await post(p)) return 'sent'
  writePending([...readPending(), p])
  return 'queued'
}

export default function ReportQuestion({ question, options, claimed, source, style }: ReportPayload & { style?: React.CSSProperties }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'queued'>('idle')

  async function report() {
    if (state !== 'idle') return
    setState('busy')
    setState(await sendQuestionReport({ question, options, claimed, source }))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8, ...style }}>
      <span style={{ fontSize: 10, color: '#6B7280', letterSpacing: 0.3 }}>
        AI-generated — cross-check worked answers with your textbook.
      </span>
      <button
        onClick={report}
        disabled={state !== 'idle'}
        className="kyno-ghost"
        style={{
          padding: '3px 9px', borderRadius: 7, cursor: state === 'idle' ? 'pointer' : 'default',
          background: 'transparent', color: state === 'idle' ? '#9CA3AF' : '#34D399',
          fontFamily: 'inherit', fontSize: 10, fontWeight: 700,
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
        {state === 'idle' ? 'Looks wrong?' : state === 'busy' ? '…' :
         state === 'sent' ? 'Reported ✓ — thank you' : 'Recorded ✓ — syncs when online'}
      </button>
    </div>
  )
}
