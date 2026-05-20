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
})
