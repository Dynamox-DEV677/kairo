/**
 * Auto-update logic for the Kairo desktop app.
 *
 * Uses electron-updater, which pulls release metadata from the GitHub
 * repo's Releases page on a 6-hour interval (and once at app start).
 * The flow is:
 *
 *   1. App boots → autoUpdater.checkForUpdates() runs in background.
 *   2. If a newer release exists → installer downloads silently to disk.
 *   3. When download completes → we show a native "Restart to update"
 *      dialog. User clicks Restart → autoUpdater.quitAndInstall() swaps
 *      the app and re-launches the new version.
 *   4. User clicks Later → update sits ready, applied next launch.
 *
 * If the GitHub repo has no releases yet, or the network is offline, the
 * updater fails silently and the app keeps running normally.
 */
const { app, dialog, Notification } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

// Forward updater logs into electron-log so they're visible in
// %APPDATA%/Kairo/logs/main.log without bloating the console.
log.transports.file.level = 'info'
autoUpdater.logger = log

// We download in the background, then prompt — never auto-install without consent.
autoUpdater.autoDownload          = true
autoUpdater.autoInstallOnAppQuit  = false

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000   // 6 hours

let mainWindowRef = null
let updateAvailable = false

function attach(mainWindow) {
  mainWindowRef = mainWindow

  // ── Event handlers ─────────────────────────────────────────────────
  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking for updates…')
  })

  autoUpdater.on('update-available', (info) => {
    updateAvailable = true
    log.info(`[updater] update available: ${info?.version}`)
    if (Notification.isSupported()) {
      new Notification({
        title: 'Kairo update available',
        body:  `Downloading v${info?.version || 'latest'} in the background.`,
      }).show()
    }
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] already on latest version')
  })

  autoUpdater.on('error', (err) => {
    // Common cases: no GitHub releases yet, offline, signature mismatch.
    // None are fatal — keep the app running, log quietly.
    log.warn('[updater] error (silent):', err?.message)
  })

  autoUpdater.on('download-progress', (p) => {
    // Optional: bridge this to the renderer to render a progress bar.
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(p?.percent ? p.percent / 100 : -1)
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] downloaded v${info?.version} — banner sent`)
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(-1)
      // Tell the React app to render the Kairo-branded "Restart to
      // update" banner. The renderer subscribes via
      // window.kairoDesktop.onUpdateReady(handler).
      mainWindowRef.webContents.send('kairo:update-ready', {
        version:     info?.version || 'latest',
        releaseDate: info?.releaseDate || null,
        releaseName: info?.releaseName || null,
      })
    } else {
      // Fallback to a native dialog if the window died for some reason.
      dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart', 'Later'],
        title:   'Kairo update ready',
        message: `Kairo v${info?.version || 'latest'} has been downloaded.`,
      }).then(c => { if (c.response === 0) autoUpdater.quitAndInstall() })
    }
  })

  // ── Initial + periodic checks ──────────────────────────────────────
  // Wait ~5 s after the app boots so the user sees Kairo before any
  // update prompt. Then check every 6 hours while the app is open.
  setTimeout(() => safeCheck(), 5_000)
  setInterval(() => safeCheck(), CHECK_INTERVAL_MS)
}

function safeCheck() {
  // In dev (npm start) electron-updater throws — we only check in packaged builds.
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

// Lets the menu invoke a manual "check for updates" item.
function checkNow() {
  safeCheck()
}

// Called from the IPC handler when the user clicks the banner's
// "Restart" button. Swaps the new build in + relaunches.
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
