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
}
