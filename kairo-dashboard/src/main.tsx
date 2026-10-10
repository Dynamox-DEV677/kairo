import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Bundled rather than the jsdelivr <link>: hashed into /assets/, so the
// offline service worker caches it and math stays styled with no network.
import 'katex/dist/katex.min.css'
import App from './App.tsx'
import { initPwa } from './lib/pwa'
import { migrateStorage } from './lib/storage'
import { runKnowledgeCleanup } from './lib/twin'

/* Runs before anything reads storage. Renames the legacy kairo:* / kairo_*
   keys to kyno:*, strips the access_token and refresh_token that were being
   kept inside the profile blob, drops the dead second Supabase project's key,
   and frees the two oversized chat caches. Idempotent — real work happens
   once per device. */
migrateStorage()   // v2 also clears every remaining kairo:* key, kairo:font included

// Phase 2.4: repairs knowledge-graph data already on this device — the "Ai"
// node, the "General" tags, split topic rows, duplicate formulas, and chat
// commands stored as doubts. Guarded to run once, and it never throws: a failed
// cleanup leaves the messy data in place, which beats an app that won't start.
runKnowledgeCleanup()

/* ── Portrait lock (phones only) ──────────────────────────────────────────
   The layout is designed for a tall phone screen; rotating to landscape
   squashes it. Tablets and desktops are left alone — they have the room.
   Done in JS rather than the Android manifest so it ships with a normal
   deploy instead of needing a new Play release.                            */
function lockPortraitOnPhones() {
  const isPhone = Math.min(window.screen.width, window.screen.height) < 600
    && /Android|iPhone|iPod/i.test(navigator.userAgent)
  if (!isPhone) return

  const orientation: any = (screen as any)?.orientation
  orientation?.lock?.('portrait').catch(() => {
    // Browsers only allow lock() in fullscreen/installed contexts. When it is
    // refused, fall back to a CSS overlay so the squashed layout is never what
    // the student sees.
    document.documentElement.classList.add('kyno-needs-portrait')
  })
}
try { lockPortraitOnPhones() } catch {  }

const REPORT_THROTTLE_MS = 5000
let lastReportTs = 0
function reportError(msg: string, extras: Record<string, any> = {}) {
  const now = Date.now()
  if (now - lastReportTs < REPORT_THROTTLE_MS) return
  lastReportTs = now
  fetch('/api/ops/error', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message:    msg,
      page:       location.pathname + location.hash,
      userAgent:  navigator.userAgent.slice(0, 200),
      ...extras,
    }),
  }).catch(() => {  })
}
window.addEventListener('error', (e) => {
  reportError(e.message || 'window.error', {
    source: e.filename, line: e.lineno, col: e.colno,
    stack:  e.error?.stack,
  })
})
window.addEventListener('unhandledrejection', (e: any) => {
  const reason = e?.reason
  reportError('Unhandled rejection: ' + (reason?.message || String(reason).slice(0, 200)), {
    stack: reason?.stack,
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/* ── New versions ──────────────────────────────────────────────────────────
   Found while the app is still opening, before the student has touched
   anything: apply it at once, so opening Kyno means opening the latest Kyno.
   Found later -- the window has been open a while -- it waits for a tap on a
   small bar. Reloading by itself mid-session could throw away a mock test.

   Never a full-screen splash again: the old "Updating…" screen auto-reloaded,
   and a stuck service worker trapped students on it. The bar covers nothing,
   and the automatic path runs at most once per session.                    */
const bootAt = Date.now()
let touched = false
for (const ev of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(ev, () => { touched = true }, { capture: true, once: true })
}

function showUpdateBar(reload: () => void) {
  if (document.getElementById('kyno-update-bar')) return
  const bar = document.createElement('div')
  bar.id = 'kyno-update-bar'
  bar.setAttribute('role', 'status')
  bar.style.cssText = `
    position: fixed; left: 50%; transform: translateX(-50%); z-index: 99999;
    top: calc(10px + env(safe-area-inset-top, 0px));
    display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 24px);
    padding: 8px 8px 8px 16px; border-radius: 14px;
    background: #15151F; border: 1px solid #2A2A3C; box-shadow: 0 12px 34px rgba(0,0,0,0.5);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 13.5px; color: #EDEDF5;
  `
  const label = document.createElement('span')
  label.textContent = 'A new version of Kyno is ready.'
  const go = document.createElement('button')
  go.textContent = 'Reload'
  go.style.cssText = 'border:none;border-radius:10px;padding:8px 14px;background:#7C5CFF;color:#fff;font:inherit;font-weight:700;cursor:pointer'
  go.onclick = () => {
    go.textContent = 'Reloading…'
    go.disabled = true
    reload()
    // If the new worker never takes over, a plain reload still beats a dead button.
    setTimeout(() => location.reload(), 4000)
  }
  const close = document.createElement('button')
  close.textContent = '×'
  close.setAttribute('aria-label', 'Later')
  close.style.cssText = 'border:none;background:none;color:#9494AD;font-size:20px;line-height:1;padding:4px 8px;cursor:pointer'
  close.onclick = () => bar.remove()
  bar.append(label, go, close)
  document.body.appendChild(bar)
}

initPwa({
  onUpdateAvailable(reload) {
    let triedThisSession = false
    try { triedThisSession = sessionStorage.getItem('kyno:auto-updated') === '1' } catch { /* storage blocked */ }
    if (!touched && Date.now() - bootAt < 10_000 && !triedThisSession) {
      try { sessionStorage.setItem('kyno:auto-updated', '1') } catch { /* storage blocked */ }
      reload()
      // Still here after a few seconds? The worker is stuck: offer the bar.
      setTimeout(() => showUpdateBar(reload), 5000)
      return
    }
    showUpdateBar(reload)
  },
  onOfflineReady() {
    console.log('[Kyno] Ready to use offline.')
  },
})
