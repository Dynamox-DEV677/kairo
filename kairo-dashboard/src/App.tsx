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
    if (typeof window === 'undefined') return 'landing'
    const w = window as any
    const isApp = !!w.kairoDesktop?.isDesktop
      || !!w.matchMedia?.('(display-mode: standalone)')?.matches
      || !!w.matchMedia?.('(display-mode: fullscreen)')?.matches
      || w.navigator?.standalone === true
      || (typeof document !== 'undefined' && document.referrer.startsWith('android-app://'))
    return isApp ? 'login' : 'landing'
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
          scopeLocalToUser(freshProfile.id)
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
      const id = profile.id || ''
      if (localStorage.getItem('kairo:onboarded:' + id) === '1' || isOnboarded()) { setOnboard('done'); return }
      if (localStorage.getItem('kairo:onboard:hide:' + id) === '1') { setOnboard('done'); return }
      if (localStorage.getItem('kairo:onboard:skip:' + id) === '1') { setOnboard('skipped'); return }
    } catch {  }
    setOnboard('open')
  }, [profile, checking, sprintingIn, onboard])

  function handleLogin(p: AuthProfile) {
    scopeLocalToUser(p.id)
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
            border: '2px solid #1f2532', borderTopColor: '#A5B4FC',
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
          onDone={() => { try { localStorage.setItem('kairo:onboarded:' + (profile.id || ''), '1'); window.dispatchEvent(new Event('kairo:profile')) } catch {  }; setOnboard('done') }}
          onSkip={() => { try { localStorage.setItem('kairo:onboard:skip:' + (profile.id || ''), '1') } catch {  }; setOnboard('skipped') }}
        />
      )}
      {onboard === 'skipped' && (
        <div style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 95,
          display: 'flex', alignItems: 'stretch', borderRadius: 999, overflow: 'hidden',
          background: 'rgba(13,16,25,0.92)', border: '1px solid rgba(165,180,252,0.4)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(124,107,246,0.25)',
          backdropFilter: 'blur(10px)', fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          <button
            onClick={() => setOnboard('open')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 10px 11px 18px', cursor: 'pointer',
              background: 'transparent', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            ✨ Finish setting up Kyno →
          </button>
          <button
            onClick={() => { try { localStorage.setItem('kairo:onboard:hide:' + (profile.id || ''), '1') } catch {  }; setOnboard('done') }}
            title="Don't remind me again" aria-label="Dismiss"
            style={{
              padding: '0 14px', cursor: 'pointer', color: '#9CA3AF',
              background: 'transparent', border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.12)',
              fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
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

function scopeLocalToUser(uid?: string | null) {
  if (!uid || typeof window === 'undefined') return
  try {
    const last = localStorage.getItem('kairo:last_uid')
    if (last !== uid) {
      const keep = new Set(['kairo_token', 'kairo_profile', 'kairo_refresh'])
      Object.keys(localStorage).forEach(k => {
        if (/^kairo[:_]/.test(k) && !keep.has(k)) localStorage.removeItem(k)
      })
    }
    localStorage.setItem('kairo:last_uid', uid)
  } catch {  }
}

