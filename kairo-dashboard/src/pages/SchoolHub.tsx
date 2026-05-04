/**
 * SchoolHub — full school management UI
 * Admin → Overview + Members + Tasks + Notifications
 * Teacher → Create Task + My Tasks + Notifications
 * Student → My Tasks + Feed
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, BookOpen, Bell, TrendingUp, Plus, Check, X, Clock,
  AlertCircle, RefreshCw, Send, Trash2, Ban, CheckCircle,
  FileText, Calendar, BarChart3, Loader2, Eye, UserCheck,
  ChevronDown, Filter, Search, Shield, GraduationCap,
  Building2, Sparkles, Award, Inbox,
} from 'lucide-react'
import type { AuthProfile } from './Login'

// ─── API helper ───────────────────────────────────────────────────────────────
function token() {
  return localStorage.getItem('kairo_token') || ''
}
async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Member {
  id: string; name: string; role: 'student' | 'teacher' | 'admin'
  status: 'active' | 'pending' | 'suspended'
  subject?: string; class_name?: string; avatar_url?: string; last_login_at?: string
}
interface Task {
  id: string; title: string; description?: string; subject?: string
  target_class?: string; due_date?: string; max_score: number
  status: 'active' | 'closed' | 'draft'; created_at: string
  creator?: { id: string; name: string; role: string }
  my_submission?: { status: 'submitted' | 'graded' | 'late'; score?: number; submitted_at?: string } | null
  submission_count?: number
}
interface Notif {
  id: string; message: string; sender_name?: string
  target_role: string; created_at: string; expires_at: string
}
interface Stats {
  total_active_users: number; total_students: number; total_teachers: number
  pending_students: number; total_tasks: number; open_tasks: number; active_notifications: number
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
      <motion.div
        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #1e1e2e', borderTopColor: '#6366f1' }}
      />
    </div>
  )
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#52525b' }}>
      <Icon size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: '#71717a', margin: '0 0 6px' }}>{title}</p>
      {sub && <p style={{ fontSize: 12, margin: 0 }}>{sub}</p>}
    </div>
  )
}

function ErrBanner({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, margin: '12px 0', fontSize: 13, color: '#f87171' }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{msg}</span>
      {onRetry && <button onClick={onRetry} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}><RefreshCw size={13} /></button>}
    </div>
  )
}

function TabBar({ tabs, active, onSelect }: { tabs: { id: string; label: string; icon: React.ElementType }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0d0d0d', borderRadius: 12, padding: 4, border: '1px solid #1a1a1a' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: active === t.id ? 'rgba(99,102,241,0.12)' : 'transparent',
          color: active === t.id ? '#818cf8' : '#52525b',
          boxShadow: active === t.id ? 'inset 0 0 0 1px rgba(99,102,241,0.3)' : 'none',
          transition: 'all 0.15s',
        }}>
          <t.icon size={13} />
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    admin:   { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
    teacher: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    student: { bg: 'rgba(52,211,153,0.15)', color: '#34d399' },
  }
  const s = map[role] || { bg: '#1e1e1e', color: '#71717a' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color, textTransform: 'capitalize', letterSpacing: 0.3 }}>
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    active:    { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', dot: '#34d399' },
    pending:   { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', dot: '#fbbf24' },
    suspended: { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', dot: '#f87171' },
  }
  const s = map[status] || { bg: '#1e1e1e', color: '#71717a', dot: '#71717a' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function Avatar({ name, url, size = 32 }: { name: string; url?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 3, flexShrink: 0, overflow: 'hidden', background: url ? 'transparent' : 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: '#fff' }}>
      {url ? <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: number | string; sub?: string; color: string }) {
  return (
    <Card style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 18 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 11, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 4px' }}>{label}</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#fafafa', margin: '0 0 2px', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: '#52525b', margin: 0 }}>{sub}</p>}
      </div>
    </Card>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        style={{ position: 'relative', width: '100%', maxWidth: 480, background: '#111', border: '1px solid #1e1e1e', borderRadius: 18, padding: 28, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fafafa' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b' }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #1e1e1e',
  borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s',
}

function Btn({ children, onClick, variant = 'primary', loading, small, style: s }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean; small?: boolean; style?: React.CSSProperties
}) {
  const bg = variant === 'primary' ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : variant === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)'
  const col = variant === 'primary' ? '#fff' : variant === 'danger' ? '#f87171' : '#a1a1aa'
  return (
    <motion.button whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.97 }} onClick={loading ? undefined : onClick}
      style={{ padding: small ? '6px 12px' : '10px 18px', borderRadius: 9, border: variant === 'danger' ? '1px solid rgba(239,68,68,0.25)' : 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#1e1e2e' : bg, color: loading ? '#52525b' : col, fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', ...s }}>
      {loading ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
      {children}
    </motion.button>
  )
}

// ─── NO SCHOOL VIEW ───────────────────────────────────────────────────────────
function NoSchoolView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: 40 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, border: '1px solid rgba(99,102,241,0.2)' }}>
        <Building2 size={32} color="#6366f1" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: '0 0 10px' }}>You're not in a school yet</h2>
      <p style={{ fontSize: 14, color: '#52525b', margin: '0 0 28px', maxWidth: 360, lineHeight: 1.6 }}>
        Join a school to access homework, announcements, and your class dashboard. Ask your admin for the school passcode.
      </p>
      <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, fontSize: 13, color: '#818cf8' }}>
        Go to <strong>Sign Up → Join School</strong> and enter your school's passcode
      </div>
    </div>
  )
}

// ─── SCHOOL HEADER ─────────────────────────────────────────────────────────────
function SchoolHeader({ profile }: { profile: AuthProfile }) {
  const roleIcon = profile.role === 'admin' ? Shield : profile.role === 'teacher' ? BookOpen : GraduationCap
  const RoleIcon = roleIcon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
      {profile.school_logo_url ? (
        <img src={profile.school_logo_url} alt={profile.school_name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', background: '#1a1a1a', border: '1px solid #1e1e1e' }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Building2 size={22} color="#6366f1" />
        </div>
      )}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fafafa', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
          {profile.school_name || 'Your School'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RoleBadge role={profile.role} />
          <span style={{ fontSize: 12, color: '#3f3f46' }}>·</span>
          <span style={{ fontSize: 12, color: '#52525b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <RoleIcon size={11} /> {profile.name}
          </span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN HUB
// ═══════════════════════════════════════════════════════════════════════════════
function AdminHub({ profile, schoolId }: { profile: AuthProfile; schoolId: string }) {
  const [tab, setTab] = useState('overview')
  const tabs = [
    { id: 'overview',      label: 'Overview',      icon: BarChart3 },
    { id: 'members',       label: 'Members',        icon: Users },
    { id: 'tasks',         label: 'Tasks',          icon: BookOpen },
    { id: 'notifications', label: 'Notifications',  icon: Bell },
  ]
  return (
    <>
      <TabBar tabs={tabs} active={tab} onSelect={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'overview'      && <AdminOverview schoolId={schoolId} />}
          {tab === 'members'       && <AdminMembers  schoolId={schoolId} />}
          {tab === 'tasks'         && <AdminTasks    schoolId={schoolId} />}
          {tab === 'notifications' && <NotificationsTab profile={profile} schoolId={schoolId} canSend />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

// Admin: Overview
function AdminOverview({ schoolId }: { schoolId: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setStats((await api(`/schools/${schoolId}/stats`)) as Stats) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [schoolId])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (err) return <ErrBanner msg={err} onRetry={load} />

  const s = stats!
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={Users}      label="Active Users"   value={s.total_active_users} sub="students + teachers" color="#6366f1" />
        <StatCard icon={GraduationCap} label="Students"   value={s.total_students}      sub={s.pending_students > 0 ? `${s.pending_students} pending` : 'all active'} color="#34d399" />
        <StatCard icon={BookOpen}   label="Teachers"       value={s.total_teachers}      color="#60a5fa" />
        <StatCard icon={FileText}   label="Open Tasks"     value={s.open_tasks}          sub={`${s.total_tasks} total`} color="#fb923c" />
        <StatCard icon={Bell}       label="Notifications"  value={s.active_notifications} sub="active" color="#f472b6" />
      </div>
      {s.pending_students > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#fbbf24' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span><strong>{s.pending_students}</strong> student{s.pending_students > 1 ? 's' : ''} waiting for approval — go to the <strong>Members</strong> tab to approve them.</span>
        </div>
      )}
    </div>
  )
}

// Admin: Members
function AdminMembers({ schoolId }: { schoolId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'student' | 'teacher'>('all')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setMembers((await api(`/schools/${schoolId}/members`)).members) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [schoolId])

  useEffect(() => { load() }, [load])

  async function action(type: 'approve' | 'suspend' | 'reinstate' | 'remove', userId: string) {
    setActing(userId)
    try {
      if (type === 'approve')   await api(`/schools/${schoolId}/approve/${userId}`,   { method: 'POST' })
      if (type === 'suspend')   await api(`/schools/${schoolId}/suspend/${userId}`,   { method: 'POST' })
      if (type === 'reinstate') await api(`/schools/${schoolId}/reinstate/${userId}`, { method: 'POST' })
      if (type === 'remove')    await api(`/schools/${schoolId}/members/${userId}`,   { method: 'DELETE' })
      await load()
    } catch (e: any) { setErr(e.message) }
    finally { setActing(null) }
  }

  const visible = members.filter(m => {
    if (filter === 'pending' && m.status !== 'pending') return false
    if (filter === 'student' && m.role !== 'student')   return false
    if (filter === 'teacher' && m.role !== 'teacher')   return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      {err && <ErrBanner msg={err} onRetry={load} />}
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#52525b', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        {(['all', 'pending', 'student', 'teacher'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
            borderColor: filter === f ? '#6366f1' : '#1e1e1e',
            background: filter === f ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: filter === f ? '#818cf8' : '#52525b',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && members.filter(m => m.status === 'pending').length > 0 && (
              <span style={{ marginLeft: 6, background: '#fbbf24', color: '#000', borderRadius: 4, padding: '0 5px', fontSize: 10, fontWeight: 800 }}>
                {members.filter(m => m.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <EmptyState icon={Users} title="No members found" sub="Try changing the filter" />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < visible.length - 1 ? '1px solid #1a1a1a' : 'none', transition: 'background 0.12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#161616' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
              <Avatar name={m.name} url={m.avatar_url} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <RoleBadge role={m.role} />
                  <StatusBadge status={m.status} />
                </div>
                <span style={{ fontSize: 11, color: '#52525b' }}>
                  {m.subject && `${m.subject} · `}{m.class_name && `Class ${m.class_name} · `}
                  {m.last_login_at ? `Last seen ${timeAgo(m.last_login_at)}` : 'Never logged in'}
                </span>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {m.status === 'pending' && (
                  <Btn small variant="primary" onClick={() => action('approve', m.id)} loading={acting === m.id}>
                    <Check size={11} /> Approve
                  </Btn>
                )}
                {m.status === 'active' && m.role !== 'admin' && (
                  <Btn small variant="ghost" onClick={() => action('suspend', m.id)} loading={acting === m.id}>
                    <Ban size={11} /> Suspend
                  </Btn>
                )}
                {m.status === 'suspended' && (
                  <Btn small variant="ghost" onClick={() => action('reinstate', m.id)} loading={acting === m.id}>
                    <CheckCircle size={11} /> Reinstate
                  </Btn>
                )}
                {m.role !== 'admin' && (
                  <Btn small variant="danger" onClick={() => action('remove', m.id)} loading={acting === m.id}>
                    <Trash2 size={11} />
                  </Btn>
                )}
              </div>
            </motion.div>
          ))}
        </Card>
      )}
    </div>
  )
}

// Admin: All Tasks (read-only overview)
function AdminTasks({ schoolId }: { schoolId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setTasks((await api('/tasks')).tasks) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const visible = tasks.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {err && <ErrBanner msg={err} onRetry={load} />}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#52525b', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
      </div>
      {loading ? <Spinner /> : visible.length === 0 ? (
        <EmptyState icon={FileText} title="No tasks yet" sub="Teachers can create tasks from their dashboard" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((t, i) => <TaskRow key={t.id} task={t} index={i} />)}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHER HUB
// ═══════════════════════════════════════════════════════════════════════════════
function TeacherHub({ profile, schoolId }: { profile: AuthProfile; schoolId: string }) {
  const [tab, setTab] = useState('tasks')
  const [refresh, setRefresh] = useState(0)
  const tabs = [
    { id: 'tasks',         label: 'My Tasks',       icon: FileText },
    { id: 'create',        label: 'Create Task',     icon: Plus },
    { id: 'notifications', label: 'Notifications',   icon: Bell },
  ]
  return (
    <>
      <TabBar tabs={tabs} active={tab} onSelect={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'tasks'         && <TeacherTaskList refresh={refresh} />}
          {tab === 'create'        && <CreateTaskForm onCreated={() => { setRefresh(r => r + 1); setTab('tasks') }} />}
          {tab === 'notifications' && <NotificationsTab profile={profile} schoolId={schoolId} canSend />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

function TeacherTaskList({ refresh }: { refresh: number }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setTasks((await api('/tasks')).tasks) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, refresh])

  return (
    <div>
      {err && <ErrBanner msg={err} onRetry={load} />}
      {loading ? <Spinner /> : tasks.length === 0 ? (
        <EmptyState icon={FileText} title="No tasks yet" sub="Click 'Create Task' to assign homework to your class" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((t, i) => <TaskRow key={t.id} task={t} index={i} showSubmissions />)}
        </div>
      )}
    </div>
  )
}

function CreateTaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle]           = useState('')
  const [desc, setDesc]             = useState('')
  const [subject, setSubject]       = useState('')
  const [targetClass, setTargetClass] = useState('')
  const [dueDate, setDueDate]       = useState('')
  const [maxScore, setMaxScore]     = useState('100')
  const [loading, setLoading]       = useState(false)
  const [err, setErr]               = useState('')
  const [success, setSuccess]       = useState(false)

  async function submit() {
    if (!title.trim()) { setErr('Title is required'); return }
    setLoading(true); setErr(''); setSuccess(false)
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(), description: desc.trim() || undefined,
          subject: subject.trim() || undefined, target_class: targetClass.trim() || undefined,
          due_date: dueDate || undefined, max_score: parseInt(maxScore) || 100,
        }),
      })
      setSuccess(true)
      setTimeout(() => onCreated(), 800)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Card style={{ maxWidth: 600 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Plus size={16} color="#6366f1" /> New Task / Homework
      </h3>
      {err && <ErrBanner msg={err} />}
      {success && (
        <div style={{ padding: '10px 14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, marginBottom: 14, fontSize: 13, color: '#34d399', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> Task created! Redirecting…
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 Worksheet" style={inputStyle} autoFocus />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Instructions, links, notes…" rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Physics" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Target Class</label>
            <input value={targetClass} onChange={e => setTargetClass(e.target.value)} placeholder="e.g. 10A (leave blank for all)" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Due Date</label>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Max Score</label>
            <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} min="1" max="1000" style={inputStyle} />
          </div>
        </div>
        <Btn onClick={submit} loading={loading} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <Sparkles size={13} /> Create Task
        </Btn>
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT HUB
// ═══════════════════════════════════════════════════════════════════════════════
function StudentHub({ profile, schoolId }: { profile: AuthProfile; schoolId: string }) {
  const [tab, setTab] = useState('tasks')
  const tabs = [
    { id: 'tasks', label: 'My Tasks',  icon: BookOpen },
    { id: 'feed',  label: 'Feed',      icon: Bell },
  ]
  return (
    <>
      <TabBar tabs={tabs} active={tab} onSelect={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'tasks' && <StudentTaskList />}
          {tab === 'feed'  && <NotificationsTab profile={profile} schoolId={schoolId} canSend={false} />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

function StudentTaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setTasks((await api('/tasks')).tasks) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const pending  = tasks.filter(t => !t.my_submission)
  const done     = tasks.filter(t =>  t.my_submission)

  return (
    <div>
      {err && <ErrBanner msg={err} onRetry={load} />}
      {loading ? <Spinner /> : tasks.length === 0 ? (
        <EmptyState icon={Inbox} title="No tasks assigned" sub="Your teacher hasn't posted any homework yet" />
      ) : (
        <div>
          {pending.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                📋 To Do · {pending.length}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {pending.map((t, i) => (
                  <TaskRow key={t.id} task={t} index={i} onSubmit={() => setSubmitting(t)} />
                ))}
              </div>
            </>
          )}
          {done.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                ✅ Submitted · {done.length}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {done.map((t, i) => <TaskRow key={t.id} task={t} index={i} />)}
              </div>
            </>
          )}
        </div>
      )}
      {submitting && (
        <SubmitModal task={submitting} onClose={() => setSubmitting(null)} onDone={() => { setSubmitting(null); load() }} />
      )}
    </div>
  )
}

function SubmitModal({ task, onClose, onDone }: { task: Task; onClose: () => void; onDone: () => void }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!content.trim()) { setErr('Write your answer first'); return }
    setLoading(true); setErr('')
    try {
      await api(`/tasks/${task.id}/submit`, { method: 'POST', body: JSON.stringify({ content: content.trim() }) })
      onDone()
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open title={`Submit: ${task.title}`} onClose={onClose}>
      {task.description && (
        <div style={{ padding: '10px 14px', background: '#0d0d0d', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#a1a1aa', lineHeight: 1.6, border: '1px solid #1a1a1a' }}>
          {task.description}
        </div>
      )}
      {err && <ErrBanner msg={err} />}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Your Answer</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your answer here…" rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} loading={loading}><Send size={13} /> Submit</Btn>
      </div>
    </Modal>
  )
}

// ─── TASK ROW (shared) ────────────────────────────────────────────────────────
function TaskRow({ task: t, index, onSubmit, showSubmissions }: { task: Task; index: number; onSubmit?: () => void; showSubmissions?: boolean }) {
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status === 'active'
  const sub = t.my_submission
  const subStatusMap: Record<string, { bg: string; color: string; label: string }> = {
    submitted: { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', label: '✓ Submitted' },
    graded:    { bg: 'rgba(99,102,241,0.1)',  color: '#818cf8', label: `★ Graded` },
    late:      { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', label: '⚠ Late' },
  }
  const subStyle = sub ? subStatusMap[sub.status] : null

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Left icon */}
        <div style={{ width: 38, height: 38, borderRadius: 10, background: sub ? 'rgba(52,211,153,0.1)' : isOverdue ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {sub ? <Check size={16} color="#34d399" /> : isOverdue ? <AlertCircle size={16} color="#f87171" /> : <FileText size={16} color="#818cf8" />}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            {t.subject && <span style={{ fontSize: 11, color: '#52525b', background: '#1e1e1e', padding: '1px 7px', borderRadius: 5 }}>{t.subject}</span>}
            {t.target_class && <span style={{ fontSize: 11, color: '#52525b' }}>· Class {t.target_class}</span>}
            {subStyle && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 5, background: subStyle.bg, color: subStyle.color }}>
                {subStyle.label}{sub?.score !== undefined && sub?.score !== null ? ` · ${sub.score}/${t.max_score}` : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#52525b', flexWrap: 'wrap' }}>
            {t.creator && <span>by {t.creator.name}</span>}
            {t.due_date && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: isOverdue ? '#f87171' : '#52525b' }}>
                <Calendar size={10} />
                Due {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {isOverdue && ' · overdue'}
              </span>
            )}
            {showSubmissions && t.submission_count !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={10} /> {t.submission_count} submissions</span>
            )}
          </div>
        </div>

        {/* Action */}
        {onSubmit && !sub && (
          <Btn small onClick={onSubmit}><Send size={11} /> Submit</Btn>
        )}
      </Card>
    </motion.div>
  )
}

