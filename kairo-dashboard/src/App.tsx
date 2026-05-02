import { useState, useEffect } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Login, { type AuthProfile } from './pages/Login'
import { GenerationProvider } from './lib/generationContext'

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

      if (!token) { setChecking(false); return }

      // Validate token is still alive by hitting /users/profile
      try {
        const API = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000/api'
        const res  = await fetch(`${API}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          signal:  AbortSignal.timeout(5000),   // 5-second timeout — don't hang forever
        })
        const data = await res.json()

        if (res.ok && data?.id) {
          // Token valid — rebuild profile from live data
          const freshProfile: AuthProfile = {
            id:              data.id,
            name:            data.name,
            role:            data.role,
            avatar_url:      data.avatar_url,
            school_id:       data.school?.id  ?? data.school_id,
            school_name:     data.school?.school_name,
            school_logo_url: data.school?.school_logo_url,
            school_email:    data.school?.school_email,
            plan:            data.school?.plan,
            access_token:    token,
            refresh_token:   localStorage.getItem('kairo_refresh') || '',
          }
          localStorage.setItem('kairo_profile', JSON.stringify(freshProfile))
          setProfile(freshProfile)
        } else if (res.status === 503) {
          // Supabase not configured — still let user in with cached profile
          if (cached) { try { setProfile(JSON.parse(cached)) } catch { clearSession() } }
          else clearSession()
        } else {
          // 401/403 — token invalid, clear session
          clearSession()
        }
      } catch {
        // Network down or backend not running — use cached profile (offline mode)
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
