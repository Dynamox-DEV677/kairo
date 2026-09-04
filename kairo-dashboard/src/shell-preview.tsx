/**
 * Local preview of the mobile chrome -- dev only, never in the build.
 *
 * Mounts the real MobileShell (top bar, bottom bar, drawer) with a fake
 * student profile and no sign-in, so the post-cutover navigation can be
 * checked in a browser: seven drawer groups, four bottom slots, no "More",
 * and every old route landing in the space that absorbed it.
 *
 * Open http://localhost:3002/shell-preview.html at a phone width.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MobileShell from './components/MobileShell'
import { resolveSpace, SPACE_ALIASES } from './lib/spaces.core'

const OLD_ROUTES = Object.keys(SPACE_ALIASES)

function App() {
  const [active, setActive] = useState('home')
  const go = (id: string) => setActive(resolveSpace(id))
  return (
    <div className="kairo-mobile" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#0A0D16', color: '#fafafa', fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}>
      <MobileShell active={active} setActive={go} pageTitle={active} isDark toggleTheme={() => {}} profile={{ name: 'Preview Student', role: 'student' } as any} />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--kyno-nav-clearance)' }}>
        <div style={{ padding: 20, color: '#9494AD', fontSize: 13, lineHeight: 1.6 }}>
          Showing: <b style={{ color: '#fafafa' }}>{active}</b>. Open the menu (top left) for the seven groups.
          <div style={{ marginTop: 18, fontSize: 11, letterSpacing: 1.2, fontWeight: 700, color: '#7C5CFF' }}>REDIRECT CHECK</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Tap an old route; it must land in its space.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {OLD_ROUTES.map(r => (
              <button key={r} onClick={() => go(r)} style={{
                minHeight: 36, padding: '0 10px', borderRadius: 100, cursor: 'pointer',
                background: '#1A1A26', border: '1px solid #2A2A3C', color: '#C9C9DC', fontFamily: 'inherit', fontSize: 12,
              }}>{r} → {SPACE_ALIASES[r]}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
