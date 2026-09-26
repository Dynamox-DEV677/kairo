/**
 * Save a file the student asked for -- and report honestly what happened.
 *
 * Kyno on Android is a WebView that ships only the app, browser and core
 * Capacitor plugins: no filesystem, no share plugin. An `<a download>` click
 * there does nothing at all, and the old data export still announced "Saved."
 * So, in order:
 *
 *   1. the share sheet (Web Share with files), where the device offers it --
 *      the one way a file can leave the app without a native plugin;
 *   2. a normal download, in a real browser;
 *   3. otherwise 'unsupported', so the screen can say so instead of lying.
 */
import { Capacitor } from '@capacitor/core'

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'unsupported'

export function isNativeApp(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

export async function saveTextFile(text: string, fileName: string, mime: string): Promise<SaveResult> {
  try {
    const file = new File([text], fileName, { type: mime })
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
    if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: fileName } as ShareData)
        return 'shared'
      } catch (e: any) {
        // Closing the share sheet is a choice, not a failure to fall back from.
        if (e?.name === 'AbortError') return 'cancelled'
        // Anything else (e.g. the tap's user-activation expired): try a download.
      }
    }
  } catch { /* no File constructor or no Web Share: fall through */ }

  // Inside the app a download link is a silent no-op. Say so rather than claim it worked.
  if (isNativeApp()) return 'unsupported'

  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}

/**
 * Open a link outside Kyno. In the Android app that's the in-app browser
 * (the same plugin Google sign-in already uses); on the web, a new tab.
 */
export async function openExternal(url: string): Promise<void> {
  if (isNativeApp()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener')
}