// ─── NOTIFICATIONS TAB (shared) ───────────────────────────────────────────────
function NotificationsTab({ profile, schoolId, canSend }: { profile: AuthProfile; schoolId: string; canSend: boolean }) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [target, setTarget] = useState<'all' | 'student' | 'teacher'>('all')
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const endpoint = profile.role === 'admin' ? `/notifications/all` : `/notifications`
      setNotifs((await api(endpoint)).notifications || [])
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [profile.role])

  useEffect(() => { load() }, [load])

  async function send() {
    if (!msg.trim()) return
    setSending(true); setSendErr('')
    try {
      await api('/notifications', { method: 'POST', body: JSON.stringify({ school_id: schoolId, message: msg.trim(), target_role: target }) })
      setMsg('')
      await load()
    } catch (e: any) { setSendErr(e.message) }
    finally { setSending(false) }
  }

  return (
    <div>
      {canSend && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={14} color="#f472b6" /> Send Notification
          </h3>
          {sendErr && <ErrBanner msg={sendErr} />}
          <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write a message for your school…" rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 12, lineHeight: 1.6 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'student', 'teacher'] as const).map(r => (
                <button key={r} onClick={() => setTarget(r)} style={{
                  padding: '5px 12px', borderRadius: 7, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  borderColor: target === r ? '#f472b6' : '#1e1e1e',
                  background: target === r ? 'rgba(244,114,182,0.1)' : 'transparent',
                  color: target === r ? '#f472b6' : '#52525b',
                }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <Btn onClick={send} loading={sending} style={{ marginLeft: 'auto' }}>
              <Send size={13} /> Send
            </Btn>
          </div>
        </Card>
      )}

      {err && <ErrBanner msg={err} onRetry={load} />}
      {loading ? <Spinner /> : notifs.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" sub="Announcements from teachers and admins appear here" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifs.map((n, i) => <NotifCard key={n.id} notif={n} index={i} />)}
        </div>
      )}
    </div>
  )
}

