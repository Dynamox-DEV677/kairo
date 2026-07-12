const { app, dialog, Notification } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

log.transports.file.level = 'info'
autoUpdater.logger = log

autoUpdater.autoDownload          = true
autoUpdater.autoInstallOnAppQuit  = false

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let mainWindowRef = null
let updateAvailable = false

function attach(mainWindow) {
  mainWindowRef = mainWindow

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking for updates…')
  })

  autoUpdater.on('update-available', (info) => {
    updateAvailable = true
    log.info(`[updater] update available: ${info?.version}`)
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('kairo:update-downloading', {
        version:  info?.version || 'latest',
        percent:  0,
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] already on latest version')
  })

  autoUpdater.on('error', (err) => {
    log.warn('[updater] error (silent):', err?.message)
  })

  autoUpdater.on('download-progress', (p) => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(p?.percent ? p.percent / 100 : -1)
      mainWindowRef.webContents.send('kairo:update-downloading', {
        version:  null,
        percent:  Math.round(p?.percent ?? 0),
        bytesPerSecond:  p?.bytesPerSecond ?? 0,
        transferred:     p?.transferred ?? 0,
        total:           p?.total ?? 0,
      })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] downloaded v${info?.version} — banner sent`)
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(-1)
      mainWindowRef.webContents.send('kairo:update-ready', {
        version:     info?.version || 'latest',
        releaseDate: info?.releaseDate || null,
        releaseName: info?.releaseName || null,
      })
    } else {
      dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart', 'Later'],
        title:   'Kairo update ready',
        message: `Kairo v${info?.version || 'latest'} has been downloaded.`,
      }).then(c => { if (c.response === 0) autoUpdater.quitAndInstall() })
    }
  })

  setTimeout(() => safeCheck(), 5_000)
  setInterval(() => safeCheck(), CHECK_INTERVAL_MS)
}

function safeCheck() {
  if (!app.isPackaged) {
    log.info('[updater] skipped — running unpackaged dev build')
    return
  }
  try {
    autoUpdater.checkForUpdates().catch(err => {
      log.warn('[updater] checkForUpdates rejected:', err?.message)
    })
  } catch (e) {
    log.warn('[updater] check failed:', e?.message)
  }
}

function checkNow() {
  safeCheck()
}

function applyAndRestart() {
  try {
    autoUpdater.quitAndInstall()
  } catch (e) {
    log.warn('[updater] quitAndInstall failed:', e?.message)
  }
}

function isUpdateAvailable() {
  return updateAvailable
}

module.exports = { attach, checkNow, applyAndRestart, isUpdateAvailable }
