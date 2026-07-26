import { useState, useEffect, lazy, Suspense } from 'react'
import './index.css'
// Lazy: the dashboard pulls in every page (plus three.js and the markdown stack).
// Loading it eagerly meant ~3MB of JS before a user could even sign in.
const Dashboard = lazy(() => import('./pages/Dashboard'))
import Login, { type AuthProfile } from './pages/Login'
import { GenerationProvider } from './lib/generationContext'
import { supabase } from './lib/supabase'
import { refreshIfStale } from './lib/api'
import { peekCloudSnapshot, applyCloudSnapshot, hasLocalTwinData, reconcileWithCloud, pauseSyncUntil, getSyncEnabled, isOnboarded, type CloudPeek } from './lib/twin'
import Onboarding from './pages/Onboarding'
import SprintOverlay, { SPRINT_MIN_MS } from './components/SprintOverlay'
import CloudRestorePrompt from './components/CloudRestorePrompt'
import SplashScreen from './components/SplashScreen'
import { TermsHost } from './components/Terms'
import DesktopUpdateBanner from './components/DesktopUpdateBanner'
import DemoModePrompt from './components/DemoModePrompt'
import ResetPasswordPage from './pages/ResetPasswordPage'
import StatusPage from './pages/StatusPage'
import AboutPage from './pages/AboutPage'

export default function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [checking, setChecking] = useState(true)
  // No marketing landing page — Kyno is an app: it opens straight to login
  // (or the dashboard once a session exists).
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
  const [pendingCloud, setPendingCloud] = useState<CloudPeek | null>(null)
  const [restoring, setRestoring]       = useState(false)
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

    ;(async () => {
      // Peek only — never save without the user's OK. Show a confirm card first.
      const peek = await peekCloudSnapshot()
      if (cancelled) return

      if (peek.ok && peek.found && !hasLocalTwinData()) {
        // Fresh device with a cloud backup available → ask before restoring.
        setPendingCloud(peek)
      } else if (peek.ok && hasLocalTwinData()) {
        // This device already has data → don't show the restore card, but quietly
        // reconcile in the background so XP + data converge across devices WITHOUT a
        // manual "Sync now". Merge is non-destructive: it unions data and keeps the
        // higher XP, then pushes the union up so the other device catches up too.
        sessionStorage.setItem('kairo:sync:pulled', '1')
        reconcileWithCloud().catch(() => {})
      }
      // else: nothing in the cloud yet, or a transient/not-signed-in result —
      // leave unlatched so a later refresh re-checks and can still surface the
      // prompt once another device has synced up.
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function confirmCloudRestore() {
    const p = pendingCloud
    if (!p?.blob || restoring) return
    setRestoring(true)
    setSprintHead('Restoring your data')
    setSprintSub('Bringing your history onto this device…')
    setSprintingIn(true)
    pauseSyncUntil(Date.now() + SPRINT_MIN_MS + 5_000)
    const startedAt = Date.now()
    try { applyCloudSnapshot(p.blob, 'replace') } catch {  }
    const elapsed = Date.now() - startedAt
    await new Promise(res => setTimeout(res, Math.max(0, SPRINT_MIN_MS - elapsed)))
    sessionStorage.setItem('kairo:sync:pulled', '1')
    setPendingCloud(null)
    setSprintingIn(false)
    setRestoring(false)
    pauseSyncUntil(0)
    // Reload so every page recomputes from the freshly restored data.
    window.location.reload()
  }

  function dismissCloudRestore() {
    sessionStorage.setItem('kairo:sync:pulled', '1')
    setPendingCloud(null)
  }

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
          background: '#0A0D16',
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
        <Login onLogin={handleLogin} />
        <TermsHost />
        <DesktopUpdateBanner />
        <DemoModePrompt />
        {splash}
      </>
    )
  }

  return (
    <GenerationProvider>
      <Suspense fallback={<SplashScreen />}>
        <Dashboard profile={profile} onLogout={handleLogout} />
      </Suspense>
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
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(124, 92, 255,0.25)',
 fontFamily: "'Inter', system-ui, sans-serif",
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
      <CloudRestorePrompt
        open={!!pendingCloud && !sprintingIn}
        stats={pendingCloud?.stats ?? null}
        busy={restoring}
        onConfirm={confirmCloudRestore}
        onDismiss={dismissCloudRestore}
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

