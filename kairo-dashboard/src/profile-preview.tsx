/**
 * Local preview for Profile (space 7) -- dev only.
 *
 * Seeds a CBSE class 10 profile with a next exam, stubs the social and
 * account endpoints, and mounts the page in the same SpaceFrame the Dashboard
 * uses. Open http://localhost:3002/profile-preview.html (add ?full for the
 * breakpoints).
 */
import { createRoot } from 'react-dom/client'
import Profile from './pages/Profile'
import { PreviewFrame } from './preview-shared'
import { saveProfile } from './lib/twin'
import { setJSON } from './lib/storage'

if (!localStorage.getItem('kyno:profile-preview-seeded')) {
  saveProfile({ name: 'Preview', cls: '10', board: 'CBSE', mode: 'personal' } as any)
  const d = new Date(); d.setDate(d.getDate() + 11)
  setJSON('kyno:student_profile', { examDates: [{ name: 'Half-yearly', date: d.toISOString().slice(0, 10) }] })
  localStorage.setItem('kyno:profile-preview-seeded', '1')
}

let me = { username: 'quietstorm42', show_in_leagues: true, allow_battles: true, join_rooms: false, username_changed_at: null as string | null }
const real = window.fetch.bind(window)
window.fetch = (async (url: any, init?: any) => {
  const u = String(url)
  const body = () => { try { return JSON.parse(init?.body || '{}') } catch { return {} } }
  const json = (b: unknown, status = 200, ms = 350) => new Promise<Response>(res => setTimeout(() => res(new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })), ms))
  if (u.includes('/api/social/me')) return json(me)
  if (u.includes('/api/social/username')) {
    const want = String(body().username || '')
    if (want === 'taken99') return json({ error: 'That name is taken — try another.' }, 409)
    me = { ...me, username: want, username_changed_at: new Date().toISOString() }
    return json(me)
  }
  if (u.includes('/api/social/settings')) { me = { ...me, ...body() }; return json(me) }
  if (u.includes('/api/account/export')) return json({ exported_at: new Date().toISOString(), account: { id: 'preview' }, tables: { social_profiles: [me], league_scores: [{ week: '2026-08-31', xp: 120, minutes: 240 }] } }, 200, 600)
  if (u.includes('/api/account/delete')) return json({ ok: true, results: { users: 'deleted', auth: 'deleted' } }, 200, 900)
  return real(url, init)
}) as typeof window.fetch

createRoot(document.getElementById('root')!).render(
  <PreviewFrame active="profile">
    <Profile onLogout={() => alert('Signed out (preview)')} />
  </PreviewFrame>,
)
