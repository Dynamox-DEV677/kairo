# Kairo · Desktop

Native desktop wrapper around the Kairo web app — built on Electron.

The codebase ships as **one** Kairo experience: the same React + Vite
front-end runs on the web, in a PWA, and inside this Electron shell. The
desktop version adds:

- **Native window chrome** (no browser tab, no URL bar)
- **Always-dark theme** at the OS level so there's no white-flash on
  cold start
- **Persistent session** (login + Twin cookies survive restarts)
- **Out-of-app links** open in the system browser, not inside Kairo
- **Splash screen** during the ~2 s the web app takes to load

The Electron shell does NOT duplicate any Kairo logic — it just loads
`https://kairo-daily-edu.vercel.app` (or whatever `KAIRO_URL` points at).

---

## Quick start

From this directory:

```
npm install        # installs Electron + electron-builder (one-time, ~200 MB)
npm start          # opens the Kairo desktop app
```

To point at a local Vite dev server instead of production:

```
# In one terminal:
cd ../kairo-dashboard && npm run dev

# In another:
KAIRO_URL=http://localhost:3002 npm start
```

---

## Build an installer

```
npm run dist:win       # Windows .exe + portable .exe in dist/
npm run dist:mac       # macOS .dmg + .zip (run on a Mac)
npm run dist:linux     # Linux AppImage + .deb
```

Output goes to `dist/`. The Windows installer is NSIS — users get a
proper "Kairo Setup.exe" with shortcut creation.

---

## Files

```
kairo-electron/
├── main.js          Electron main process — owns the windows
├── preload.js       Tiny IPC bridge exposed as window.kairoDesktop
├── splash.html      The Apple-style splash you see for ~2 s on boot
├── package.json     Deps + electron-builder config
└── assets/
    ├── icon.png         1024×1024 master — used by Mac + Linux
    ├── icon-512.png
    ├── icon-256.png
    └── icon.ico         multi-resolution Windows icon
```

Regenerate icons:

```
cd ..
python tools/make_kairo_icons.py
```

That script also rewrites the PWA icons in `kairo-dashboard/public/`.
