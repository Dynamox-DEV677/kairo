/**
 * SchoolHub — full school management UI
 *
 * Admin  → Overview · Pending · Members · Tasks · Network Rules · Login Logs · Settings
 * Teacher → My Tasks · Create Task · Notifications
 * Student → My Tasks · Feed
 *
 * First person to register at a school is automatically the admin (enforced server-side).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, BookOpen, Bell, TrendingUp, Plus, Check, X, Clock,
  AlertCircle, RefreshCw, Send, Trash2, Ban, CheckCircle,
  FileText, Calendar, BarChart3, Loader2, Eye, UserCheck,
  ChevronDown, Shield, GraduationCap,
  Building2, Sparkles, Award, Inbox,
  Wifi, WifiOff, LogIn, Settings, Key, UserPlus,
  ToggleLeft, ToggleRight, AlertTriangle, CheckSquare,
  Globe, Lock, Unlock, Star, Target, TrendingDown, QrCode,
} from 'lucide-react'
import type { AuthProfile } from './Login'

// ─── API helper (auto-refreshes expired Supabase JWTs) ────────────────────────
import { api as apiClient } from '../lib/api'
const api = apiClient

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
interface NetworkRule {
  id: string; label: string; cidr: string; enabled: boolean; created_at: string
  creator?: { id: string; name: string }
}
interface LoginLog {
  id: string; email: string; ip_address: string; user_agent: string
  success: boolean; reason: string | null; created_at: string
  user?: { id: string; name: string; role: string } | null
}
interface SchoolInfo {
  id: string; school_name: string; school_email: string
  domain: string | null; require_approval: boolean; school_logo_url: string | null
}
interface Mark {
  id: string; subject: string; exam_name: string
  marks_obtained: number; total_marks: number; remarks?: string | null
  created_at: string
  teacher?: { id: string; name: string }
  student?: { id: string; name: string; class_name?: string }
}
interface MarkSummary {
  average_percentage: number; total_exams: number
  strong_subjects: string[]; weak_subjects: string[]
  subjects: Array<{ subject: string; percentage: number; total_obtained: number; total_max: number; count: number }>
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
      <motion.div
        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #1f2532', borderTopColor: '#4F7CFF' }}
      />
    </div>
  )
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6B7280' }}>
      <Icon size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, opacity: 0.7 }}>{sub}</div>}
    </div>
  )
}

function ErrBanner({ msg, onDismiss }: { msg: string; onDismiss?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(79, 124, 255, 0.12)', border: '1px solid rgba(79, 124, 255, 0.25)', borderRadius: 8,
        padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#66D9FF' }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{msg}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#66D9FF', cursor: 'pointer', padding: 0 }}><X size={13} /></button>}
    </motion.div>
  )
}

function SuccessBanner({ msg, onDismiss }: { msg: string; onDismiss?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(165, 180, 252, 0.12)', border: '1px solid rgba(165, 180, 252, 0.25)', borderRadius: 8,
        padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#A5B4FC' }}>
      <CheckCircle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{msg}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#A5B4FC', cursor: 'pointer', padding: 0 }}><X size={13} /></button>}
    </motion.div>
  )
}

function TabBar({ tabs, active, setActive }: {
  tabs: { id: string; label: string; icon: React.ElementType; badge?: number }[]
  active: string; setActive: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setActive(t.id)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: active === t.id ? 600 : 400,
          border: active === t.id ? '1px solid rgba(79, 124, 255, 0.4)' : '1px solid #1f2532',
          background: active === t.id ? 'rgba(79, 124, 255, 0.12)' : '#0E1117',
          color: active === t.id ? '#66D9FF' : '#9CA3AF',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', position: 'relative',
        }}>
          <t.icon size={13} />
          {t.label}
          {!!t.badge && (
            <span style={{ background: '#4F7CFF', color: '#fff', borderRadius: 10, fontSize: 10,
              fontWeight: 700, padding: '0 5px', minWidth: 16, textAlign: 'center' }}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 12, padding: 20, ...style }}>
      {children}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    admin:   { bg: 'rgba(79, 124, 255, 0.15)',  color: '#66D9FF', label: 'Admin' },
    teacher: { bg: 'rgba(79, 124, 255, 0.15)',  color: '#A5B4FC', label: 'Teacher' },
    student: { bg: 'rgba(165, 180, 252, 0.15)',  color: '#A5B4FC', label: 'Student' },
  }
  const c = cfg[role] || { bg: '#1f2532', color: '#9CA3AF', label: role }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:    { bg: 'rgba(165, 180, 252, 0.15)',  color: '#A5B4FC' },
    pending:   { bg: 'rgba(165, 180, 252, 0.15)',  color: '#A5B4FC' },
    suspended: { bg: 'rgba(79, 124, 255, 0.15)',   color: '#66D9FF' },
    submitted: { bg: 'rgba(79, 124, 255, 0.15)',  color: '#66D9FF' },
    graded:    { bg: 'rgba(165, 180, 252, 0.15)',  color: '#A5B4FC' },
    late:      { bg: 'rgba(79, 124, 255, 0.15)',   color: '#66D9FF' },
  }
  const c = cfg[status] || { bg: '#1f2532', color: '#9CA3AF' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: c.bg, color: c.color }}>
      {status}
    </span>
  )
}

function Avatar({ name, url, size = 32 }: { name: string; url?: string; size?: number }) {
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: size / 3, objectFit: 'cover' }} />
    : (
      <div style={{
        width: size, height: size, borderRadius: size / 3, flexShrink: 0,
        background: 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 700, color: '#fff',
      }}>{name.charAt(0).toUpperCase()}</div>
    )
}

function StatCard({ label, value, icon: Icon, color = '#4F7CFF', sub }: {
  label: string; value: number | string; icon: React.ElementType; color?: string; sub?: string
}) {
  return (
    <Card style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fafafa', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{sub}</div>}
      </div>
    </Card>
  )
}

function Modal({ open, onClose, title, children, width = 480 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14,
              width: '100%', maxWidth: width, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, color: '#fafafa', fontSize: 16 }}>{title}</span>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 2 }}>
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Btn({ children, onClick, variant = 'primary', size = 'md', disabled = false, style }: {
  children: React.ReactNode; onClick?: () => void
  variant?: 'primary' | 'danger' | 'ghost' | 'success' | 'warning'
  size?: 'sm' | 'md'; disabled?: boolean; style?: React.CSSProperties
}) {
  const cfg = {
    primary: { bg: '#4F7CFF', hoverBg: '#5558e8', color: '#fff' },
    danger:  { bg: 'rgba(79, 124, 255, 0.15)', hoverBg: 'rgba(79, 124, 255, 0.25)', color: '#66D9FF' },
    ghost:   { bg: '#1a1f2e', hoverBg: '#222', color: '#B1B5BA' },
    success: { bg: 'rgba(165, 180, 252, 0.15)', hoverBg: 'rgba(165, 180, 252, 0.25)', color: '#A5B4FC' },
    warning: { bg: 'rgba(165, 180, 252, 0.15)', hoverBg: 'rgba(165, 180, 252, 0.25)', color: '#A5B4FC' },
  }[variant]
  const pad = size === 'sm' ? '5px 10px' : '8px 16px'
  const fs  = size === 'sm' ? 12 : 13
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: pad, borderRadius: 7, fontSize: fs, fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', opacity: disabled ? 0.5 : 1, transition: 'all 0.12s', ...style,
    }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = cfg.hoverBg }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = cfg.bg }}
    >{children}</button>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#66D9FF', marginLeft: 2 }}>*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px', background: '#0E1117', border: '1px solid #2a2a2a',
          borderRadius: 8, color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#4F7CFF' }}
        onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#2a2a2a' }}
      />
    </div>
  )
}

function fmtDate(s: string) {
  const d = new Date(s)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDateShort(s: string) {
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── NO SCHOOL VIEW ───────────────────────────────────────────────────────────
function NoSchoolView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: '#6B7280', gap: 12 }}>
      <Building2 size={48} style={{ opacity: 0.3 }} />
      <div style={{ fontSize: 18, fontWeight: 700, color: '#9CA3AF' }}>Not in a school yet</div>
      <div style={{ fontSize: 13, maxWidth: 300, textAlign: 'center' }}>
        Register or join a school from the login screen to access School Hub.
      </div>
    </div>
  )
}

// ─── SCHOOL HEADER ────────────────────────────────────────────────────────────
function SchoolHeader({ profile }: { profile: AuthProfile }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
      {profile.school_logo_url
        ? <img src={profile.school_logo_url} alt="logo"
            style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '1px solid #1f2532' }} />
        : <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#4F7CFF,#4F7CFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={22} color="#fff" />
          </div>
      }
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fafafa' }}>{profile.school_name || 'School Hub'}</div>
        <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', gap: 8, alignItems: 'center' }}>
          <RoleBadge role={profile.role} />
          <span>{profile.name}</span>
        </div>
      </div>
    </div>
  )
}

// ─── ADMIN HUB ────────────────────────────────────────────────────────────────
function AdminHub({ profile, schoolId }: { profile: AuthProfile; schoolId: string }) {
  const [tab, setTab] = useState('overview')
  const [pendingCount, setPendingCount] = useState(0)

  // Count pending students for badge
  useEffect(() => {
    api(`/schools/${schoolId}/members?status=pending`)
      .then(d => setPendingCount(d.members?.length ?? 0))
      .catch(() => {})
  }, [schoolId])

  const tabs = [
    { id: 'overview',  label: 'Overview',      icon: TrendingUp },
    { id: 'health',    label: 'Health Monitor', icon: AlertTriangle },
    { id: 'pending',   label: 'Pending',        icon: Clock,      badge: pendingCount || undefined },
    { id: 'members',   label: 'Members',        icon: Users },
    { id: 'tasks',     label: 'Tasks',          icon: BookOpen },
    { id: 'marks',     label: 'Marks Audit',    icon: BarChart3 },
    { id: 'announce',  label: 'AI Announce',    icon: Sparkles },
    { id: 'network',   label: 'Network Rules',  icon: Wifi },
    { id: 'logs',      label: 'Login Logs',     icon: LogIn },
    { id: 'settings',  label: 'Settings',       icon: Settings },
  ]

  return (
    <>
      <TabBar tabs={tabs} active={tab} setActive={t => { setTab(t); if (t === 'pending') setPendingCount(0) }} />
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}>
          {tab === 'overview' && <AdminOverview    schoolId={schoolId} />}
          {tab === 'health'   && <AdminHealthMonitor />}
          {tab === 'pending'  && <AdminPending     schoolId={schoolId} onApprove={() => {}} />}
          {tab === 'members'  && <AdminMembers     schoolId={schoolId} selfId={profile.id} />}
          {tab === 'tasks'    && <AdminTasks       schoolId={schoolId} />}
          {tab === 'marks'    && <AdminMarksAudit  schoolId={schoolId} />}
          {tab === 'announce' && <AdminAIAnnounce  schoolId={schoolId} />}
          {tab === 'network'  && <AdminNetwork     schoolId={schoolId} />}
          {tab === 'logs'     && <AdminLogs        schoolId={schoolId} />}
          {tab === 'settings' && <AdminSettings    schoolId={schoolId} profile={profile} />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

// AI Announcement Generator ───────────────────────────────────────────────────
function AdminAIAnnounce({ schoolId: _ }: { schoolId: string }) {
  const [topic, setTopic]         = useState('')
  const [tone, setTone]           = useState<'friendly' | 'formal' | 'urgent'>('friendly')
  const [draft, setDraft]         = useState('')
  const [audience, setAudience]   = useState<'all' | 'student' | 'teacher'>('all')
  const [hours, setHours]         = useState(12)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending]     = useState(false)
  const [err, setErr]             = useState('')
  const [success, setSuccess]     = useState('')

  async function generate() {
    if (!topic.trim()) { setErr('Enter a topic first'); return }
    setErr(''); setSuccess(''); setGenerating(true); setDraft('')
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Write a school announcement in a ${tone} tone about: "${topic}". Keep it concise (2-4 sentences), clear, and professional. Return ONLY the announcement text — no preamble, no quotes, no markdown.`,
          }],
        }),
      })
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content?.trim()
      if (!text) throw new Error('AI returned no text. Try again.')
      setDraft(text.replace(/^["']|["']$/g, '').replace(/<\/?think(?:ing)?>[\s\S]*?<\/?think(?:ing)?>/gi, '').trim())
    } catch (e: any) { setErr(e.message) }
    finally { setGenerating(false) }
  }

  async function send() {
    if (!draft.trim()) { setErr('Nothing to send'); return }
    setErr(''); setSuccess(''); setSending(true)
    try {
      await api('/notifications', {
        method: 'POST',
        body: JSON.stringify({ message: draft.trim(), target_role: audience, expires_in_hours: hours }),
      })
      setSuccess(`Sent to ${audience === 'all' ? 'everyone' : audience + 's'}. Auto-deletes in ${hours}h.`)
      setDraft(''); setTopic('')
    } catch (e: any) { setErr(e.message) }
    finally { setSending(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Generate */}
      <div style={{ background: '#0f0f12', border: '1px solid #1f2532', borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Sparkles size={15} color="#A5B4FC" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: 0 }}>Generate</h3>
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Topic</label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder='e.g. "Sports day on Friday" or "Holiday on 20th May"'
          style={{
            width: '100%', background: '#050505', border: '1px solid #1f2532',
            borderRadius: 8, padding: '9px 12px', color: '#fafafa', fontSize: 13,
            fontFamily: 'inherit', outline: 'none', marginBottom: 12, boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Tone</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['friendly', 'formal', 'urgent'] as const).map(t => (
            <button key={t} onClick={() => setTone(t)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7,
              border: `1px solid ${tone === t ? '#4F7CFF' : '#1f2532'}`,
              background: tone === t ? 'rgba(79, 124, 255, 0.12)' : '#050505',
              color: tone === t ? '#A5B4FC' : '#6B7280',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={generating || !topic.trim()}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8, border: 'none',
            background: !topic.trim() || generating ? '#1a1f2e' : 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
            color: !topic.trim() || generating ? '#6B7280' : '#fff',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: !topic.trim() || generating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <Sparkles size={13} />{generating ? 'Generating…' : 'Generate Announcement'}
        </button>
      </div>

      {/* Preview + Send */}
      <div style={{ background: '#0f0f12', border: '1px solid #1f2532', borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Send size={14} color="#A5B4FC" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: 0 }}>Preview & Send</h3>
        </div>

        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Generated announcement will appear here. You can edit it before sending."
          style={{
            width: '100%', minHeight: 110, background: '#050505',
            border: '1px solid #1f2532', borderRadius: 8, padding: 12,
            color: '#fafafa', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', resize: 'vertical', lineHeight: 1.55, marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Send to</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {([['all', 'Everyone'], ['student', 'Students'], ['teacher', 'Teachers']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAudience(id)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7,
              border: `1px solid ${audience === id ? '#A5B4FC' : '#1f2532'}`,
              background: audience === id ? 'rgba(165, 180, 252, 0.1)' : '#050505',
              color: audience === id ? '#A5B4FC' : '#6B7280',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
          Auto-delete after
        </label>
        <select
          value={hours}
          onChange={e => setHours(Number(e.target.value))}
          style={{
            width: '100%', background: '#050505', border: '1px solid #1f2532',
            borderRadius: 8, padding: '9px 12px', color: '#fafafa', fontSize: 13,
            fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box',
          }}
        >
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={12}>12 hours (default)</option>
          <option value={24}>24 hours</option>
          <option value={72}>3 days</option>
        </select>

        {err     && <p style={{ fontSize: 12, color: '#66D9FF', marginBottom: 10 }}>{err}</p>}
        {success && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 10 }}>{success}</p>}

        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8, border: 'none',
            background: !draft.trim() || sending ? '#1a1f2e' : 'linear-gradient(135deg, #A5B4FC, #66D9FF)',
            color: !draft.trim() || sending ? '#6B7280' : '#fff',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: !draft.trim() || sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <Send size={13} />{sending ? 'Sending…' : 'Send Announcement'}
        </button>
      </div>
    </div>
  )
}

// Overview ────────────────────────────────────────────────────────────────────
function AdminOverview({ schoolId }: { schoolId: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    setLoading(true)
    api(`/schools/${schoolId}/stats`)
      .then(setStats).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [schoolId])

  if (loading) return <Spinner />
  if (err) return <ErrBanner msg={err} />
  if (!stats) return null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        <StatCard label="Active Users"      value={stats.total_active_users}   icon={Users}     color="#4F7CFF" />
        <StatCard label="Students"          value={stats.total_students}        icon={GraduationCap} color="#A5B4FC" />
        <StatCard label="Teachers"          value={stats.total_teachers}        icon={Shield}    color="#A5B4FC" />
        <StatCard label="Pending Approval"  value={stats.pending_students}      icon={Clock}     color="#A5B4FC"
          sub={stats.pending_students > 0 ? 'Go to Pending tab' : undefined} />
        <StatCard label="Total Tasks"       value={stats.total_tasks}           icon={BookOpen}  color="#66D9FF" />
        <StatCard label="Open Tasks"        value={stats.open_tasks}            icon={CheckSquare} color="#38bdf8" />
        <StatCard label="Active Notices"    value={stats.active_notifications}  icon={Bell}      color="#A5B4FC" />
      </div>
    </div>
  )
}

// School Health Monitor ───────────────────────────────────────────────────────
function AdminHealthMonitor() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setData(await api('/school-health')) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (err)     return <ErrBanner msg={err} />
  if (!data)   return null

  const score = data.health_score
  const scoreColor = score >= 80 ? '#A5B4FC' : score >= 60 ? '#A5B4FC' : '#66D9FF'
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Healthy' : score >= 40 ? 'Needs attention' : 'Critical'

  return (
    <div>
      {/* Big health score card */}
      <div style={{
        background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14,
        padding: 26, marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 220, height: 220,
          borderRadius: '50%', background: `${scoreColor}25`, filter: 'blur(60px)',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ position: 'relative', width: 110, height: 110 }}>
            <svg viewBox="-55 -55 110 110" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle r={45} fill="none" stroke="#1a1f2e" strokeWidth={6} />
              <circle r={45} fill="none" stroke={scoreColor} strokeWidth={6} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 45}
                strokeDashoffset={2 * Math.PI * 45 * (1 - score / 100)} />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>/ 100</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              School Health
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, marginTop: 4, marginBottom: 6, lineHeight: 1 }}>
              {scoreLabel}
            </div>
            <div style={{ fontSize: 12, color: '#B1B5BA' }}>
              {data.alerts.length === 0
                ? 'No active alerts. Keep going.'
                : `${data.alerts.length} active alert${data.alerts.length === 1 ? '' : 's'} below.`}
            </div>
          </div>
          <button onClick={load} style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #1f2532',
            background: '#151922', color: '#9CA3AF', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {data.alerts.map((a: any, i: number) => {
            const c = a.level === 'high' ? '#66D9FF' : '#A5B4FC'
            return (
              <div key={i} style={{
                background: '#0E1117', border: `1px solid ${c}40`, borderRadius: 11,
                borderLeft: `3px solid ${c}`,
                padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <AlertCircle size={16} color={c} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#B1B5BA', marginTop: 3 }}>{a.body}</div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                  background: `${c}20`, color: c, textTransform: 'uppercase', letterSpacing: 1,
                }}>{a.level}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Engagement */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Marks (7d)',     v: data.engagement.last7.marks,  t: data.engagement.trend.marks  },
          { l: 'Tasks (7d)',     v: data.engagement.last7.tasks,  t: data.engagement.trend.tasks  },
          { l: 'Submissions',    v: data.engagement.last7.subs,   t: data.engagement.trend.subs   },
          { l: 'Notifications',  v: data.engagement.last7.notifs, t: data.engagement.trend.notifs },
        ].map(s => (
          <div key={s.l} style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 11, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              {s.l}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#fafafa' }}>{s.v}</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: s.t > 0 ? '#A5B4FC' : s.t < 0 ? '#66D9FF' : '#9CA3AF',
              }}>
                {s.t > 0 ? '+' : ''}{s.t}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Class performance */}
        <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 12 }}>Class Performance</div>
          {data.classPerformance.length === 0 && <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>No marks logged yet.</div>}
          {data.classPerformance.map((c: any) => (
            <div key={c.class_name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#d4d4d8' }}>{c.class_name}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: c.avg_pct >= 75 ? '#A5B4FC' : c.avg_pct >= 60 ? '#A5B4FC' : '#66D9FF',
                }}>{c.avg_pct}%</span>
              </div>
              <div style={{ height: 6, background: '#0E1117', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${c.avg_pct}%`,
                  background: c.avg_pct >= 75 ? '#A5B4FC' : c.avg_pct >= 60 ? '#A5B4FC' : '#66D9FF',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{c.exam_count} marks logged</div>
            </div>
          ))}
        </div>

        {/* Teacher load */}
        <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 12 }}>Teacher Load (30d)</div>
          {data.teacherLoad.length === 0 && <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>No tasks created yet.</div>}
          {data.teacherLoad.slice(0, 8).map((t: any) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', marginBottom: 4,
              background: t.tasks >= 8 ? 'rgba(79, 124, 255, 0.06)' : '#0E1117',
              border: `1px solid ${t.tasks >= 8 ? 'rgba(79, 124, 255, 0.25)' : '#1a1f2e'}`,
              borderRadius: 6,
            }}>
              <span style={{ fontSize: 12, color: '#d4d4d8' }}>{t.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: t.tasks >= 8 ? '#A5B4FC' : t.tasks >= 4 ? '#A5B4FC' : '#9CA3AF',
              }}>{t.tasks} task{t.tasks === 1 ? '' : 's'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lead funnel */}
      {(data.leadFunnel.new + data.leadFunnel.contacted + data.leadFunnel.admitted) > 0 && (
        <div style={{
          background: '#0E1117', border: '1px solid #1f2532', borderRadius: 12,
          padding: 16, marginTop: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 12 }}>
            Admission Lead Funnel (30d)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { l: 'New',       v: data.leadFunnel.new,       c: '#A5B4FC' },
              { l: 'Contacted', v: data.leadFunnel.contacted, c: '#66D9FF' },
              { l: 'Admitted',  v: data.leadFunnel.admitted,  c: '#A5B4FC' },
              { l: 'Rejected',  v: data.leadFunnel.rejected,  c: '#66D9FF' },
            ].map(s => (
              <div key={s.l} style={{
                padding: 12, background: '#0E1117',
                border: `1px solid ${s.c}30`, borderRadius: 8,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Pending ─────────────────────────────────────────────────────────────────────
function AdminPending({ schoolId, onApprove }: { schoolId: string; onApprove: () => void }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy]       = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setErr('')
    api(`/schools/${schoolId}/members?status=pending`)
      .then(d => setMembers(d.members || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [schoolId])

  useEffect(() => { load() }, [load])

  async function approve(m: Member) {
    setBusy(m.id)
    try {
      await api(`/schools/${schoolId}/approve/${m.id}`, { method: 'POST' })
      setSuccess(`${m.name} approved!`)
      setMembers(prev => prev.filter(x => x.id !== m.id))
      onApprove()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  async function reject(m: Member) {
    if (!confirm(`Remove ${m.name} from the school?`)) return
    setBusy(m.id)
    try {
      await api(`/schools/${schoolId}/members/${m.id}`, { method: 'DELETE' })
      setSuccess(`${m.name} removed.`)
      setMembers(prev => prev.filter(x => x.id !== m.id))
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  if (loading) return <Spinner />

  return (
    <div>
      {err     && <ErrBanner    msg={err}     onDismiss={() => setErr('')} />}
      {success && <SuccessBanner msg={success} onDismiss={() => setSuccess('')} />}

      {members.length === 0
        ? <EmptyState icon={CheckCircle} title="No pending approvals" sub="All students are approved." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {members.map(m => (
              <motion.div key={m.id} layout
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                <Card style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                  <Avatar name={m.name} url={m.avatar_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 14 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {m.class_name && `Class ${m.class_name} · `}
                      Awaiting approval since {m.last_login_at ? fmtDateShort(m.last_login_at) : '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="success" size="sm" disabled={busy === m.id} onClick={() => approve(m)}>
                      {busy === m.id ? <Loader2 size={12} /> : <><Check size={12} /> Approve</>}
                    </Btn>
                    <Btn variant="danger" size="sm" disabled={busy === m.id} onClick={() => reject(m)}>
                      <X size={12} /> Reject
                    </Btn>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// Members ─────────────────────────────────────────────────────────────────────
function AdminMembers({ schoolId, selfId }: { schoolId: string; selfId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy]       = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | 'student' | 'teacher' | 'admin'>('all')

  const load = useCallback(() => {
    setLoading(true); setErr('')
    const q = filter !== 'all' ? `?role=${filter}` : ''
    api(`/schools/${schoolId}/members${q}`)
      .then(d => setMembers(d.members || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [schoolId, filter])

  useEffect(() => { load() }, [load])

  async function act(action: 'approve' | 'suspend' | 'reinstate' | 'remove', m: Member) {
    if (action === 'remove' && !confirm(`Remove ${m.name} from the school?`)) return
    setBusy(m.id)
    try {
      if (action === 'approve')   await api(`/schools/${schoolId}/approve/${m.id}`,   { method: 'POST' })
      if (action === 'suspend')   await api(`/schools/${schoolId}/suspend/${m.id}`,   { method: 'POST' })
      if (action === 'reinstate') await api(`/schools/${schoolId}/reinstate/${m.id}`, { method: 'POST' })
      if (action === 'remove')    await api(`/schools/${schoolId}/members/${m.id}`,   { method: 'DELETE' })
      setSuccess(`Done: ${m.name}`)
      load()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  const filterBtns: Array<{ id: typeof filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'student', label: 'Students' },
    { id: 'teacher', label: 'Teachers' },
    { id: 'admin', label: 'Admins' },
  ]

  return (
    <div>
      {err     && <ErrBanner    msg={err}     onDismiss={() => setErr('')} />}
      {success && <SuccessBanner msg={success} onDismiss={() => setSuccess('')} />}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {filterBtns.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: filter === f.id ? 'rgba(79, 124, 255, 0.15)' : '#151922',
            color: filter === f.id ? '#66D9FF' : '#9CA3AF',
            border: filter === f.id ? '1px solid rgba(79, 124, 255, 0.3)' : '1px solid #1f2532',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{f.label}</button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #1f2532',
          borderRadius: 6, padding: '5px 10px', color: '#6B7280', cursor: 'pointer' }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {loading ? <Spinner /> : members.length === 0
        ? <EmptyState icon={Users} title="No members found" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map(m => (
              <Card key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                <Avatar name={m.name} url={m.avatar_url} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {m.name}
                    <RoleBadge role={m.role} />
                    <StatusBadge status={m.status} />
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {m.subject && `${m.subject} · `}
                    {m.class_name && `Class ${m.class_name} · `}
                    {m.last_login_at ? `Last seen ${fmtDateShort(m.last_login_at)}` : 'Never logged in'}
                  </div>
                </div>
                {m.id !== selfId && m.role !== 'admin' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {m.status === 'pending'   && <Btn size="sm" variant="success" disabled={!!busy} onClick={() => act('approve',   m)}><Check size={11} /> Approve</Btn>}
                    {m.status === 'active'    && <Btn size="sm" variant="warning" disabled={!!busy} onClick={() => act('suspend',   m)}><Ban size={11} /> Suspend</Btn>}
                    {m.status === 'suspended' && <Btn size="sm" variant="success" disabled={!!busy} onClick={() => act('reinstate', m)}><Unlock size={11} /> Reinstate</Btn>}
                    <Btn size="sm" variant="danger" disabled={!!busy} onClick={() => act('remove', m)}><Trash2 size={11} /></Btn>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      }
    </div>
  )
}

// Tasks ───────────────────────────────────────────────────────────────────────
function AdminTasks({ schoolId: _schoolId }: { schoolId: string }) {
  const [tasks, setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')

  useEffect(() => {
    setLoading(true)
    api('/tasks')
      .then(d => setTasks(Array.isArray(d) ? d : (d.tasks || [])))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (err) return <ErrBanner msg={err} />
  if (tasks.length === 0) return <EmptyState icon={BookOpen} title="No tasks yet" sub="Teachers can create tasks from their portal." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map(t => (
        <Card key={t.id} style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 14 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                {t.subject && `${t.subject} · `}
                {t.target_class && `Class ${t.target_class} · `}
                {t.due_date && `Due ${fmtDateShort(t.due_date)} · `}
                Max {t.max_score} pts
              </div>
              {t.creator && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>by {t.creator.name}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <StatusBadge status={t.status} />
              {t.submission_count !== undefined && (
                <span style={{ fontSize: 11, color: '#6B7280' }}>{t.submission_count} submitted</span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// Network Rules ───────────────────────────────────────────────────────────────
function AdminNetwork({ schoolId: _schoolId }: { schoolId: string }) {
  const [rules, setRules]     = useState<NetworkRule[]>([])
  const [yourIp, setYourIp]   = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy]       = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel]     = useState('')
  const [cidr, setCidr]       = useState('')

  const load = useCallback(() => {
    setLoading(true); setErr('')
    api('/network-rules')
      .then(d => { setRules(d.rules || []); setYourIp(d.your_ip || '') })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function addRule() {
    if (!label.trim() || !cidr.trim()) return setErr('Label and CIDR are required.')
    setBusy('add'); setErr('')
    try {
      await api('/network-rules', { method: 'POST', body: JSON.stringify({ label, cidr }) })
      setSuccess('Rule added.')
      setLabel(''); setCidr(''); setShowForm(false)
      load()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  async function toggle(r: NetworkRule) {
    setBusy(r.id)
    try {
      await api(`/network-rules/${r.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !r.enabled }) })
      setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  async function del(r: NetworkRule) {
    if (!confirm(`Delete rule "${r.label}"?`)) return
    setBusy(r.id)
    try {
      await api(`/network-rules/${r.id}`, { method: 'DELETE' })
      setRules(prev => prev.filter(x => x.id !== r.id))
      setSuccess(`Rule "${r.label}" deleted.`)
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(null) }
  }

  return (
    <div>
      {err     && <ErrBanner    msg={err}     onDismiss={() => setErr('')} />}
      {success && <SuccessBanner msg={success} onDismiss={() => setSuccess('')} />}

      <Card style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Globe size={16} color="#4F7CFF" />
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Your current IP:</span>
        <code style={{ fontSize: 13, color: '#66D9FF', background: 'rgba(79, 124, 255, 0.08)',
          padding: '2px 8px', borderRadius: 5 }}>{yourIp || '…'}</code>
        {rules.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>
            {rules.filter(r => r.enabled).length} active rule{rules.filter(r => r.enabled).length !== 1 ? 's' : ''}
          </span>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>IP Whitelist Rules</span>
        <Btn variant="primary" size="sm" onClick={() => setShowForm(s => !s)}>
          <Plus size={12} /> Add Rule
        </Btn>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 12 }}>New Network Rule</div>
              <Input label="Label" value={label} onChange={setLabel} placeholder="e.g. School Wi-Fi" required />
              <Input label="CIDR" value={cidr} onChange={setCidr} placeholder="e.g. 192.168.1.0/24 or 203.0.113.5/32" required />
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, marginTop: -8 }}>
                Use /32 for a single IP. Admins always bypass this restriction.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="primary" onClick={addRule} disabled={busy === 'add'}>
                  {busy === 'add' ? <Loader2 size={12} /> : 'Add Rule'}
                </Btn>
                <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <Spinner /> : rules.length === 0
        ? <EmptyState icon={WifiOff} title="No network rules" sub="When rules are added, only users on matching IPs can log in." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rules.map(r => (
              <Card key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                opacity: r.enabled ? 1 : 0.55 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8,
                  background: r.enabled ? 'rgba(165, 180, 252, 0.12)' : 'rgba(79, 124, 255, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.enabled ? <Wifi size={16} color="#A5B4FC" /> : <WifiOff size={16} color="#66D9FF" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 13 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    <code style={{ color: '#66D9FF' }}>{r.cidr}</code>
                    {r.creator && ` · added by ${r.creator.name}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge status={r.enabled ? 'active' : 'suspended'} />
                  <button onClick={() => toggle(r)} disabled={!!busy} title={r.enabled ? 'Disable' : 'Enable'}
                    style={{ background: 'none', border: '1px solid #1f2532', borderRadius: 6, padding: '4px 8px',
                      cursor: 'pointer', color: r.enabled ? '#A5B4FC' : '#A5B4FC' }}>
                    {r.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => del(r)} disabled={!!busy} title="Delete"
                    style={{ background: 'none', border: '1px solid #1f2532', borderRadius: 6, padding: '4px 8px',
                      cursor: 'pointer', color: '#66D9FF' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  )
}

// Login Logs ──────────────────────────────────────────────────────────────────
function AdminLogs({ schoolId }: { schoolId: string }) {
  const [logs, setLogs]       = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [failOnly, setFailOnly] = useState(false)

  const load = useCallback(() => {
    setLoading(true); setErr('')
    api(`/schools/${schoolId}/login-logs?limit=100${failOnly ? '&failed=true' : ''}`)
      .then(d => setLogs(d.logs || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [schoolId, failOnly])

  useEffect(() => { load() }, [load])

  const reasonLabels: Record<string, string> = {
    wrong_credentials: 'Wrong password',
    profile_missing:   'No profile',
    suspended:         'Suspended',
    pending_approval:  'Pending approval',
    network_blocked:   'Network blocked',
  }

  return (
    <div>
      {err && <ErrBanner msg={err} onDismiss={() => setErr('')} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>Recent Login Activity</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFailOnly(f => !f)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: failOnly ? 'rgba(79, 124, 255, 0.15)' : '#151922',
            color: failOnly ? '#66D9FF' : '#9CA3AF',
            border: failOnly ? '1px solid rgba(79, 124, 255, 0.3)' : '1px solid #1f2532',
            fontFamily: 'inherit',
          }}>
            <AlertTriangle size={11} style={{ marginRight: 4 }} />
            Failed only
          </button>
          <button onClick={load} style={{ background: 'none', border: '1px solid #1f2532',
            borderRadius: 6, padding: '5px 8px', color: '#6B7280', cursor: 'pointer' }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : logs.length === 0
        ? <EmptyState icon={LogIn} title="No login records" sub="Activity appears here as users log in." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map(l => (
              <Card key={l.id} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: l.success ? 'rgba(165, 180, 252, 0.12)' : 'rgba(79, 124, 255, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {l.success
                    ? <CheckCircle size={14} color="#A5B4FC" />
                    : <AlertCircle size={14} color="#66D9FF" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: l.success ? '#fafafa' : '#66D9FF' }}>
                    {l.user?.name || l.email}
                    {l.user && <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 11 }}> · {l.email}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <code style={{ color: '#66D9FF' }}>{l.ip_address}</code>
                    {!l.success && l.reason && (
                      <span style={{ color: '#66D9FF' }}>{reasonLabels[l.reason] || l.reason}</span>
                    )}
                    {l.user && <RoleBadge role={l.user.role} />}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#4B5563', flexShrink: 0, textAlign: 'right' }}>
                  {fmtDateShort(l.created_at)}
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  )
}

// Settings ────────────────────────────────────────────────────────────────────
function AdminSettings({ schoolId, profile }: { schoolId: string; profile: AuthProfile }) {
  const [school, setSchool]       = useState<SchoolInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [success, setSuccess]     = useState('')
  const [busy, setBusy]           = useState(false)

  // School settings form
  const [schoolName, setSchoolName] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [domain, setDomain]         = useState('')
  const [reqApproval, setReqApproval] = useState(false)

  // Passcode modal
  const [newPasscode, setNewPasscode] = useState('')
  const [passkeyModal, setPasskeyModal] = useState(false)

  // Add Teacher modal
  const [teacherModal, setTeacherModal] = useState(false)
  const [tName, setTName]   = useState('')
  const [tEmail, setTEmail] = useState('')
  const [tPass, setTPass]   = useState('')
  const [tSubject, setTSubject] = useState('')
  const [tBusy, setTBusy]   = useState(false)

  useEffect(() => {
    setLoading(true)
    api(`/schools/${schoolId}`)
      .then((d: SchoolInfo) => {
        setSchool(d)
        setSchoolName(d.school_name)
        setSchoolEmail(d.school_email)
        setDomain(d.domain || '')
        setReqApproval(d.require_approval)
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [schoolId])

  async function saveSettings() {
    setBusy(true); setErr(''); setSuccess('')
    try {
      await api(`/schools/${schoolId}`, {
        method: 'PUT',
        body: JSON.stringify({
          school_name: schoolName,
          school_email: schoolEmail,
          domain: domain || null,
          require_approval: reqApproval,
        }),
      })
      setSuccess('School settings saved.')
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  async function regenPasscode() {
    if (!confirm('This will invalidate the old passcode. Anyone who wants to join must use the new one.')) return
    setBusy(true); setErr('')
    try {
      const d = await api(`/schools/${schoolId}/regenerate-passcode`, { method: 'POST' })
      setNewPasscode(d.passcode)
      setPasskeyModal(true)
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  async function addTeacher() {
    if (!tName || !tEmail || !tPass) return setErr('Name, email, and password are required.')
    setTBusy(true); setErr('')
    try {
      await api(`/schools/${schoolId}/teachers`, {
        method: 'POST',
        body: JSON.stringify({ name: tName, email: tEmail, password: tPass, subject: tSubject }),
      })
      setSuccess(`Teacher "${tName}" added.`)
      setTeacherModal(false)
      setTName(''); setTEmail(''); setTPass(''); setTSubject('')
    } catch (e: any) { setErr(e.message) }
    finally { setTBusy(false) }
  }

  if (loading) return <Spinner />

  return (
    <div>
      {err     && <ErrBanner    msg={err}     onDismiss={() => setErr('')} />}
      {success && <SuccessBanner msg={success} onDismiss={() => setSuccess('')} />}

      {/* School Info */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 16, display: 'flex', gap: 8 }}>
          <Building2 size={16} color="#4F7CFF" /> School Information
        </div>
        <Input label="School Name"  value={schoolName}  onChange={setSchoolName}  required />
        <Input label="School Email" value={schoolEmail} onChange={setSchoolEmail} type="email" required />
        <Input label="Domain (optional)" value={domain} onChange={setDomain} placeholder="e.g. schoolname.edu.in" />

        {/* Require approval toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          padding: '12px 14px', background: '#0E1117', borderRadius: 8, border: '1px solid #1f2532' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Require Admin Approval</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>New students must be approved before accessing school features.</div>
          </div>
          <button onClick={() => setReqApproval(v => !v)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: reqApproval ? '#A5B4FC' : '#6B7280',
          }}>
            {reqApproval ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>

        <Btn variant="primary" onClick={saveSettings} disabled={busy}>
          {busy ? <Loader2 size={13} /> : 'Save Settings'}
        </Btn>
      </Card>

      {/* Danger Zone */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 4, display: 'flex', gap: 8 }}>
          <Key size={16} color="#A5B4FC" /> School Passcode
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
          Members use this passcode when joining. Regenerating it instantly invalidates the old one.
        </div>
        <Btn variant="warning" onClick={regenPasscode} disabled={busy}>
          <RefreshCw size={12} /> Regenerate Passcode
        </Btn>
      </Card>

      {/* Add Teacher */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 4, display: 'flex', gap: 8 }}>
          <UserPlus size={16} color="#A5B4FC" /> Add Teacher Account
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
          Create a teacher account directly — no school passcode needed.
        </div>
        <Btn variant="primary" onClick={() => setTeacherModal(true)}>
          <UserPlus size={12} /> Add Teacher
        </Btn>
      </Card>

      {/* Passcode reveal modal */}
      <Modal open={passkeyModal} onClose={() => setPasskeyModal(false)} title="New School Passcode" width={420}>
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <Key size={32} color="#A5B4FC" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>Save this passcode — it will never be shown again.</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, color: '#fafafa',
            background: '#0E1117', border: '1px solid #2a2a2a', borderRadius: 10, padding: '14px 20px',
            fontFamily: 'monospace', userSelect: 'all' }}>
            {newPasscode}
          </div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 8 }}>Click the passcode to select it, then copy.</div>
        </div>
        <Btn variant="primary" onClick={() => { navigator.clipboard.writeText(newPasscode); setPasskeyModal(false) }}
          style={{ width: '100%' }}>
          Copy &amp; Close
        </Btn>
      </Modal>

      {/* Add Teacher modal */}
      <Modal open={teacherModal} onClose={() => setTeacherModal(false)} title="Add Teacher Account">
        <Input label="Full Name"  value={tName}    onChange={setTName}    required />
        <Input label="Email"      value={tEmail}   onChange={setTEmail}   type="email" required />
        <Input label="Password"   value={tPass}    onChange={setTPass}    type="password" required />
        <Input label="Subject (optional)" value={tSubject} onChange={setTSubject} placeholder="e.g. Mathematics" />
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="primary" onClick={addTeacher} disabled={tBusy}>
            {tBusy ? <Loader2 size={13} /> : 'Create Account'}
          </Btn>
          <Btn variant="ghost" onClick={() => setTeacherModal(false)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ─── TEACHER HUB ─────────────────────────────────────────────────────────────
function TeacherHub({ profile, schoolId }: { profile: AuthProfile; schoolId: string }) {
  const [tab, setTab] = useState('tasks')

  const tabs = [
    { id: 'tasks',  label: 'My Tasks',      icon: BookOpen },
    { id: 'create', label: 'Create Task',   icon: Plus },
    { id: 'marks',  label: 'Enter Marks',   icon: BarChart3 },
    { id: 'notifs', label: 'Notifications', icon: Bell },
  ]

  return (
    <>
      <TabBar tabs={tabs} active={tab} setActive={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}>
          {tab === 'tasks'  && <TeacherTasks  schoolId={schoolId} />}
          {tab === 'create' && <CreateTask    schoolId={schoolId} onCreated={() => setTab('tasks')} />}
          {tab === 'marks'  && <TeacherMarks  schoolId={schoolId} profile={profile} />}
          {tab === 'notifs' && <NotifPanel    schoolId={schoolId} profile={profile} canSend />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

function TeacherTasks({ schoolId: _schoolId }: { schoolId: string }) {
  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')

  useEffect(() => {
    setLoading(true)
    api('/tasks')
      .then(d => setTasks(Array.isArray(d) ? d : (d.tasks || [])))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (err) return <ErrBanner msg={err} />
  if (tasks.length === 0) return <EmptyState icon={BookOpen} title="No tasks yet" sub='Create a task from the "Create Task" tab.' />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map(t => (
        <Card key={t.id} style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 14 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                {t.subject && `${t.subject} · `}
                {t.target_class && `Class ${t.target_class} · `}
                {t.due_date && `Due ${fmtDateShort(t.due_date)} · `}
                Max {t.max_score} pts
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <StatusBadge status={t.status} />
              {t.submission_count !== undefined && (
                <span style={{ fontSize: 11, color: '#6B7280' }}>{t.submission_count} submitted</span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function CreateTask({ schoolId: _schoolId, onCreated }: { schoolId: string; onCreated: () => void }) {
  const [title, setTitle]         = useState('')
  const [desc, setDesc]           = useState('')
  const [subject, setSubject]     = useState('')
  const [cls, setCls]             = useState('')
  const [dueDate, setDueDate]     = useState('')
  const [maxScore, setMaxScore]   = useState('100')
  const [loading, setLoading]     = useState(false)
  const [err, setErr]             = useState('')

  async function submit() {
    if (!title.trim()) return setErr('Title is required.')
    setLoading(true); setErr('')
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(), description: desc.trim() || undefined,
          subject: subject.trim() || undefined, target_class: cls.trim() || undefined,
          due_date: dueDate || undefined, max_score: parseInt(maxScore, 10) || 100,
        }),
      })
      onCreated()
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa', marginBottom: 18 }}>New Task</div>
      {err && <ErrBanner msg={err} onDismiss={() => setErr('')} />}
      <Input label="Title" value={title} onChange={setTitle} placeholder="e.g. Chapter 5 Assignment" required />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 5 }}>Description</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
          placeholder="Task instructions..."
          style={{ width: '100%', padding: '9px 12px', background: '#0E1117', border: '1px solid #2a2a2a',
            borderRadius: 8, color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none',
            resize: 'vertical', boxSizing: 'border-box' }}
          onFocus={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#4F7CFF' }}
          onBlur={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#2a2a2a' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Maths" />
        <Input label="Class" value={cls} onChange={setCls} placeholder="e.g. 10A" />
        <Input label="Due Date" value={dueDate} onChange={setDueDate} type="datetime-local" />
        <Input label="Max Score" value={maxScore} onChange={setMaxScore} type="number" />
      </div>
      <Btn variant="primary" onClick={submit} disabled={loading}>
        {loading ? <Loader2 size={13} /> : 'Create Task'}
      </Btn>
    </Card>
  )
}

// ─── STUDENT HUB ─────────────────────────────────────────────────────────────
function StudentHub({ profile, schoolId }: { profile: AuthProfile; schoolId: string }) {
  const [tab, setTab] = useState('tasks')

  const tabs = [
    { id: 'tasks', label: 'My Tasks',  icon: BookOpen },
    { id: 'marks', label: 'My Marks',  icon: BarChart3 },
    { id: 'feed',  label: 'Feed',      icon: Bell },
  ]

  return (
    <>
      <TabBar tabs={tabs} active={tab} setActive={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}>
          {tab === 'tasks' && <StudentTasks profile={profile} />}
          {tab === 'marks' && <StudentMarks profile={profile} schoolId={schoolId} />}
          {tab === 'feed'  && <NotifPanel   schoolId={schoolId} profile={profile} canSend={false} />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

function StudentTasks({ profile }: { profile: AuthProfile }) {
  const [tasks, setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [submitModal, setSubmitModal] = useState<Task | null>(null)
  const [answer, setAnswer]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setLoading(true)
    api('/tasks')
      .then(d => setTasks(Array.isArray(d) ? d : (d.tasks || [])))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [profile.id])

  async function submitTask() {
    if (!submitModal || !answer.trim()) return
    setSubmitting(true)
    try {
      await api(`/tasks/${submitModal.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      })
      setSuccess(`Submitted "${submitModal.title}" successfully.`)
      setSubmitModal(null); setAnswer('')
      setTasks(prev => prev.map(t => t.id === submitModal!.id
        ? { ...t, my_submission: { status: 'submitted', submitted_at: new Date().toISOString() } }
        : t
      ))
    } catch (e: any) { setErr(e.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Spinner />
  if (err) return <ErrBanner msg={err} />

  const active   = tasks.filter(t => t.status === 'active')
  const previous = tasks.filter(t => t.status !== 'active')

  return (
    <div>
      {success && <SuccessBanner msg={success} onDismiss={() => setSuccess('')} />}
      {active.length === 0 && previous.length === 0
        ? <EmptyState icon={Inbox} title="No tasks yet" sub="Your teacher has not assigned any tasks." />
        : (
          <>
            {active.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: 1, marginBottom: 8 }}>Active</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {active.map(t => (
                    <Card key={t.id} style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 14 }}>{t.title}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                            {t.subject && `${t.subject} · `}
                            {t.due_date && `Due ${fmtDateShort(t.due_date)} · `}
                            Max {t.max_score} pts
                          </div>
                          {t.description && (
                            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6, lineHeight: 1.5 }}>
                              {t.description}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                          {t.my_submission
                            ? <StatusBadge status={t.my_submission.status} />
                            : <Btn size="sm" variant="primary" onClick={() => { setSubmitModal(t); setAnswer('') }}>
                                <Send size={11} /> Submit
                              </Btn>
                          }
                          {t.my_submission?.score !== undefined && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC' }}>
                              {t.my_submission.score}/{t.max_score}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
            {previous.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: 1, marginBottom: 8 }}>Closed</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.65 }}>
                  {previous.map(t => (
                    <Card key={t.id} style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 13 }}>{t.title}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>{t.subject}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {t.my_submission
                            ? <StatusBadge status={t.my_submission.status} />
                            : <span style={{ fontSize: 12, color: '#6B7280' }}>Not submitted</span>
                          }
                          {t.my_submission?.score !== undefined && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC' }}>
                              {t.my_submission.score}/{t.max_score}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )
      }

      {/* Submit Modal */}
      <Modal open={!!submitModal} onClose={() => setSubmitModal(null)} title={`Submit: ${submitModal?.title}`}>
        {submitModal && (
          <>
            {submitModal.description && (
              <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.6 }}>
                {submitModal.description}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 5 }}>
                Your Answer / Response *
              </label>
              <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={5}
                placeholder="Type your answer here..."
                style={{ width: '100%', padding: '9px 12px', background: '#0E1117', border: '1px solid #2a2a2a',
                  borderRadius: 8, color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box' }}
                onFocus={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#4F7CFF' }}
                onBlur={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#2a2a2a' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="primary" onClick={submitTask} disabled={submitting || !answer.trim()}>
                {submitting ? <Loader2 size={13} /> : <><Send size={12} /> Submit</>}
              </Btn>
              <Btn variant="ghost" onClick={() => setSubmitModal(null)}>Cancel</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

// ─── SHARED NOTIFICATION PANEL ────────────────────────────────────────────────
function NotifPanel({ schoolId, profile, canSend }: { schoolId: string; profile: AuthProfile; canSend: boolean }) {
  const [notifs, setNotifs]   = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [success, setSuccess] = useState('')
  const [msg, setMsg]         = useState('')
  const [targetRole, setTargetRole] = useState('all')
  const [expiresIn, setExpiresIn]   = useState('24')
  const [sending, setSending]       = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api('/notifications')
      .then(d => setNotifs(Array.isArray(d) ? d : (d.notifications || [])))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [schoolId])

  useEffect(() => { load() }, [load])

  async function send() {
    if (!msg.trim()) return
    setSending(true); setErr('')
    try {
      await api('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          message: msg.trim(),
          target_role: targetRole,
          expires_in_hours: parseInt(expiresIn, 10) || 24,
        }),
      })
      setSuccess('Notification sent!')
      setMsg('')
      load()
    } catch (e: any) { setErr(e.message) }
    finally { setSending(false) }
  }

  const now = Date.now()

  return (
    <div>
      {err     && <ErrBanner    msg={err}     onDismiss={() => setErr('')} />}
      {success && <SuccessBanner msg={success} onDismiss={() => setSuccess('')} />}

      {canSend && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 12 }}>Send Notification</div>
          <div style={{ marginBottom: 10 }}>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2}
              placeholder="Broadcast message to school..."
              style={{ width: '100%', padding: '9px 12px', background: '#0E1117', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box' }}
              onFocus={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#4F7CFF' }}
              onBlur={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#2a2a2a' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={targetRole} onChange={e => setTargetRole(e.target.value)}
              style={{ padding: '7px 10px', background: '#0E1117', border: '1px solid #2a2a2a',
                borderRadius: 7, color: '#fafafa', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="all">Everyone</option>
              <option value="student">Students only</option>
              <option value="teacher">Teachers only</option>
            </select>
            <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)}
              style={{ padding: '7px 10px', background: '#0E1117', border: '1px solid #2a2a2a',
                borderRadius: 7, color: '#fafafa', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="1">Expires in 1h</option>
              <option value="6">Expires in 6h</option>
              <option value="24">Expires in 24h</option>
              <option value="72">Expires in 3 days</option>
              <option value="168">Expires in 7 days</option>
            </select>
            <Btn variant="primary" onClick={send} disabled={sending || !msg.trim()}>
              {sending ? <Loader2 size={13} /> : <><Send size={12} /> Send</>}
            </Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : notifs.length === 0
        ? <EmptyState icon={Bell} title="No notifications" sub="Nothing here yet." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifs.map(n => {
              const expires = new Date(n.expires_at).getTime()
              const created = new Date(n.created_at).getTime()
              const pct = Math.max(0, Math.min(100, ((expires - now) / (expires - created)) * 100))
              const barColor = pct > 50 ? '#A5B4FC' : pct > 20 ? '#A5B4FC' : '#66D9FF'
              return (
                <Card key={n.id} style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, color: '#d4d4d8', lineHeight: 1.5 }}>{n.message}</div>
                    <span style={{ fontSize: 10, color: '#4B5563', flexShrink: 0 }}>
                      {n.target_role !== 'all' ? `→ ${n.target_role}` : '→ everyone'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                    {n.sender_name && `from ${n.sender_name} · `}{fmtDate(n.created_at)}
                  </div>
                  <div style={{ height: 3, background: '#1f2532', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor,
                      borderRadius: 2, transition: 'width 1s linear' }} />
                  </div>
                </Card>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ─── MARKS HELPERS & COMPONENTS ──────────────────────────────────────────────

function gradeInfo(pct: number) {
  if (pct >= 90) return { label: 'A+', color: '#A5B4FC' }
  if (pct >= 75) return { label: 'A',  color: '#A5B4FC' }
  if (pct >= 60) return { label: 'B',  color: '#A5B4FC' }
  if (pct >= 45) return { label: 'C',  color: '#A5B4FC' }
  if (pct >= 33) return { label: 'D',  color: '#A5B4FC' }
  return { label: 'F', color: '#66D9FF' }
}

// Teacher marks tab: add marks + view school marks
function TeacherMarks({ schoolId, profile }: { schoolId: string; profile: AuthProfile }) {
  const [students, setStudents] = useState<Member[]>([])
  const [marks, setMarks]       = useState<Mark[]>([])
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [success, setSuccess]   = useState('')
  const [tab, setTab]           = useState<'add' | 'list'>('add')
  const [busy, setBusy]         = useState(false)

  // Form state
  const [studentId, setStudentId]   = useState('')
  const [subject, setSubject]       = useState('')
  const [examName, setExamName]     = useState('')
  const [obtained, setObtained]     = useState('')
  const [total, setTotal]           = useState('100')
  const [remarks, setRemarks]       = useState('')

  useEffect(() => {
    // Load students + existing marks for this teacher
    Promise.all([
      api(`/schools/${schoolId}/members?role=student`),
      api('/marks/school'),
    ])
      .then(([s, m]) => {
        setStudents(s.members || [])
        setMarks(m.marks || [])
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [schoolId])

  async function addMark() {
    if (!studentId || !subject || !examName || !obtained) {
      setErr('Student, subject, exam name and marks are required.')
      return
    }
    setBusy(true); setErr('')
    try {
      const d = await api('/marks', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId, subject: subject.trim(),
          exam_name: examName.trim(),
          marks_obtained: parseFloat(obtained), total_marks: parseFloat(total),
          remarks: remarks.trim() || undefined,
        }),
      })
      setSuccess('Marks added successfully.')
      setMarks(prev => [d.mark, ...prev])
      setStudentId(''); setSubject(''); setExamName(''); setObtained(''); setTotal('100'); setRemarks('')
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  async function deleteMark(id: string) {
    if (!confirm('Delete this mark entry?')) return
    try {
      await api(`/marks/${id}`, { method: 'DELETE' })
      setMarks(prev => prev.filter(m => m.id !== id))
      setSuccess('Mark deleted.')
    } catch (e: any) { setErr(e.message) }
  }

  if (loading) return <Spinner />

  return (
    <div>
      {err     && <ErrBanner    msg={err}     onDismiss={() => setErr('')} />}
      {success && <SuccessBanner msg={success} onDismiss={() => setSuccess('')} />}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <Btn size="sm" variant={tab === 'add' ? 'primary' : 'ghost'} onClick={() => setTab('add')}>
          <Plus size={12} /> Add Marks
        </Btn>
        <Btn size="sm" variant={tab === 'list' ? 'primary' : 'ghost'} onClick={() => setTab('list')}>
          <BarChart3 size={12} /> View Records ({marks.length})
        </Btn>
      </div>

      {tab === 'add' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 16 }}>Enter Marks</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 5 }}>
              Student <span style={{ color: '#66D9FF' }}>*</span>
            </label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', background: '#0E1117', border: '1px solid #2a2a2a',
                borderRadius: 8, color: studentId ? '#fafafa' : '#6B7280', fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">— Select student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.class_name ? ` (Class ${s.class_name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Subject *" value={subject} onChange={setSubject} placeholder="e.g. Mathematics" />
            <Input label="Exam / Test Name *" value={examName} onChange={setExamName} placeholder="e.g. Unit Test 1" />
            <Input label="Marks Obtained *" value={obtained} onChange={setObtained} type="number" placeholder="e.g. 85" />
            <Input label="Total Marks" value={total} onChange={setTotal} type="number" placeholder="100" />
          </div>
          <Input label="Remarks (optional)" value={remarks} onChange={setRemarks} placeholder="e.g. Excellent improvement!" />
          <Btn variant="primary" onClick={addMark} disabled={busy}>
            {busy ? <Loader2 size={13} /> : <><Check size={12} /> Save Marks</>}
          </Btn>
        </Card>
      )}

      {tab === 'list' && (
        marks.length === 0
          ? <EmptyState icon={BarChart3} title="No marks added yet" sub='Use the "Add Marks" tab to enter student marks.' />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {marks.map(m => {
                const pct = Math.round((m.marks_obtained / m.total_marks) * 100)
                const g   = gradeInfo(pct)
                return (
                  <Card key={m.id} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: `${g.color}18`, border: `1px solid ${g.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: g.color }}>
                      {g.label}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 13 }}>
                        {m.student?.name || '—'}
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>
                          {m.student?.class_name && ` · Class ${m.student.class_name}`}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>
                        {m.subject} · {m.exam_name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: g.color }}>
                        {m.marks_obtained}/{m.total_marks}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{pct}%</div>
                    </div>
                    <button onClick={() => deleteMark(m.id)} title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#66D9FF' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280' }}>
                      <Trash2 size={13} />
                    </button>
                  </Card>
                )
              })}
            </div>
          )
      )}
    </div>
  )
}

// Student marks tab: view own marks + generate parent code
function StudentMarks({ profile, schoolId }: { profile: AuthProfile; schoolId: string }) {
  const [marks, setMarks]       = useState<Mark[]>([])
  const [summary, setSummary]   = useState<MarkSummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [code, setCode]         = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeExpiry, setCodeExpiry]   = useState<string | null>(null)
  const [codeCopied, setCodeCopied]   = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api('/marks/my'),
      api('/parent/my-code'),
    ])
      .then(([md, cd]) => {
        setMarks(md.marks || [])
        setSummary(md.summary || null)
        setCode(cd.code || null)
        setCodeExpiry(cd.expires_at || null)
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [profile.id])

  async function generateCode() {
    setCodeLoading(true)
    try {
      const d = await api('/parent/generate-code', { method: 'POST' })
      setCode(d.code)
      setCodeExpiry(d.expires_at)
    } catch (e: any) { setErr(e.message) }
    finally { setCodeLoading(false) }
  }

  function copyCode() {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  if (loading) return <Spinner />

  return (
    <div>
      {err && <ErrBanner msg={err} onDismiss={() => setErr('')} />}

      {/* Parent access code section */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 4, display: 'flex', gap: 8 }}>
          <QrCode size={16} color="#66D9FF" /> Parent Access Code
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
          Share this code with your parent so they can create a Parent account and view your marks.
        </div>
        {code ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#66D9FF',
              background: 'rgba(79, 124, 255, 0.08)', border: '1px solid rgba(79, 124, 255, 0.2)',
              borderRadius: 8, padding: '8px 14px', fontFamily: 'monospace' }}>
              {code}
            </code>
            <Btn size="sm" variant="ghost" onClick={copyCode}>
              {codeCopied ? <><Check size={12} /> Copied!</> : 'Copy'}
            </Btn>
            <Btn size="sm" variant="warning" onClick={generateCode} disabled={codeLoading}>
              <RefreshCw size={12} /> New Code
            </Btn>
            {codeExpiry && (
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                Expires {new Date(codeExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
        ) : (
          <Btn variant="primary" onClick={generateCode} disabled={codeLoading}>
            {codeLoading ? <Loader2 size={13} /> : <><QrCode size={12} /> Generate Code</>}
          </Btn>
        )}
      </Card>

      {/* Marks */}
      {marks.length === 0 ? (
        <EmptyState icon={BarChart3} title="No marks yet" sub="Your teacher will enter marks here after each exam." />
      ) : (
        <>
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10, marginBottom: 16 }}>
              <StatCard label="Overall Avg" value={`${summary.average_percentage}%`} icon={Target}
                color={gradeInfo(summary.average_percentage).color} sub={gradeInfo(summary.average_percentage).label} />
              <StatCard label="Total Exams" value={summary.total_exams} icon={BookOpen} color="#66D9FF" />
              <StatCard label="Strong" value={summary.strong_subjects.length} icon={Star} color="#A5B4FC"
                sub={summary.strong_subjects.slice(0,2).join(', ') || '—'} />
              <StatCard label="Needs Work" value={summary.weak_subjects.length} icon={TrendingDown} color="#66D9FF"
                sub={summary.weak_subjects.slice(0,2).join(', ') || 'none'} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {marks.map((m, i) => {
              const pct = Math.round((m.marks_obtained / m.total_marks) * 100)
              const g   = gradeInfo(pct)
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}>
                  <Card style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: `${g.color}18`, border: `1px solid ${g.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: g.color }}>
                      {g.label}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#fafafa', fontSize: 13 }}>{m.exam_name}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>
                        {m.subject}{m.teacher && ` · ${m.teacher.name}`} · {fmtDate(m.created_at)}
                      </div>
                      {m.remarks && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' }}>"{m.remarks}"</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: g.color }}>
                        {m.marks_obtained}<span style={{ fontSize: 11, color: '#6B7280' }}>/{m.total_marks}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{pct}%</div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// Admin marks audit tab
function AdminMarksAudit({ schoolId }: { schoolId: string }) {
  const [marks, setMarks]   = useState<Mark[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [links, setLinks]     = useState<any[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api('/marks/school?limit=100'),
      api('/parent/links'),
    ])
      .then(([md, ld]) => {
        setMarks(md.marks || [])
        setLinks(ld.links || [])
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [schoolId])

  if (loading) return <Spinner />
  if (err) return <ErrBanner msg={err} />

  return (
    <div>
      {/* Parent links summary */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 10, display: 'flex', gap: 8 }}>
          <Users size={16} color="#4F7CFF" /> Parent Links ({links.length})
        </div>
        {links.length === 0
          ? <div style={{ fontSize: 13, color: '#6B7280' }}>No parents linked yet. Students generate codes from their Marks tab.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {links.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#d4d4d8' }}>
                  <span style={{ fontSize: 11, background: 'rgba(79, 124, 255, 0.12)', color: '#66D9FF',
                    borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>Parent</span>
                  {l.parent?.name} →
                  <span style={{ fontSize: 11, background: 'rgba(165, 180, 252, 0.12)', color: '#A5B4FC',
                    borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>Student</span>
                  {l.student?.name}
                  {l.student?.class_name && <span style={{ color: '#6B7280' }}>Class {l.student.class_name}</span>}
                </div>
              ))}
            </div>
          )
        }
      </Card>

      {/* Marks audit */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>
        All Mark Records ({marks.length})
      </div>
      {marks.length === 0
        ? <EmptyState icon={BarChart3} title="No marks entered" sub="Teachers enter marks from their Marks tab." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {marks.map(m => {
              const pct = Math.round((m.marks_obtained / m.total_marks) * 100)
              const g   = gradeInfo(pct)
              return (
                <Card key={m.id} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${g.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: g.color }}>
                    {g.label}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>
                      {m.student?.name || '—'}
                      {m.student?.class_name && <span style={{ color: '#6B7280', fontWeight: 400 }}> · Class {m.student.class_name}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {m.subject} · {m.exam_name}
                      {m.teacher && ` · by ${m.teacher.name}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: g.color }}>{m.marks_obtained}/{m.total_marks}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{pct}%</div>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ─── DEFAULT EXPORT ───────────────────────────────────────────────────────────
interface SchoolHubProps {
  profile: AuthProfile
}

export default function SchoolHub({ profile }: SchoolHubProps) {
  const role     = profile.role as 'admin' | 'teacher' | 'student'
  const schoolId = profile.school_id

  if (!schoolId) return <NoSchoolView />

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#050505',
      fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px' }}>
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
