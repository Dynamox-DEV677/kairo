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
    onRegisteredSW(_swUrl, r) {
      if (!r) return
      // A PWA that stays open would otherwise never notice a new deploy. Poll for
      // an update periodically and whenever the app is re-foregrounded, so a fresh
      // build (with the latest sync/XP logic) actually reaches every device.
      const check = () => { r.update().catch(() => {}) }
      setInterval(check, 30 * 60 * 1000)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
      }
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker registration failed:', err)
    },
  })
}
