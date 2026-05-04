import { useState, useEffect } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Login, { type AuthProfile } from './pages/Login'
import { GenerationProvider } from './lib/generationContext'
import { supabase } from './lib/supabase'

export default function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [checking, setChecking] = useState(true)

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
          const { data: userRow } = await supabase
            .from('users')
            .select('id, name, role, school_id, avatar_url')
            .eq('id', session.user.id)
            .single()

          let school: any = null
          if (userRow?.school_id) {
            const { data: s } = await supabase
              .from('schools')
              .select('id, school_name, school_logo_url, school_email, plan')
              .eq('id', userRow.school_id)
              .single()
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
    return <Login onLogin={handleLogin} />
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

