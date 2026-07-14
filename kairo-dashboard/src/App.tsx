import { useState, useEffect } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Login, { type AuthProfile } from './pages/Login'
import Landing from './pages/Landing'
import { GenerationProvider } from './lib/generationContext'
import { supabase } from './lib/supabase'
import { refreshIfStale } from './lib/api'
import { pullFromCloud, syncToCloudNow, deleteCloudSnapshot, pauseSyncUntil, getSyncEnabled, isOnboarded } from './lib/twin'
import Onboarding from './pages/Onboarding'
import SprintOverlay, { SPRINT_MIN_MS } from './components/SprintOverlay'
import SplashScreen from './components/SplashScreen'
import { TermsHost } from './components/Terms'
import DesktopUpdateBanner from './components/DesktopUpdateBanner'
import DemoModePrompt from './components/DemoModePrompt'
import ResetPasswordPage from './pages/ResetPasswordPage'
import StatusPage from './pages/StatusPage'
import AboutPage from './pages/AboutPage'

type View = 'landing' | 'login' | 'app'

export default function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined' && (window as any).kairoDesktop?.isDesktop) {
      return 'login'
    }
    return 'landing'
  })
  const [resetMode, setResetMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/reset-password'
      && !!new URLSearchParams(window.location.search).get('token')
  })
  const [statusMode, setStatusMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/status'
  })
  const [aboutMode, setAboutMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/about'
  })
  const [onboard, setOnboard] = useState<'checking' | 'open' | 'skipped' | 'done'>('checking')
  const [sprintingIn, setSprintingIn] = useState(false)
  const [sprintHead, setSprintHead]   = useState<string | undefined>()
  const [sprintSub,  setSprintSub]    = useState<string | undefined>()
  const [splashing,  setSplashing]    = useState(() => {
    if (typeof window === 'undefined') return false
    try { return sessionStorage.getItem('kairo:splash:shown') !== '1' }
    catch { return true }
  })

  useEffect(() => {
    const onExpired = () => {
      clearSession()
      setProfile(null)
    }
    window.addEventListener('kairo:auth-expired', onExpired)
    return () => window.removeEventListener('kairo:auth-expired', onExpired)
  }, [])

  useEffect(() => {
    if (!profile || profile.localMode) return
    refreshIfStale()
    const id = setInterval(() => { refreshIfStale() }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [profile])

  useEffect(() => {
    if (!profile || profile.localMode) return
    if (!getSyncEnabled()) return

    if (sessionStorage.getItem('kairo:sync:pulled') === '1') return

    let cancelled = false
    const startedAt = Date.now()

    ;(async () => {
      setSprintHead('Welcome back — pulling your data')
      setSprintSub(`We\'ll have your study history on this device in a moment.`)
      setSprintingIn(true)

      pauseSyncUntil(Date.now() + SPRINT_MIN_MS + 5_000)

      const r = await pullFromCloud()

      const elapsed   = Date.now() - startedAt
      const remaining = Math.max(0, SPRINT_MIN_MS - elapsed)
      await new Promise(res => setTimeout(res, remaining))
      if (cancelled) return

      if (r.ok && r.restored) {
        const wiped = await deleteCloudSnapshot()
        if (!wiped.ok) console.warn('[sync] could not wipe cloud snapshot:', wiped.reason)

        setSprintHead('Your data has arrived.')
        setSprintSub(
          `${r.stats?.events ?? 0} events · ${r.stats?.flashcards ?? 0} flashcards · ${r.stats?.formulas ?? 0} formulas restored.` +
          (wiped.ok ? '  ·  Cloud copy wiped — your data lives only on this device now.' : '')
        )
        await new Promise(res => setTimeout(res, 1200))
      } else if (!r.ok && r.reason !== 'not-signed-in') {
        console.warn('[sync] auto-pull failed:', r.reason)
      }

      if (cancelled) return
      sessionStorage.setItem('kairo:sync:pulled', '1')
      setSprintingIn(false)

      pauseSyncUntil(0)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  useEffect(() => {
    async function restoreSession() {
      const token   = localStorage.getItem('kairo_token')
      const cached  = localStorage.getItem('kairo_profile')

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

      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          let { data: userRow } = await supabase
            .from('users')
            .select('id, name, role, school_id, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle()

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
            try { await supabase.from('users').insert(newRow) } catch {  }
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

  useEffect(() => {
    if (!profile) { if (onboard !== 'checking') setOnboard('checking'); return }
    if (checking || sprintingIn || onboard !== 'checking') return
    try {
      if (isOnboarded()) { setOnboard('done'); return }
      if (sessionStorage.getItem('kairo:onboard:skip') === '1') { setOnboard('skipped'); return }
    } catch {  }
    setOnboard('open')
  }, [profile, checking, sprintingIn, onboard])

  function handleLogin(p: AuthProfile) {
    setOnboard('checking')
    setProfile(p)
  }

  function handleLogout() {
    clearSession()
    setProfile(null)
  }

  const splash = splashing ? (
    <SplashScreen onComplete={() => {
      try { sessionStorage.setItem('kairo:splash:shown', '1') } catch {  }
      setSplashing(false)
    }} />
  ) : null

  if (resetMode) {
    return (
      <>
        <ResetPasswordPage
          onDone={() => {
            try { window.history.replaceState({}, '', '/') } catch {  }
            setResetMode(false)
            setView('login')
          }}
        />
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
      </>
    )
  }

  if (statusMode) {
    return (
      <>
        <StatusPage
          onExit={() => {
            try { window.history.replaceState({}, '', '/') } catch {  }
            setStatusMode(false)
          }}
        />
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
      </>
    )
  }

  if (aboutMode) {
    return (
      <>
        <AboutPage
          onExit={() => {
            try { window.history.replaceState({}, '', '/') } catch {  }
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
      {onboard === 'open' && (
        <Onboarding
          profile={profile}
          onDone={() => setOnboard('done')}
          onSkip={() => { try { sessionStorage.setItem('kairo:onboard:skip', '1') } catch {  }; setOnboard('skipped') }}
        />
      )}
      {onboard === 'skipped' && (
        <button
          onClick={() => setOnboard('open')}
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 95,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 18px', borderRadius: 999, cursor: 'pointer',
            background: 'rgba(13,16,25,0.92)', color: '#fff',
            border: '1px solid rgba(102,217,255,0.4)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(79,124,255,0.25)',
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, fontWeight: 700,
            backdropFilter: 'blur(10px)',
          }}
        >
          ✨ Finish setting up Kyno →
        </button>
      )}
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

