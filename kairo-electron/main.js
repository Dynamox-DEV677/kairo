/**
 * Kairo · Desktop (Electron main process)
 *
 * Wraps https://kairo-daily-edu.vercel.app inside a native window.
 *
 *   npm install        # one-time
 *   npm start          # launches the app
 *   npm run dist:win   # builds a Windows installer in dist/
 *
 * Override the URL with KAIRO_URL=… in your env to point at a staging or
 * local build. Useful for testing the desktop chrome without redeploying.
 */
const { app, BrowserWindow, Menu, shell, ipcMain, nativeTheme } = require('electron')
const path = require('path')
const updater = require('./updater')
const db      = require('./db')

// Default to production. Override via env when iterating against a local Vite dev server.
const KAIRO_URL = process.env.KAIRO_URL || 'https://kairo-daily-edu.vercel.app'

const ICON_PATH = path.join(
  __dirname, 'assets',
  process.platform === 'win32' ? 'icon.ico' : 'icon.png',
)

let splashWin = null
let mainWin   = null

// ─── Splash screen ─────────────────────────────────────────────────────────
// A small frameless window that shows the Kairo mark on dark for the ~2s
// the main window needs to load. Kills the "white flash of unstyled HTML"
// that Electron windows get on cold start.
function createSplash() {
  splashWin = new BrowserWindow({
    width: 380,
    height: 380,
    frame: false,
    transparent: false,
    backgroundColor: '#050505',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  splashWin.loadFile(path.join(__dirname, 'splash.html'))
  splashWin.once('ready-to-show', () => splashWin.show())
}

// ─── Main window ───────────────────────────────────────────────────────────
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Kairo',
    icon: ICON_PATH,
    backgroundColor: '#050505',            // no white flash before the page paints
    show: false,                           // unhide once content is ready
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Persistent session so login + Twin cookies survive restarts.
      partition: 'persist:kairo',
    },
  })

  mainWin.loadURL(KAIRO_URL)

  mainWin.webContents.once('did-finish-load', () => {
    mainWin.show()
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.close()
      splashWin = null
    }
    // Hook the shell-update layer once the main window is alive.
    // (Web app updates are already automatic — this only handles new
    // versions of the Electron wrapper itself: splash, menu, this code.)
    updater.attach(mainWin)
  })

  // External links — open in the user's real browser, not inside the app.
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(KAIRO_URL)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Trap navigation away from Kairo — open externally instead.
  mainWin.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(KAIRO_URL)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })
}

// ─── Menu ──────────────────────────────────────────────────────────────────
// Minimal — keep app native on Mac (with default mac menu), zero menu on
// Windows / Linux so the chrome is as quiet as possible.
function configureMenu() {
  if (process.platform === 'darwin') {
    const template = [
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      {
        label: 'Kairo',
        submenu: [
          { label: 'Open kairo-daily-edu.vercel.app', click: () => shell.openExternal(KAIRO_URL) },
          { type: 'separator' },
          { label: 'Reload Kairo',         accelerator: 'CmdOrCtrl+R',     click: () => mainWin?.reload() },
          { label: 'Check for updates…',                                    click: () => updater.checkNow() },
          { label: 'Toggle Dev Tools',     accelerator: 'CmdOrCtrl+Alt+I', click: () => mainWin?.webContents.toggleDevTools() },
        ],
      },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  } else {
    Menu.setApplicationMenu(null)
  }
}

// ─── IPC (minimal) ─────────────────────────────────────────────────────────
ipcMain.handle('kairo:get-version',  () => app.getVersion())
ipcMain.handle('kairo:get-platform', () => process.platform)
// Banner's "Restart" button → swap to the new binary + relaunch.
ipcMain.handle('kairo:restart-to-update', () => updater.applyAndRestart())

// ─── SQLite Protocol — Phase II ────────────────────────────────────────────
// Synchronous IPC channels for storage.ts. We use `ipcMain.on(..., e => { e.returnValue = ... })`
// so the renderer can call `ipcRenderer.sendSync(...)` and treat the DB as a
// drop-in replacement for localStorage's synchronous API. Payloads are small
// (KV strings), so the renderer block is sub-millisecond in practice.
ipcMain.on('kairo:db:get',        (e, key)         => { e.returnValue = db.get(key) })
ipcMain.on('kairo:db:set',        (e, key, value)  => { db.set(key, value); e.returnValue = true })
ipcMain.on('kairo:db:remove',     (e, key)         => { db.remove(key);     e.returnValue = true })
ipcMain.on('kairo:db:list-keys',  (e)              => { e.returnValue = db.listKeys() })
ipcMain.on('kairo:db:ready',      (e)              => { e.returnValue = db.ready() })
ipcMain.on('kairo:db:size',       (e)              => { e.returnValue = db.size() })

// SQLITE PROTOCOL — PHASE III · relational query API (async, since SQL can
// take longer than a sub-ms KV read). Read-only and write-keyword-checked
// inside db.query().
ipcMain.handle('kairo:db:query',         (_e, sql, params)   => db.query(sql, params))
ipcMain.handle('kairo:db:insert-event',  (_e, userKey, ev)   => { db.insertEvent(userKey, ev); return true })

// ─── App lifecycle ─────────────────────────────────────────────────────────
nativeTheme.themeSource = 'dark'           // always-dark window chrome

app.whenReady().then(() => {
  configureMenu()
  createSplash()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplash()
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Hardware-accelerated rendering ────────────────────────────────────────
// Some old Windows GPUs choke on Chromium's GPU compositor. Comment out the
// next line if you see black/blank windows after install.
app.commandLine.appendSwitch('enable-features', 'CalculateNativeWinOcclusion')
