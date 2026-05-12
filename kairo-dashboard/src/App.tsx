import { useState, useEffect } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Login, { type AuthProfile } from './pages/Login'
import Landing from './pages/Landing'
import { GenerationProvider } from './lib/generationContext'
import { supabase } from './lib/supabase'
import { refreshIfStale } from './lib/api'

// "landing" = cinematic marketing page (default for new visitors)
// "login"   = sign-in / sign-up flow
// "app"     = logged-in dashboard
type View = 'landing' | 'login' | 'app'

export default function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [view, setView] = useState<View>('landing')

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
          const { data: userRow } = await supabase
            .from('users')
            .select('id, name, role, school_id, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle()

          let school: any = null
          if (userRow?.school_id) {
            const { data: s } = await supabase
              .from('schools')
              .select('id, school_name, school_logo_url, school_email, plan')
              .eq('id', userRow.school_id)
              .maybeSingle()
            school = s
          }

          const freshProfile: AuthProfile = {
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

  if (checking) {
    // Minimal splash while we validate token
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid #1e1e1e', borderTopColor: '#6366f1',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!profile) {
    // Returning users skip the landing if they explicitly opened it as login
    if (view === 'login') {
      return <Login onLogin={handleLogin} />
    }
    return <Landing onGetStarted={() => setView('login')} />
  }

  return (
    <GenerationProvider>
      <Dashboard profile={profile} onLogout={handleLogout} />
    </GenerationProvider>
  )
}

function clearSession() {
  localStorage.removeItem('kairo_token')
  localStorage.removeItem('kairo_refresh')
  localStorage.removeItem('kairo_profile')
}

