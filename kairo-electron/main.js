const { app, BrowserWindow, Menu, shell, ipcMain, nativeTheme } = require('electron')
const path = require('path')
const updater = require('./updater')
const db      = require('./db')

const KAIRO_URL = process.env.KAIRO_URL || 'https://kairo-daily-edu.vercel.app'

const ICON_PATH = path.join(
  __dirname, 'assets',
  process.platform === 'win32' ? 'icon.ico' : 'icon.png',
)

let splashWin = null
let mainWin   = null

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

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Kairo',
    icon: ICON_PATH,
    backgroundColor: '#050505',            
    show: false,                           
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
    updater.attach(mainWin)
  })

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(KAIRO_URL)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWin.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(KAIRO_URL)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })
}

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

ipcMain.handle('kairo:get-version',  () => app.getVersion())
ipcMain.handle('kairo:get-platform', () => process.platform)
ipcMain.handle('kairo:restart-to-update', () => updater.applyAndRestart())

ipcMain.on('kairo:db:get',        (e, key)         => { e.returnValue = db.get(key) })
ipcMain.on('kairo:db:set',        (e, key, value)  => { db.set(key, value); e.returnValue = true })
ipcMain.on('kairo:db:remove',     (e, key)         => { db.remove(key);     e.returnValue = true })
ipcMain.on('kairo:db:list-keys',  (e)              => { e.returnValue = db.listKeys() })
ipcMain.on('kairo:db:ready',      (e)              => { e.returnValue = db.ready() })
ipcMain.on('kairo:db:size',       (e)              => { e.returnValue = db.size() })

ipcMain.handle('kairo:db:query',         (_e, sql, params)   => db.query(sql, params))
ipcMain.handle('kairo:db:insert-event',  (_e, userKey, ev)   => { db.insertEvent(userKey, ev); return true })

nativeTheme.themeSource = 'dark'           

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

app.commandLine.appendSwitch('enable-features', 'CalculateNativeWinOcclusion')
