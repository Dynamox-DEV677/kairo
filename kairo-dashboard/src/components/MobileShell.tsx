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
  AlertTriangle, Beaker,
} from 'lucide-react'
import type { AuthProfile } from '../pages/Login'
import { DecoratedAvatar } from './AvatarDecor'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

// ─── Item lists (role-aware, ordered by use frequency) ──────────────────────
const STUDENT_BOTTOM: NavItem[] = [
  { to: 'kairo-os',  label: 'Kyno',    icon: Brain },
  { to: 'doubt',     label: 'Solve',    icon: MessageCircle },
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

// Drawer groupings (full feature list — deprecated pages removed)
const DRAWER_STUDENT = [
  {
    title: 'Core',
    items: [
      { to: 'kairo-os',       label: 'Kyno',           icon: Brain },
      { to: 'doubt',          label: "Kyno's Solver",     icon: MessageCircle },
      { to: 'mistakes',       label: 'Mistake Analysis',   icon: Activity },
      { to: 'explain-mistake',label: 'Explain Mistake',    icon: AlertTriangle },
      { to: 'simulator',      label: 'Revision Simulator', icon: Zap },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: 'labs',         label: 'Kyno Labs',     icon: Beaker },
      { to: 'flashcards',   label: 'Flashcards',     icon: BookMarked },
      { to: 'camera',       label: 'Camera Study',   icon: Camera },
      { to: 'concept-map',  label: 'Concept Map',    icon: Network },
      { to: 'knowledge',    label: 'Knowledge Graph', icon: Network },
      { to: 'essay',        label: 'Grader',         icon: FileText },
    ],
  },
  {
    title: 'Plan',
    items: [
      { to: 'study-plan',   label: 'Smart Timetable', icon: Calendar },
      { to: 'exam-planner', label: 'Exam Planner',    icon: Calendar },
      { to: 'topic-architect', label: 'Topic Architect', icon: Brain },
      { to: 'school',       label: 'My Tasks',        icon: BookOpen },
      { to: 'quiz',         label: 'Adaptive Quiz',   icon: Brain },
      { to: 'focus',        label: 'Focus Mode',      icon: Target },
      { to: 'pomodoro',     label: 'Pomodoro',        icon: Timer },
    ],
  },
  {
    title: 'Progress',
    items: [
      { to: 'battle',          label: 'Battle Mode',       icon: Swords },
      { to: 'perf-predictor',  label: 'Performance Predictor', icon: TrendingUp },
      { to: 'notebook',        label: 'AI Notebook',       icon: BookOpen },
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
      { to: 'doubt',          label: "Kyno's Solver",         icon: MessageCircle },
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
  {
    title: 'Insights',
    items: [
      { to: 'analytics',      label: 'Analytics',            icon: Activity },
      { to: 'ops',            label: 'Ops Dashboard',        icon: Grid3x3 },
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
      // iOS-style frosted bar — light blur; heavy blur stalls weak GPUs
      background: 'rgba(10, 13, 20, 0.9)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(102,217,255,0.12)',
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 14px',
    }}>
      <button onClick={onOpenDrawer} aria-label="Menu" style={{
        width: 38, height: 38, borderRadius: 12,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#B1B5BA',
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
            fontSize: 10, color: '#4F7CFF', fontWeight: 700,
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
          background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(79, 124, 255, 0.10)',
          border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(79, 124, 255, 0.3)'}`,
          color: copied ? '#34d399' : '#A5B4FC',
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
// Floating glass dock — premium 4-tab + More overflow nav
// ════════════════════════════════════════════════════════════════════════════
function BottomNav({
  active, setActive, profile, onOpenMore,
}: MobileShellProps & { onOpenMore: () => void }) {
  const items = getBottomNav(profile?.role)
  // Parent gets no bottom nav (uses standalone dashboard)
  if (profile?.role === 'parent') return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
      paddingLeft: 12, paddingRight: 12,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'stretch', gap: 4,
        padding: '6px 8px',
        background: 'rgba(14, 14, 22, 0.9)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(102, 217, 255, 0.22)',
        borderRadius: 22,
        boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 40px rgba(79, 124, 255, 0.01), inset 0 1px 0 rgba(255,255,255,0.05)',
        maxWidth: 360, width: '100%',
      }}>
        {items.map(item => {
          const isActive = active === item.to
          const Icon = item.icon
          return (
            <button key={item.to}
              data-bottom-tab="true"
              onClick={() => setActive(item.to)}
              aria-label={item.label}
              style={{
                flex: 1,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '8px 0', position: 'relative',
                color: isActive ? '#fafafa' : '#9CA3AF',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
                borderRadius: 14,
              }}>
              {isActive && (
                <motion.div layoutId="dock-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, rgba(165, 180, 252, 0.18), rgba(79, 124, 255, 0.16))',
                    border: '1px solid rgba(165, 180, 252, 0.30)',
                    borderRadius: 14,
                    boxShadow: '0 4px 14px rgba(79, 124, 255, 0.03)',
                  }} />
              )}
              <Icon size={20} style={{ position: 'relative', strokeWidth: isActive ? 2.4 : 1.8 }} />
              <span style={{
                position: 'relative',
                fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
                color: isActive ? '#fafafa' : '#B1B5BA',
              }}>{item.label}</span>
            </button>
          )
        })}
        <button onClick={onOpenMore}
          data-bottom-tab="true"
          aria-label="More"
          style={{
            flex: 1,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2, padding: '8px 0', color: '#9CA3AF',
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
            borderRadius: 14,
          }}>
          <MoreHorizontal size={20} style={{ strokeWidth: 1.8 }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.2, color: '#B1B5BA' }}>More</span>
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
          // Near-opaque panel, NO backdrop blur: a 26px blur over the whole
          // page froze weak GPUs (30s+ input lag on integrated graphics).
          background: 'linear-gradient(160deg, rgba(12,16,26,0.985) 0%, rgba(6,8,13,0.99) 100%)',
          borderRight: '1px solid rgba(102,217,255,0.14)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '4px 0 40px rgba(0,0,0,0.6)',
        }}>
        {/* Header — squircle brand tile + Kyno wordmark (desktop-match) */}
        <div style={{
          margin: '14px 14px 8px',
          padding: '12px 14px',
          borderRadius: 18,
          background: 'linear-gradient(150deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(102,217,255,0.16)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(150deg, #0B0F1C 0%, #05060A 100%)',
            border: '1px solid rgba(102,217,255,0.30)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 18px rgba(79,124,255,0.30), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            <img src="/kairo-mark.svg" alt="Kyno"
              style={{ width: '74%', height: '74%', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(102,217,255,0.45))' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 700, color: '#F5F5F7',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              letterSpacing: 0.2,
              textShadow: '0 0 18px rgba(79,124,255,0.4)',
            }}>Kyno</div>
            <div style={{ fontSize: 8.5, fontWeight: 600, color: 'rgba(102,217,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.4 }}>
              Kairo Industries
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#B1B5BA', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Items — iOS Settings-style grouped cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 12px', WebkitOverflowScrolling: 'touch' }}>
          {groups.map(group => (
            <div key={group.title} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#6B7280',
                textTransform: 'uppercase', letterSpacing: 1.6,
                padding: '4px 12px 6px',
              }}>{group.title}</div>
              {/* Rounded glass card holding the group's rows */}
              <div style={{
                borderRadius: 14, overflow: 'hidden',
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                {group.items.map((item, idx) => {
                  const isActive = active === item.to
                  const Icon = item.icon
                  return (
                    <motion.button key={item.to}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => go(item.to)}
                      style={{
                        width: '100%', padding: '11px 12px',
                        background: isActive ? 'rgba(79, 124, 255, 0.14)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        color: isActive ? '#66D9FF' : '#d4d4d8',
                        fontFamily: 'inherit', fontSize: 14, fontWeight: isActive ? 700 : 500,
                        borderBottom: idx < group.items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        WebkitTapHighlightColor: 'transparent',
                        minHeight: 46,
                      }}>
                      {/* iOS-style icon tile */}
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        display: 'grid', placeItems: 'center',
                        background: isActive
                          ? 'linear-gradient(135deg, #4F7CFF, #2046C2)'
                          : 'rgba(102,217,255,0.08)',
                        border: isActive ? 'none' : '1px solid rgba(102,217,255,0.14)',
                        color: isActive ? '#fff' : '#A5B4FC',
                      }}>
                        <Icon size={15} />
                      </span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                      <ChevronRight size={14} style={{ color: isActive ? '#66D9FF' : '#3a3f4a' }} />
                    </motion.button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer — settings, theme, profile, logout */}
        <div style={{
          borderTop: `1px solid ${isDark ? '#1a1f2e' : '#e4e4e7'}`,
          padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button onClick={() => go('settings')}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 9,
                background: isDark ? '#151922' : '#f4f4f5',
                border: `1px solid ${isDark ? '#1f2532' : '#e4e4e7'}`,
                color: isDark ? '#B1B5BA' : '#6B7280', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              <Settings size={14} /> Settings
            </button>
            {/* Theme toggle removed — Kyno is dark-only. */}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 4px',
          }}>
            <DecoratedAvatar pic={profilePic} name={profile?.name || 'K'} size={34} rounded={9} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: isDark ? '#fafafa' : '#18181b',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{profile?.name || 'Guest'}</div>
              <div style={{
                fontSize: 10, color: isDark ? '#6B7280' : '#B1B5BA',
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
                color: isDark ? '#6B7280' : '#B1B5BA', padding: 6,
              }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}
