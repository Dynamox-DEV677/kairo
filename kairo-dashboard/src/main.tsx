import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPwa } from './lib/pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: register SW, surface update banner when new version available
initPwa({
  onUpdateAvailable(reload) {
    // Tiny non-blocking banner. Vanilla so it works before React mounts again.
    const bar = document.createElement('div')
    bar.style.cssText = `
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      z-index: 99999; padding: 10px 14px; border-radius: 10px;
      background: #1e1e2e; border: 1px solid #6366f1;
      box-shadow: 0 12px 30px rgba(0,0,0,0.4);
      display: flex; align-items: center; gap: 10px;
      font-family: 'Inter', system-ui, sans-serif; font-size: 13px; color: #fafafa;
    `
    bar.innerHTML = `
      <span>New version of Kairo available</span>
      <button id="kairo-pwa-reload" style="
        padding: 5px 12px; border-radius: 6px; border: none; cursor: pointer;
        background: linear-gradient(135deg,#6366f1,#7c3aed);
        color: #fff; font-family: inherit; font-size: 12px; font-weight: 600;
      ">Reload</button>
      <button id="kairo-pwa-dismiss" style="
        padding: 5px 8px; border-radius: 6px; border: none; cursor: pointer;
        background: transparent; color: #71717a; font-family: inherit; font-size: 12px;
      ">Later</button>
    `
    document.body.appendChild(bar)
    bar.querySelector('#kairo-pwa-reload')?.addEventListener('click', () => reload())
    bar.querySelector('#kairo-pwa-dismiss')?.addEventListener('click', () => bar.remove())
  },
  onOfflineReady() {
    console.log('[Kairo] Ready to use offline.')
  },
})