function NotifCard({ notif: n, index }: { notif: Notif; index: number }) {
  const expiresAt = new Date(n.expires_at)
  const now = new Date()
  const minsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000))
  const pct = Math.min(100, (minsLeft / 720) * 100)

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}>
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,114,182,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={15} color="#f472b6" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, color: '#fafafa', margin: '0 0 6px', lineHeight: 1.5 }}>{n.message}</p>
            <div style={{ display: 'flex', align: 'center', gap: 10, fontSize: 11, color: '#52525b', flexWrap: 'wrap' }}>
              {n.sender_name && <span>from <strong style={{ color: '#71717a' }}>{n.sender_name}</strong></span>}
              <span>· {timeAgo(n.created_at)}</span>
              {n.target_role !== 'all' && <RoleBadge role={n.target_role} />}
            </div>
            {/* Expiry bar */}
            <div style={{ marginTop: 10, height: 2, background: '#1e1e1e', borderRadius: 1, overflow: 'hidden' }}>
              <motion.div initial={{ width: `${pct}%` }} style={{ height: '100%', background: pct > 50 ? '#34d399' : pct > 20 ? '#fbbf24' : '#f87171', borderRadius: 1 }} />
            </div>
            <span style={{ fontSize: 10, color: '#3f3f46' }}>
              {minsLeft > 60 ? `Expires in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m` : minsLeft > 0 ? `Expires in ${minsLeft}m` : 'Expired'}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ─── DEFAULT EXPORT ───────────────────────────────────────────────────────────
interface SchoolHubProps {
  profile: AuthProfile
}

export default function SchoolHub({ profile }: SchoolHubProps) {
  const role = profile.role as 'admin' | 'teacher' | 'student'
  const schoolId = profile.school_id

  if (!schoolId) return <NoSchoolView />

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
        <SchoolHeader profile={profile} />
        <div style={{ marginTop: 24 }}>
          {role === 'admin'   && <AdminHub   profile={profile} schoolId={schoolId} />}
          {role === 'teacher' && <TeacherHub profile={profile} schoolId={schoolId} />}
          {role === 'student' && <StudentHub profile={profile} schoolId={schoolId} />}
        </div>
      </div>
    </div>
  )
}
