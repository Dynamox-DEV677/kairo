/**
 * Preload — runs in an isolated context BEFORE the Kairo web app loads.
 * Bridges a tiny, safe API into the renderer via window.kairoDesktop.
 *
 * We only expose what's strictly needed: app version + platform string.
 * Everything else flows through normal web APIs (Supabase auth, etc.)
 * so the web build and the desktop build stay identical in behaviour.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kairoDesktop', {
  isDesktop: true,
  getVersion:  () => ipcRenderer.invoke('kairo:get-version'),
  getPlatform: () => ipcRenderer.invoke('kairo:get-platform'),

  // ── Auto-update flow ────────────────────────────────────────────────
  // The main process fires 'kairo:update-ready' when an installer has
  // finished downloading. The web app subscribes via onUpdateReady() and
  // shows a Kairo-styled banner instead of the native OS dialog.
  // Click the banner's "Restart" button → restartToUpdate() → main does
  // autoUpdater.quitAndInstall().
  onUpdateReady: (handler) => {
    const fn = (_event, info) => handler(info)
    ipcRenderer.on('kairo:update-ready', fn)
    return () => ipcRenderer.removeListener('kairo:update-ready', fn)
  },
  restartToUpdate: () => ipcRenderer.invoke('kairo:restart-to-update'),
})
