import { useState, useEffect } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Login, { type AuthProfile } from './pages/Login'
import Landing from './pages/Landing'
import { GenerationProvider } from './lib/generationContext'
import { supabase } from './lib/supabase'
import { refreshIfStale } from './lib/api'
import { pullFromCloud, syncToCloudNow, deleteCloudSnapshot, pauseSyncUntil, getSyncEnabled } from './lib/twin'
import SprintOverlay, { SPRINT_MIN_MS } from './components/SprintOverlay'
import SplashScreen from './components/SplashScreen'
import { TermsHost } from './components/Terms'
import DesktopUpdateBanner from './components/DesktopUpdateBanner'
import DemoModePrompt from './components/DemoModePrompt'
import ResetPasswordPage from './pages/ResetPasswordPage'
import StatusPage from './pages/StatusPage'
import AboutPage from './pages/AboutPage'

// "landing" = cinematic marketing page (default for new visitors)
// "login"   = sign-in / sign-up flow
// "app"     = logged-in dashboard
type View = 'landing' | 'login' | 'app'

export default function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [checking, setChecking] = useState(true)
  // Default view: web visitors land on the cinematic marketing page; users
  // running inside the Electron desktop shell skip straight to sign-in
  // (there's no point selling them on Kyno — they already downloaded it).
  // window.kairoDesktop is exposed by kairo-electron/preload.js.
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined' && (window as any).kairoDesktop?.isDesktop) {
      return 'login'
    }
    return 'landing'
  })
  // Email-link landing: /reset-password?token=... — shown above everything else.
  const [resetMode, setResetMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/reset-password'
      && !!new URLSearchParams(window.location.search).get('token')
  })
  // Public status page at /status — no auth required, shown above app shell.
  const [statusMode, setStatusMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/status'
  })
  // Public About / founder page at /about.
  const [aboutMode, setAboutMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/about'
  })
  const [sprintingIn, setSprintingIn] = useState(false)
  const [sprintHead, setSprintHead]   = useState<string | undefined>()
  const [sprintSub,  setSprintSub]    = useState<string | undefined>()
  // Once-per-session splash gate. Stays mounted until onComplete fires
  // so the boot animation plays before anything else renders.
  const [splashing,  setSplashing]    = useState(() => {
    if (typeof window === 'undefined') return false
    try { return sessionStorage.getItem('kairo:splash:shown') !== '1' }
    catch { return true }
  })

  // Listen for auth-expired (refresh token died) — bounce to login screen
  useEffect(() => {
    const onExpired = () => {
      clearSession()
      setProfile(null)
    }
    window.addEventListener('kairo:auth-expired', onExpired)
    return () => window.removeEventListener('kairo:auth-expired', onExpired)
  }, [])

  // Background refresh every 10 minutes so tokens never expire while you work
  useEffect(() => {
    if (!profile || profile.localMode) return
    refreshIfStale()
    const id = setInterval(() => { refreshIfStale() }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [profile])

  // Cross-device auto-pull: when a fresh login lands on a device that has no
  // local Twin yet, pull the snapshot from the cloud and play the sprint
  // animation so the moment feels intentional.
  useEffect(() => {
    if (!profile || profile.localMode) return
    // Sync is on by default — twin data follows you across devices.
    // Users can opt out from Settings if they prefer local-only.
    if (!getSyncEnabled()) return

    // Skip if we've already auto-pulled in this session
    if (sessionStorage.getItem('kairo:sync:pulled') === '1') return

    let cancelled = false
    const startedAt = Date.now()

    ;(async () => {
      // Show the overlay optimistically so the user sees activity immediately.
      setSprintHead('Welcome back — pulling your data')
      setSprintSub(`We\'ll have your study history on this device in a moment.`)
      setSprintingIn(true)

      // Pause any auto-uploads during the pull so we don't race against
      // the inbound data with a stale push from this fresh device.
      pauseSyncUntil(Date.now() + SPRINT_MIN_MS + 5_000)

      const r = await pullFromCloud()

      // Hold the animation a minimum SPRINT_MIN_MS so it doesn't feel glitchy.
      const elapsed   = Date.now() - startedAt
      const remaining = Math.max(0, SPRINT_MIN_MS - elapsed)
      await new Promise(res => setTimeout(res, remaining))
      if (cancelled) return

      if (r.ok && r.restored) {
        // Wipe the cloud copy now that the data has safely landed locally.
        // Privacy-by-default: the server only holds your snapshot during transit.
        const wiped = await deleteCloudSnapshot()
        if (!wiped.ok) console.warn('[sync] could not wipe cloud snapshot:', wiped.reason)

        setSprintHead('Your data has arrived.')
        setSprintSub(
          `${r.stats?.events ?? 0} events · ${r.stats?.flashcards ?? 0} flashcards · ${r.stats?.formulas ?? 0} formulas restored.` +
          (wiped.ok ? '  ·  Cloud copy wiped — your data lives only on this device now.' : '')
        )
        await new Promise(res => setTimeout(res, 1200))
      } else if (!r.ok && r.reason !== 'not-signed-in') {
        // Soft-fail — just dismiss the overlay
        console.warn('[sync] auto-pull failed:', r.reason)
      }

      if (cancelled) return
      sessionStorage.setItem('kairo:sync:pulled', '1')
      setSprintingIn(false)

      // Allow uploads again — the next change on this device will create a
      // fresh server-side snapshot for the next device hop.
      pauseSyncUntil(0)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // On mount — try to restore session from localStorage
  useEffect(() => {
    async function restoreSession() {
      const token   = localStorage.getItem('kairo_token')
      const cached  = localStorage.getItem('kairo_profile')

      // Local Quick Start profile — no token, no backend call needed
      if (!token && cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed?.localMode || parsed?.name) {
            setProfile(parsed)
            setChecking(false)
            return
          }
        } catch {}
      }

      // Validate session via Supabase directly — no backend needed
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          // maybeSingle() — no 406 when the row doesn't exist (auth user
          // without a public.users profile, e.g. legacy or partial-signup).
          let { data: userRow } = await supabase
            .from('users')
            .select('id, name, role, school_id, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle()

          // First-time OAuth (Google) accounts arrive with a session but no
          // public.users row — provision one so the rest of the app works.
          if (!userRow) {
            const meta: any = session.user.user_metadata || {}
            const fallbackName = meta.full_name || meta.name
              || session.user.email?.split('@')[0] || 'Kyno Student'
            const newRow = {
              id:         session.user.id,
              name:       fallbackName,
              role:       'student',
              school_id:  null as any,
              avatar_url: meta.avatar_url || meta.picture || null,
            }
            try { await supabase.from('users').insert(newRow) } catch { /* RLS may block */ }
            userRow = newRow as any
          }

          let school: any = null
          if (userRow?.school_id) {
            const { data: s } = await supabase
              .from('schools')
              .select('id, school_name, school_logo_url, school_email, plan')
              .eq('id', userRow.school_id)
              .maybeSingle()
            school = s
          }

          // Keep locally-edited extras (board/cls from Settings) that the
          // users table doesn't store — otherwise a refresh wipes them.
          let cachedExtras: any = {}
          try { cachedExtras = cached ? JSON.parse(cached) : {} } catch {}

          const freshProfile: AuthProfile = {
            ...(cachedExtras.board ? { board: cachedExtras.board } : {}),
            ...(cachedExtras.cls   ? { cls:   cachedExtras.cls }   : {}),
            id:              userRow?.id              || session.user.id,
            name:            userRow?.name            || session.user.email || '',
            role:            userRow?.role            || 'student',
            avatar_url:      userRow?.avatar_url,
            school_id:       userRow?.school_id,
            school_name:     school?.school_name,
            school_logo_url: school?.school_logo_url,
            school_email:    school?.school_email,
            plan:            school?.plan,
            access_token:    session.access_token,
            refresh_token:   session.refresh_token,
          }
          localStorage.setItem('kairo_profile', JSON.stringify(freshProfile))
          setProfile(freshProfile)
        } else if (cached) {
          try { setProfile(JSON.parse(cached)) } catch { clearSession() }
        } else {
          clearSession()
        }
      } catch {
        if (cached) {
          try { setProfile(JSON.parse(cached)) } catch { clearSession() }
        } else {
          clearSession()
        }
      } finally {
        setChecking(false)
      }
    }
    restoreSession()
  }, [])

  function handleLogin(p: AuthProfile) {
    setProfile(p)
  }

  function handleLogout() {
    clearSession()
    setProfile(null)
  }

  // The splash is rendered alongside every branch — it portals to body
  // with z-index 99999 so it covers whatever the rest of the tree renders.
  // Once it completes we drop the flag so subsequent re-renders skip it.
  const splash = splashing ? (
    <SplashScreen onComplete={() => {
      try { sessionStorage.setItem('kairo:splash:shown', '1') } catch { /* ignore */ }
      setSplashing(false)
    }} />
  ) : null

  // Reset-password landing takes precedence over everything — even before
  // session restore — because the user came here from an email link and
  // shouldn't be bounced to the dashboard if they happen to have a session.
  if (resetMode) {
    return (
      <>
        <ResetPasswordPage
          onDone={() => {
            try { window.history.replaceState({}, '', '/') } catch { /* ignore */ }
            setResetMode(false)
            setView('login')   // drop straight onto the sign-in screen
          }}
        />
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
      </>
    )
  }

  // Public /status page — also stands above session restore so anyone can
  // load it (incidents are when you can't sign in anyway).
  if (statusMode) {
    return (
      <>
        <StatusPage
          onExit={() => {
            try { window.history.replaceState({}, '', '/') } catch { /* ignore */ }
            setStatusMode(false)
          }}
        />
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
      </>
    )
  }

  // Public /about — founder bio / colophon page.
  if (aboutMode) {
    return (
      <>
        <AboutPage
          onExit={() => {
            try { window.history.replaceState({}, '', '/') } catch { /* ignore */ }
            setAboutMode(false)
          }}
        />
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
      </>
    )
  }

  if (checking) {
    return (
      <>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#050505',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '2px solid #1f2532', borderTopColor: '#66D9FF',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
        {splash}
      </>
    )
  }

  if (!profile) {
    return (
      <>
        {view === 'login'
          ? <Login onLogin={handleLogin} />
          : <Landing onGetStarted={() => setView('login')} />}
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
        {splash}
      </>
    )
  }

  return (
    <GenerationProvider>
      <Dashboard profile={profile} onLogout={handleLogout} />
      <SprintOverlay
        open={sprintingIn}
        banner="Welcome back"
        headline={sprintHead}
        subhead={sprintSub}
      />
      <TermsHost />
      <DesktopUpdateBanner />
      {splash}
    </GenerationProvider>
  )
}

function clearSession() {
  localStorage.removeItem('kairo_token')
  localStorage.removeItem('kairo_refresh')
  localStorage.removeItem('kairo_profile')
}

