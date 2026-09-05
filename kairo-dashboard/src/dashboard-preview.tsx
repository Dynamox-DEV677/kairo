/**
 * The REAL Dashboard, with a fake signed-in profile and no Supabase -- dev only.
 *
 * The per-space harnesses mount one page on its own, so they cannot reproduce
 * anything caused by the shell: the stay-mounted slots, the display:none
 * swapping, SpaceFrame, or the hash router. This mounts the whole thing, which
 * is what the live site actually runs.
 *
 * Open http://localhost:3002/dashboard-preview.html#/practice
 */
import { createRoot } from 'react-dom/client'
import './index.css'
// the real entry (main.tsx) loads this; without it KaTeX shows its MathML
// fallback alongside the rendered maths and every equation looks doubled
import 'katex/dist/katex.min.css'
import Dashboard from './pages/Dashboard'
import { GenerationProvider } from './lib/generationContext'

// No network in here: every API call answers "offline" so a hung request can
// never be mistaken for a rendering bug.
const real = window.fetch.bind(window)
window.fetch = (async (url: any, init?: any) => {
  const u = String(url)
  if (u.includes('/api/') || u.includes('supabase.co')) {
    return new Response(JSON.stringify({ offline: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return real(url, init)
}) as typeof window.fetch

const profile = { id: 'preview-user', name: 'Preview Student', role: 'student', cls: '10', board: 'CBSE' } as any

createRoot(document.getElementById('root')!).render(
  <GenerationProvider>
    <Dashboard profile={profile} onLogout={() => alert('sign out (preview)')} />
  </GenerationProvider>,
)
