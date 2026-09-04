/**
 * Local preview of the OLD mobile chrome -- dev only, never in the build.
 *
 * Mounts the real MobileShell (top bar, bottom nav, the 32-item drawer) with a
 * fake student profile and no sign-in, so the pre-cutover contract can be
 * checked in a browser: every drawer item still there, "More" still opens it,
 * and the one dull "New design (preview)" row at the very bottom opens #/new.
 * The page area shows the /new index when that row is tapped and a stub for
 * anything else -- the old pages are not the point here.
 *
 * Open http://localhost:3002/shell-preview.html at a phone width.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MobileShell from './components/MobileShell'
import SpaceFrame from './components/SpaceFrame'
import NewIndex from './pages/NewIndex'

function App() {
  const [active, setActive] = useState('home')
  return (
    <div className="kairo-mobile" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#0A0D16', color: '#fafafa', fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}>
      <MobileShell active={active} setActive={setActive} pageTitle={active} isDark toggleTheme={() => {}} profile={{ name: 'Preview Student', role: 'student' } as any} />
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', paddingBottom: 'var(--kyno-nav-clearance)' }}>
        {active === 'new'
          ? <SpaceFrame active="new" onNavigate={setActive}><NewIndex onOpen={setActive} /></SpaceFrame>
          : <div style={{ padding: 20, color: '#9494AD', fontSize: 13 }}>Old page stub: <b style={{ color: '#fafafa' }}>{active}</b>. Open the menu (top left) or "More" (bottom right).</div>}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
