/**
 * Shared by the *-preview.tsx harnesses -- dev only, never in the build.
 *
 * Wraps a space in the same SpaceFrame the Dashboard uses, so the three
 * breakpoints can be checked without signing in: open any preview with ?full
 * and the phone-shaped root fills the window. The desktop sidebar's links hop
 * between the preview pages, carrying the query string along.
 */
import type { ReactNode } from 'react'
import SpaceFrame from './components/SpaceFrame'

const FILES: Record<string, string> = { 'doubt-solving': 'doubt', practice: 'practice', performance: 'performance', plan: 'plan', notes: 'notes' }

export function previewGo(id: string) {
  const f = FILES[id]
  if (f) location.href = `/${f}-preview.html${location.search}`
  else alert('Would open #/' + id)
}

export function PreviewFrame({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SpaceFrame active={active} onNavigate={previewGo}>{children}</SpaceFrame>
    </div>
  )
}
