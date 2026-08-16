import { registerSW } from 'virtual:pwa-register'

let deferredInstallPrompt: any = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstallPrompt = e
  window.dispatchEvent(new CustomEvent('kairo:pwa-installable'))
})

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null
  window.dispatchEvent(new CustomEvent('kairo:pwa-installed'))
})

export function isInstallable(): boolean {
  return !!deferredInstallPrompt
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable'
  deferredInstallPrompt.prompt()
  const choice = await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  return choice.outcome
}

export function initPwa(opts?: {
  onUpdateAvailable?: (reload: () => void) => void
  onOfflineReady?: () => void
}) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      opts?.onUpdateAvailable?.(() => updateSW(true))
    },
    onOfflineReady() {
      opts?.onOfflineReady?.()
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker registration failed:', err)
    },
  })

  // C26 — offline shell WITHOUT the Workbox build.
  //
  // VitePWA is deliberately disabled on Vercel (workbox precache generation
  // blows the Hobby tier's build memory — see vite.config.ts), which meant
  // production shipped with no offline support at all. /kyno-sw.js is a
  // 60-line dependency-free worker: cache-first for hashed assets,
  // network-first shell, never touches /api/*. The student's own content
  // (twin, reels, formulas, notes) is localStorage and already offline.
  //
  // Registered ONLY when the real plugin is stubbed out, so the two systems
  // can never fight over the page. Flipping ENABLE_PWA=true hands control
  // back to Workbox untouched. Different filename on purpose: VitePWA's
  // generated worker is also called sw.js.
  const workboxActive = registerSW.toString().includes('serviceWorker')
  if (!workboxActive && 'serviceWorker' in navigator && !import.meta.env.DEV) {
    navigator.serviceWorker.register('/kyno-sw.js').then(
      () => opts?.onOfflineReady?.(),
      (err) => console.warn('[PWA] fallback service worker failed:', err),
    )
  }
}
