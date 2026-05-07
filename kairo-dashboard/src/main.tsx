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

// PWA: register SW, show full-screen splash when a new version is ready
initPwa({
  onUpdateAvailable(reload) {
    // Full-screen blocking splash — Kairo logo + title + spinning refresh icon.
    // Vanilla DOM so it works even if React is mid-tree and about to swap out.
    const splash = document.createElement('div')
    splash.id = 'kairo-update-splash'
    splash.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: #0a0a0a;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 24px; padding: 32px;
      font-family: 'Inter', system-ui, sans-serif;
      animation: kairo-fade-in 240ms ease-out;
    `
    splash.innerHTML = `
      <style>
        @keyframes kairo-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kairo-spin    { to   { transform: rotate(360deg) } }
        @keyframes kairo-pulse   { 0%,100% { opacity: 0.85 } 50% { opacity: 1 } }
      </style>

      <img src="/kairo_logo.png" alt="Kairo"
           style="width: 96px; height: 96px; border-radius: 22px;
                  box-shadow: 0 0 50px rgba(99,102,241,0.45);
                  animation: kairo-pulse 1.6s ease-in-out infinite;" />

      <div style="text-align: center;">
        <div style="font-size: 30px; font-weight: 800; color: #fafafa;
                    letter-spacing: -1px; line-height: 1;">kairo</div>
        <div style="font-size: 11px; font-weight: 700; color: #6366f1;
                    letter-spacing: 6px; margin-top: 10px;">
          ACCELERATE YOUR ACADEMICS
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
             style="animation: kairo-spin 0.9s linear infinite;">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span style="font-size: 13px; color: #a1a1aa; font-weight: 500;">
          Updating to the latest version…
        </span>
      </div>
    `
    document.body.appendChild(splash)

    // Trigger the actual reload after the splash has rendered for a beat
    requestAnimationFrame(() => setTimeout(() => reload(), 600))
  },
  onOfflineReady() {
    console.log('[Kairo] Ready to use offline.')
  },
})
