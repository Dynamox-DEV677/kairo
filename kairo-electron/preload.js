const { contextBridge, ipcRenderer } = require('electron')

let _dbReady = false
try { _dbReady = ipcRenderer.sendSync('kairo:db:ready') === true } catch {  }

const dbBridge = _dbReady ? {
  getSync:      (key)         => {
    try { return ipcRenderer.sendSync('kairo:db:get', String(key)) ?? null }
    catch { return null }
  },
  setSync:      (key, value)  => {
    try { ipcRenderer.sendSync('kairo:db:set', String(key), String(value)) }
    catch {  }
  },
  removeSync:   (key)         => {
    try { ipcRenderer.sendSync('kairo:db:remove', String(key)) }
    catch {  }
  },
  listKeysSync: ()            => {
    try { return ipcRenderer.sendSync('kairo:db:list-keys') || [] }
    catch { return [] }
  },
  size:         ()            => {
    try { return ipcRenderer.sendSync('kairo:db:size') || 0 }
    catch { return 0 }
  },

  query:        async (sql, params) => {
    try { return await ipcRenderer.invoke('kairo:db:query', String(sql), params ?? []) }
    catch (e) { return { ok: false, error: String(e?.message || e), rows: [] } }
  },
  insertEvent:  async (userKey, ev) => {
    try { return await ipcRenderer.invoke('kairo:db:insert-event', String(userKey), ev) }
    catch { return false }
  },
} : undefined

contextBridge.exposeInMainWorld('kairoDesktop', {
  isDesktop: true,
  getVersion:  () => ipcRenderer.invoke('kairo:get-version'),
  getPlatform: () => ipcRenderer.invoke('kairo:get-platform'),
  db:          dbBridge,

  onUpdateDownloading: (handler) => {
    const fn = (_event, info) => handler(info)
    ipcRenderer.on('kairo:update-downloading', fn)
    return () => ipcRenderer.removeListener('kairo:update-downloading', fn)
  },
  onUpdateReady: (handler) => {
    const fn = (_event, info) => handler(info)
    ipcRenderer.on('kairo:update-ready', fn)
    return () => ipcRenderer.removeListener('kairo:update-ready', fn)
  },
  restartToUpdate: () => ipcRenderer.invoke('kairo:restart-to-update'),
})
