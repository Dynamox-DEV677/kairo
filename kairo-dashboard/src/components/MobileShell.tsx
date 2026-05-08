/**
 * Mobile shell — bottom nav, slide-in drawer, slim top bar.
 * Replaces the desktop sidebar/top-bar pair under 768px.
 *
 * - BottomNav: 4 role-aware tabs + "More" → opens drawer
 * - MobileDrawer: full-height slide-in, lists every feature with grouping
 * - MobileTopBar: hamburger + page title + admin passcode pill (admins only)
 * - SafeAreaSpacer: handles iOS notch + Android nav bar via env(safe-area-inset-*)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, BookMarked, Brain, Swords, Mic, Network,
  BookOpen, Compass, Activity, Zap, Target, Camera, Star,
  Calendar, FileText, Edit3, Lightbulb, FunctionSquare, Timer,
  TrendingUp, Megaphone, Bell, DollarSign, Bot, UserCheck, Grid3x3,
  Building2, GraduationCap, Shield, Sparkles, Settings, LogOut,
  Sun, Moon, Menu, X, MoreHorizontal, ChevronRight, Key, Copy, Check,
} from 'lucide-react'
import type { AuthProfile } from '../pages/Login'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

// ─── Item lists (role-aware, ordered by use frequency) ──────────────────────
const STUDENT_BOTTOM: NavItem[] = [
  { to: 'doubt',     label: 'Solve',    icon: MessageCircle },
  { to: 'memory',    label: 'Brain',    icon: Brain },
  { to: 'battle',    label: 'Battle',   icon: Swords },
  { to: 'notebook',  label: 'Notes',    icon: BookOpen },
]

const TEACHER_BOTTOM: NavItem[] = [
  { to: 'teacher-ai', label: 'AI',       icon: Bot },
  { to: 'doubt',      label: 'Solve',    icon: MessageCircle },
  { to: 'essay',      label: 'Grader',   icon: FileText },
  { to: 'school',     label: 'Tasks',    icon: BookOpen },
]

const ADMIN_BOTTOM: NavItem[] = [
  { to: 'school',       label: 'Hub',       icon: Building2 },
  { to: 'announcement', label: 'Announce',  icon: Megaphone },
  { to: 'admission',    label: 'Admit',     icon: Bot },
  { to: 'fee-reminder', label: 'Fees',      icon: DollarSign },
]

const PARENT_BOTTOM: NavItem[] = [
  // Parent uses standalone ParentDashboard, not this shell
  { to: 'doubt', label: 'Home', icon: MessageCircle },
]

// Drawer groupings (full feature list)
const DRAWER_STUDENT = [
  {
    title: 'Core',
    items: [
      { to: 'doubt',      label: 'Doubt Solver',     icon: MessageCircle },
      { to: 'memory',     label: 'AI Memory',         icon: Brain },
      { to: 'mistakes',   label: 'Mistake Analysis',  icon: Activity },
      { to: 'simulator',  label: 'Revision Simulator', icon: Zap },
      { to: 'adaptive',   label: 'Adaptive Path',     icon: Compass },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: 'flashcards',   label: 'Flashcards',     icon: BookMarked },
      { to: 'camera',       label: 'Camera Study',   icon: Camera },
      { to: 'concept-map',  label: 'Concept Map',    icon: Network },
      { to: 'voice',        label: 'Voice Tutor',    icon: Mic },
      { to: 'knowledge',    label: 'Knowledge Graph', icon: Network },
      { to: 'essay',        label: 'Grader',         icon: FileText },
    ],
  },
  {
    title: 'Plan',
    items: [
      { to: 'study-plan',   label: 'Smart Timetable', icon: Calendar },
      { to: 'school',       label: 'My Tasks',        icon: BookOpen },
      { to: 'quiz',         label: 'Adaptive Quiz',   icon: Brain },
      { to: 'focus',        label: 'Focus Mode',      icon: Target },
      { to: 'pomodoro',     label: 'Pomodoro',        icon: Timer },
    ],
  },
  {
    title: 'Progress',
    items: [
      { to: 'battle',       label: 'Battle Mode',    icon: Swords },
      { to: 'analytics',    label: 'Analytics',      icon: TrendingUp },
      { to: 'gamification', label: 'My Progress',    icon: Star },
      { to: 'notebook',     label: 'AI Notebook',    icon: BookOpen },
    ],
  },
  {
    title: 'Other',
    items: [
      { to: 'writing',     label: 'Writing Tools',  icon: Edit3 },
      { to: 'concept',     label: 'Concept Tools',  icon: Lightbulb },
      { to: 'formula',     label: 'Formula Sheet',  icon: FunctionSquare },
    ],
  },
]

const DRAWER_TEACHER = [
  {
    title: 'AI Tools',
    items: [
      { to: 'teacher-ai',     label: 'AI Teacher Assistant', icon: Bot },
      { to: 'doubt',          label: 'Doubt Solver',         icon: MessageCircle },
      { to: 'essay',          label: 'Grader',                icon: FileText },
      { to: 'flashcards',     label: 'Flashcards',            icon: BookMarked },
    ],
  },
  {
    title: 'Class',
    items: [
      { to: 'school',         label: 'Tasks & Marks',       icon: BookOpen },
      { to: 'question-paper', label: 'Question Paper',      icon: BookOpen },
      { to: 'lesson-plan',    label: 'Lesson Plan',          icon: Calendar },
      { to: 'parent-message', label: 'Parent Message',       icon: Bell },
      { to: 'announcement',   label: 'Announcements',        icon: Megaphone },
    ],
  },
]

const DRAWER_ADMIN = [
  {
    title: 'School',
    items: [
      { to: 'school',         label: 'School Hub',           icon: Building2 },
      { to: 'announcement',   label: 'Announcements',        icon: Megaphone },
      { to: 'admission',      label: 'Admission Bot',         icon: Bot },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: 'fee-reminder',   label: 'Fee Reminder',         icon: DollarSign },
      { to: 'attendance',     label: 'Attendance',           icon: UserCheck },
      { to: 'timetable',      label: 'Timetable',            icon: Grid3x3 },
    ],
  },
]

function getBottomNav(role?: string): NavItem[] {
  switch (role) {
    case 'teacher': return TEACHER_BOTTOM
    case 'admin':   return ADMIN_BOTTOM
    case 'parent':  return PARENT_BOTTOM
    default:        return STUDENT_BOTTOM
  }
}
function getDrawerGroups(role?: string) {
  switch (role) {
    case 'teacher': return DRAWER_TEACHER
    case 'admin':   return DRAWER_ADMIN
    default:        return DRAWER_STUDENT
  }
}

interface MobileShellProps {
  active:      string
  setActive:   (v: string) => void
  pageTitle:   string
  isDark:      boolean
  toggleTheme: () => void
  profile?:    AuthProfile
  onLogout?:   () => void
}

// ════════════════════════════════════════════════════════════════════════════
// Main mobile shell — wraps top bar + drawer + bottom nav
// ════════════════════════════════════════════════════════════════════════════
export default function MobileShell(props: MobileShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <MobileTopBar {...props} onOpenDrawer={() => setDrawerOpen(true)} />
      <BottomNav {...props} onOpenMore={() => setDrawerOpen(true)} />
      <AnimatePresence>
        {drawerOpen && (
          <MobileDrawer {...props} onClose={() => setDrawerOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Top bar — slim, hamburger + title + admin passcode pill
// ════════════════════════════════════════════════════════════════════════════
function MobileTopBar({
  pageTitle, isDark, profile, onOpenDrawer,
}: MobileShellProps & { onOpenDrawer: () => void }) {
  const [passcode, setPasscode] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!isAdmin || !profile?.school_id) return
    fetch(`/api/schools/${profile.school_id}/passcode`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
    })
      .then(r => r.json())
      .then(d => { if (d?.passcode) setPasscode(d.passcode) })
      .catch(() => {})
  }, [isAdmin, profile?.school_id])

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 90,
      height: 'calc(52px + env(safe-area-inset-top))',
      paddingTop: 'env(safe-area-inset-top)',
      background: isDark ? 'rgba(13,13,13,0.92)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${isDark ? '#1a1a1a' : '#e4e4e7'}`,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 14px',
    }}>
      <button onClick={onOpenDrawer} aria-label="Menu" style={{
        width: 38, height: 38, borderRadius: 9,
        background: isDark ? '#161616' : '#f4f4f5',
        border: `1px solid ${isDark ? '#1e1e1e' : '#e4e4e7'}`,
        cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isDark ? '#a1a1aa' : '#52525b',
      }}>
        <Menu size={18} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, lineHeight: 1.1,
          color: isDark ? '#fafafa' : '#18181b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{pageTitle}</div>
        {isAdmin && profile?.school_name && (
          <div style={{
            fontSize: 10, color: '#6366f1', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            ADMIN · {profile.school_name}
          </div>
        )}
      </div>

      {/* Admin passcode chip — only on mobile if there's room */}
      {isAdmin && passcode && (
        <button onClick={() => {
          navigator.clipboard.writeText(passcode); setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        }} style={{
          padding: '6px 9px', borderRadius: 7,
          background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(99,102,241,0.10)',
          border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(99,102,241,0.3)'}`,
          color: copied ? '#34d399' : '#a5b4fc',
          fontFamily: 'Consolas, monospace', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {copied ? <Check size={11} /> : <Key size={11} />}
          <span>{copied ? 'Copied' : passcode.slice(0, 7)}</span>
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Bottom nav — sticky, 4 role tabs + More button
// ════════════════════════════════════════════════════════════════════════════
function BottomNav({
  active, setActive, isDark, profile, onOpenMore,
}: MobileShellProps & { onOpenMore: () => void }) {
  const items = getBottomNav(profile?.role)
  // Parent gets no bottom nav (uses standalone dashboard)
  if (profile?.role === 'parent') return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: isDark ? 'rgba(13,13,13,0.94)' : 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(14px)',
      borderTop: `1px solid ${isDark ? '#1a1a1a' : '#e4e4e7'}`,
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${items.length + 1}, 1fr)`,
        height: 60,
      }}>
        {items.map(item => {
          const isActive = active === item.to
          const Icon = item.icon
          return (
            <button key={item.to}
              onClick={() => setActive(item.to)}
              aria-label={item.label}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '6px 0', position: 'relative',
                color: isActive ? '#6366f1' : (isDark ? '#71717a' : '#71717a'),
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {isActive && (
                <motion.div layoutId="bottom-nav-pill"
                  style={{
                    position: 'absolute', top: 4, width: 32, height: 3, borderRadius: 2,
                    background: '#6366f1',
                  }} />
              )}
              <Icon size={20} />
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: isActive ? '#6366f1' : (isDark ? '#a1a1aa' : '#71717a'),
              }}>{item.label}</span>
            </button>
          )
        })}
        <button onClick={onOpenMore}
          aria-label="More"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '6px 0', color: isDark ? '#71717a' : '#71717a',
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}>
          <MoreHorizontal size={20} />
          <span style={{ fontSize: 10, fontWeight: 600, color: isDark ? '#a1a1aa' : '#71717a' }}>More</span>
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Drawer — slides in from left, full feature list grouped
// ════════════════════════════════════════════════════════════════════════════
function MobileDrawer({
  active, setActive, isDark, toggleTheme, profile, onLogout, onClose,
}: MobileShellProps & { onClose: () => void }) {
  const groups = getDrawerGroups(profile?.role)
  const profilePic = profile?.avatar_url || localStorage.getItem('kairo_profile_pic') || null

  function go(to: string) {
    setActive(to)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
        }} />

      {/* Drawer */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 101,
          width: 'min(82vw, 320px)',
          background: isDark ? '#0d0d0d' : '#fafafa',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '4px 0 30px rgba(0,0,0,0.5)',
        }}>
        {/* Header */}
        <div style={{
          padding: '18px 18px 14px',
          borderBottom: `1px solid ${isDark ? '#1a1a1a' : '#e4e4e7'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <img src="/kairo_logo.png" alt="Kairo"
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#fafafa' : '#18181b' }}>kairo</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1 }}>
              Accelerate Your Academics
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 8,
            background: isDark ? '#161616' : '#f4f4f5',
            border: `1px solid ${isDark ? '#1e1e1e' : '#e4e4e7'}`,
            color: isDark ? '#a1a1aa' : '#71717a', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {groups.map(group => (
            <div key={group.title} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: isDark ? '#52525b' : '#a1a1aa',
                textTransform: 'uppercase', letterSpacing: 1.5,
                padding: '6px 18px',
              }}>{group.title}</div>
              {group.items.map(item => {
                const isActive = active === item.to
                const Icon = item.icon
                return (
                  <motion.button key={item.to}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => go(item.to)}
                    style={{
                      width: '100%', padding: '12px 18px',
                      background: isActive
                        ? 'rgba(99,102,241,0.10)'
                        : 'transparent',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      color: isActive ? '#6366f1' : (isDark ? '#d4d4d8' : '#3f3f46'),
                      fontFamily: 'inherit', fontSize: 14, fontWeight: isActive ? 600 : 500,
                      borderLeft: `3px solid ${isActive ? '#6366f1' : 'transparent'}`,
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                    <Icon size={17} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {isActive && <ChevronRight size={14} />}
                  </motion.button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer — settings, theme, profile, logout */}
        <div style={{
          borderTop: `1px solid ${isDark ? '#1a1a1a' : '#e4e4e7'}`,
          padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button onClick={() => go('settings')}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 9,
                background: isDark ? '#161616' : '#f4f4f5',
                border: `1px solid ${isDark ? '#1e1e1e' : '#e4e4e7'}`,
                color: isDark ? '#a1a1aa' : '#52525b', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              <Settings size={14} /> Settings
            </button>
            <button onClick={toggleTheme} aria-label="Toggle theme"
              style={{
                width: 44, padding: 0, borderRadius: 9,
                background: isDark ? '#161616' : '#f4f4f5',
                border: `1px solid ${isDark ? '#1e1e1e' : '#e4e4e7'}`,
                color: isDark ? '#a1a1aa' : '#52525b', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 4px',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: profilePic ? 'transparent' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
              overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
            }}>
              {profilePic
                ? <img src={profilePic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (profile?.name?.charAt(0).toUpperCase() || 'K')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: isDark ? '#fafafa' : '#18181b',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{profile?.name || 'Guest'}</div>
              <div style={{
                fontSize: 10, color: isDark ? '#52525b' : '#a1a1aa',
                textTransform: 'capitalize',
              }}>{profile?.role || 'student'}{profile?.school_name ? ' · ' + profile.school_name : ''}</div>
            </div>
            <button onClick={() => {
              localStorage.removeItem('kairo_token')
              localStorage.removeItem('kairo_refresh')
              localStorage.removeItem('kairo_profile')
              if (onLogout) onLogout(); else window.location.reload()
            }} aria-label="Log out"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: isDark ? '#52525b' : '#a1a1aa', padding: 6,
              }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}
