import { useState, useEffect, useCallback, useRef } from 'react'
import { showTabBar, isEmptyContentTap, NAV_REVEAL_MS } from '../lib/bottomSlot'
import { busyPages } from '../lib/keepMounted'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, BookMarked, Brain, Swords, Mic, Network, Layers, Users,
  BookOpen, Compass, Activity, Zap, Target, Camera, Star,
  Calendar, FileText, Edit3, Lightbulb, FunctionSquare, Timer,
  Megaphone, Bell, DollarSign, Bot, UserCheck, Grid3x3,
  Building2, GraduationCap, Shield, Sparkles, LogOut,
  Sun, Moon, Menu, X, ChevronRight, Key, Copy, Check,
  AlertTriangle, Beaker, Trophy, Headphones, MoreHorizontal, CalendarDays,
} from 'lucide-react'
import type { AuthProfile } from '../pages/Login'
import { DecoratedAvatar } from './AvatarDecor'
import { authToken, clearAuthTokens, profilePicRaw, removeStoredProfile } from '../lib/storage'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

// Post-cutover: four spaces, and no "More". The drawer (all seven groups)
// opens from the menu button in the top bar.
/**
 * Four spaces and a way to the rest.
 *
 * Home was taking a slot while Plan, Notes, Performance and Profile were
 * reachable only from the hamburger -- four of the seven spaces behind a menu
 * most students never open. Home is the daily brief, so it leads the More
 * sheet instead of holding a tab.
 */
const STUDENT_BOTTOM: NavItem[] = [
  { to: 'plan',          label: 'Plan',     icon: CalendarDays },
  { to: 'doubt-solving', label: 'Doubt',    icon: MessageCircle },
  { to: 'practice',      label: 'Practice', icon: Target },
  { to: 'progress',      label: 'Progress', icon: Trophy },
]

/** The fifth slot: the drawer, where the other three spaces and Home live. */
const MORE_TAB: NavItem = { to: '__more', label: 'More', icon: MoreHorizontal }

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
  { to: 'doubt', label: 'Home', icon: MessageCircle },
]

/**
 * THE CUTOVER: seven groups, one per space.
 *
 * The 32 items that were here are gone as separate destinations -- each space
 * absorbed its own, and SPACE_ALIASES in src/lib/spaces.ts redirects every old
 * route so no bookmark breaks. What still appears beside a space is a page no
 * space absorbed, filed under the group it belongs with.
 */
/**
 * The More sheet is what the tab bar does not show, and nothing else.
 *
 * It had grown back into the pre-cutover drawer -- Study Mode Live, My Tasks,
 * Switched board?, Which stream?, Concept Tools, Ask a question -- all of
 * which now live INSIDE a space. Listing them here is a second front door to
 * screens that already have one, and it is how the drawer got to 32 rows the
 * first time.
 */
/**
 * The drawer is the canonical list of what Kyno is: all seven spaces, always,
 * in the same order, whether or not a space happens to have a tab.
 *
 * It briefly listed only the three spaces without a tab, which was a smaller
 * menu but a worse one -- a student had no single place that answers "what can
 * this app do?", which is the confusion the consolidation existed to end.
 *
 * There is no separate Settings row. Settings IS space 7: board, class,
 * subjects, the privacy switches, backup, passcode, theme, download-my-data
 * and delete-account all live inside Profile & Settings. A Profile tile AND a
 * Settings button is precisely the scattered-menu problem, reintroduced one
 * row lower.
 */
const DRAWER_STUDENT = [
  {
    // not one of the seven; a shortcut to the daily brief
    title: 'Today',
    items: [
      { to: 'home', label: 'Your daily brief', icon: Star, sub: 'What to do right now' },
    ],
  },
  {
    title: 'Spaces',
    items: [
      { to: 'doubt-solving', label: 'Doubt Solving',          icon: MessageCircle,  sub: 'Ask, solve, understand' },
      { to: 'practice',      label: 'Practice & Assessment',  icon: Target,         sub: 'Quizzes, flashcards, mock tests' },
      { to: 'performance',   label: 'Performance Analysis',   icon: Activity,       sub: 'Mistakes, patterns, weak spots' },
      { to: 'plan',          label: 'Study Planner',          icon: CalendarDays,   sub: 'Goals, timetable, exam countdown' },
      { to: 'notes',         label: 'Notes & Resources',      icon: BookOpen,       sub: 'Your notes, formulas, revision reels' },
      { to: 'progress',      label: 'Progress & Competition', icon: Trophy,         sub: 'Map, battles, league, study rooms' },
      { to: 'profile',       label: 'Profile & Settings',     icon: UserCheck,      sub: 'Board, privacy, account' },
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

// Pages that take over the whole screen and supply their own chrome.
const IMMERSIVE_PAGES = new Set(['camera-live'])

/**
 * Whether the tab bar is showing, and how to get it back.
 *
 * The bar belongs to space ROOTS. A sub-screen, a running session, or an open
 * keyboard means the screen's own footer owns the bottom edge -- two fixed
 * stacks were colliding and the nav won, hiding "I'm stuck here" behind it.
 *
 * A swipe up from the bottom edge, or a tap on empty content, brings it back
 * for a few seconds. The back chevron is the discoverable route; this is the
 * safety net, and it auto-hides so an accidental reveal never sticks.
 */
function useTabBarVisible(page: string) {
  const [subScreen, setSubScreen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // a second hash segment IS a sub-screen -- the router made that true
  useEffect(() => {
    const read = () => setSubScreen(/^#\/[a-z0-9-]+\/[a-z0-9-]+/i.test(window.location.hash))
    read()
    window.addEventListener('hashchange', read)
    window.addEventListener('popstate', read)
    return () => { window.removeEventListener('hashchange', read); window.removeEventListener('popstate', read) }
  }, [])

  useEffect(() => {
    const isField = (el: any) => !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable ||
      (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color']
        .includes((el.getAttribute('type') || 'text').toLowerCase())))
    const onIn = (e: FocusEvent) => { if (isField(e.target)) setTyping(true) }
    const onOut = () => { window.setTimeout(() => setTyping(isField(document.activeElement)), 60) }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut) }
  }, [])

  const reveal = useCallback(() => {
    setRevealed(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setRevealed(false), NAV_REVEAL_MS)
  }, [])

  // swipe up from the bottom edge, and a tap on plain content
  useEffect(() => {
    let startY = 0
    const onStart = (e: TouchEvent) => { startY = e.touches[0]?.clientY ?? 0 }
    const onEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0]?.clientY ?? 0
      const fromEdge = startY > window.innerHeight - 40
      if (fromEdge && startY - endY > 30) reveal()
    }
    const onClick = (e: MouseEvent) => { if (isEmptyContentTap(e.target as Element)) reveal() }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('click', onClick)
      window.clearTimeout(timer.current)
    }
  }, [reveal])

  const busy = busyPages().size > 0
  return showTabBar(page, { atRoot: !subScreen, subScreen, busy, typing, revealed })
}

export default function MobileShell(props: MobileShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const immersive = IMMERSIVE_PAGES.has(props.active)
  const navVisible = useTabBarVisible(props.active)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    // immersive pages (Study Mode) open this drawer from their own floating dock
    const onOpen = () => setDrawerOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('kyno:open-drawer', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('kyno:open-drawer', onOpen)
    }
  }, [])

  // close the drawer when navigating away
  useEffect(() => { setDrawerOpen(false) }, [props.active])

  return (
    <>
      {!immersive && <MobileTopBar {...props} onOpenDrawer={() => setDrawerOpen(true)} />}
      {navVisible && <BottomNav {...props} onOpenMore={() => setDrawerOpen(true)} />}
      <AnimatePresence>
        {drawerOpen && (
          <MobileDrawer {...props} onClose={() => setDrawerOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

function MobileTopBar({
  pageTitle, isDark, profile, onOpenDrawer,
}: MobileShellProps & { onOpenDrawer: () => void }) {
  const [passcode, setPasscode] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!isAdmin || !profile?.school_id) return
    fetch(`/api/schools/${profile.school_id}/passcode`, {
      headers: { Authorization: `Bearer ${authToken() || ''}` },
    })
      .then(r => r.json())
      .then(d => { if (d?.passcode) setPasscode(d.passcode) })
      .catch(() => {})
  }, [isAdmin, profile?.school_id])

  // Status-bar handling differs by wrapper:
  //  - old TWA build ran immersive (no status bar) so the reported inset was
  //    spurious and we zeroed it,
  //  - the current Capacitor build draws the OS status bar OVER the WebView,
  //    so the inset is real and zeroing it hides the header behind the clock.
  // Default to honouring the inset: a few px of extra padding is a far smaller
  // problem than an unreachable menu button.
  const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor
  const isTwa = typeof document !== 'undefined' && document.referrer.startsWith('android-app://')
  const safeTop = (isTwa && !isCapacitor) ? '0px' : 'env(safe-area-inset-top, 0px)'

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 90,
      height: `calc(52px + ${safeTop})`,
      background: 'rgba(10, 13, 20, 0.9)',
      borderBottom: '1px solid rgba(165,180,252,0.12)',
      display: 'flex', alignItems: 'center', gap: 8,
      // NOTE: the `padding` shorthand must come BEFORE paddingTop, or it
      // silently wipes the safe-area inset out again.
      padding: '0 14px',
      paddingTop: safeTop,
    }}>
      <button onClick={onOpenDrawer} aria-label="Menu" style={{
        // 44 square: the floor for a thumb, and this was 38.
        width: 44, height: 44, borderRadius: 12,
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
            fontSize: 10, color: '#7C5CFF', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            ADMIN · {profile.school_name}
          </div>
        )}
      </div>

      {isAdmin && passcode && (
        <button onClick={() => {
          navigator.clipboard.writeText(passcode); setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        }} style={{
          padding: '6px 9px', borderRadius: 7,
          background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(124, 92, 255, 0.10)',
          border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(124, 92, 255, 0.3)'}`,
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

// The cutover removed "More": the four bottom slots are spaces, and the whole
// drawer opens from the menu button in the top bar.
function BottomNav({
  active, setActive, profile, onOpenMore,
}: MobileShellProps & { onOpenMore: () => void }) {
  const items = getBottomNav(profile?.role)

  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const isField = (el: any) => {
      if (!el) return false
      if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true
      if (el.tagName === 'INPUT') {
        const t = (el.getAttribute('type') || 'text').toLowerCase()
        return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'].includes(t)
      }
      return false
    }
    const onIn  = (e: FocusEvent) => { if (isField(e.target)) setHidden(true) }
    const onOut = () => { setTimeout(() => { if (!isField(document.activeElement)) setHidden(false) }, 60) }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])

  if (profile?.role === 'parent') return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
      paddingLeft: 12, paddingRight: 12,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none',
      transform: hidden ? 'translateY(160%)' : 'translateY(0)',
      opacity: hidden ? 0 : 1,
      transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
    }}>
      <div style={{
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'stretch', gap: 4,
        padding: '6px 8px',
        background: 'rgba(14, 14, 22, 0.9)',


        border: '1px solid rgba(165, 180, 252, 0.22)',
        borderRadius: 22,
        boxShadow: '0 6px 0 0 rgba(0,0,0,0.45), 0 18px 38px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        maxWidth: 360, width: '100%',
      }}>
        {([...items, MORE_TAB] as NavItem[]).map(item => {
          const isActive = active === item.to
          const Icon = item.icon as React.ComponentType<{ size?: number; style?: React.CSSProperties }>
          return (
            <motion.button key={item.to}
              data-bottom-tab="true"
              whileTap={{ scale: 0.88 }}
              onClick={() => (item.to === '__more' ? onOpenMore() : setActive(item.to))}
              aria-label={item.label}
              style={{
                flex: 1,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '8px 0', position: 'relative',
                color: isActive ? 'var(--c-purple-lite)' : '#9CA3AF',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
                borderRadius: 14,
              }}>
              {isActive && (
                <motion.div layoutId="dock-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, rgba(124, 92, 255,0.42), rgba(124, 92, 255,0.24))',
                    border: '1px solid rgba(124, 92, 255, 0.6)',
                    borderRadius: 14,
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35), 0 1px 0 0 var(--c-purple-deep)',
                  }} />
              )}
              <Icon size={20} style={{ position: 'relative', strokeWidth: isActive ? 2.6 : 1.8 }} />
              <span style={{
                position: 'relative',
                fontSize: 11.5, fontWeight: 800, letterSpacing: 0.2, fontFamily: 'var(--kyno-display)',
                color: isActive ? 'var(--c-purple-lite)' : '#B1B5BA',
              }}>{item.label}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function MobileDrawer({
  active, setActive, isDark, toggleTheme, profile, onLogout, onClose,
}: MobileShellProps & { onClose: () => void }) {
  const groups = getDrawerGroups(profile?.role)
  const profilePic = profile?.avatar_url || profilePicRaw() || null

  function go(to: string) {
    setActive(to)
    onClose()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
        }} />

      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 101,
          width: 'min(82vw, 320px)',
          background: 'linear-gradient(160deg, rgba(12,16,26,0.985) 0%, rgba(6,8,13,0.99) 100%)',
          borderRight: '1px solid rgba(165,180,252,0.14)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '4px 0 40px rgba(0,0,0,0.6)',
        }}>
        <div style={{
          margin: '14px 14px 8px',
          padding: '12px 14px',
          borderRadius: 18,
          background: 'linear-gradient(150deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(165,180,252,0.16)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(150deg, #0B0F1C 0%, #05060A 100%)',
            border: '1px solid rgba(165,180,252,0.30)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 18px rgba(124, 92, 255,0.30), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            <img src="/kairo-mark.svg" alt="Kyno"
              style={{ width: '74%', height: '74%', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(165,180,252,0.45))' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 700, color: '#F5F5F7',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              letterSpacing: 0.2,
              textShadow: '0 0 18px rgba(124, 92, 255,0.4)',
            }}>Kyno</div>
            <div style={{ fontSize: 8.5, fontWeight: 600, color: 'rgba(165,180,252,0.6)', textTransform: 'uppercase', letterSpacing: 1.4 }}>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 12px', WebkitOverflowScrolling: 'touch' }}>
          {groups.map(group => (
            <div key={group.title} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#6B7280',
                textTransform: 'uppercase', letterSpacing: 1.6,
                padding: '4px 12px 6px',
              }}>{group.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.items.map((item) => {
                  const isActive = active === item.to
                  const Icon = item.icon
                  return (
                    <button key={item.to}
                      onClick={() => go(item.to)}
                      className={`kyno-nav${isActive ? ' on' : ''}`}
                      style={{
                        width: '100%', padding: '11px 12px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        color: isActive ? '#fff' : '#d4d4d8',
                        fontFamily: 'inherit', fontSize: 14, fontWeight: isActive ? 700 : 500,
                        minHeight: 56,
                      }}>
                      <span className="kyno-ichip" style={{
                        width: 28, height: 28,
                        background: isActive
                          ? 'linear-gradient(135deg, #7C5CFF, #4A2FA8)'
                          : 'rgba(165,180,252,0.08)',
                        border: isActive ? 'none' : '1px solid rgba(165,180,252,0.14)',
                        color: isActive ? '#fff' : '#A5B4FC',
                      }}>
                        <Icon size={15} />
                      </span>
                      <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <span style={{ display: 'block' }}>{item.label}</span>
                        {(item as any).sub && (
                          /* what the space is FOR. The names alone do not tell a
                             student that battles live under Progress. */
                          <span style={{
                            display: 'block', fontSize: 11.5, fontWeight: 500, marginTop: 2,
                            color: isActive ? 'rgba(255,255,255,0.72)' : '#8A8FA0', lineHeight: 1.35,
                          }}>{(item as any).sub}</span>
                        )}
                      </span>
                      <ChevronRight size={14} style={{ color: isActive ? '#fff' : '#3a3f4a', flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          borderTop: `1px solid ${isDark ? '#171D2D' : '#e4e4e7'}`,
          padding: '10px 14px',
        }}>

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
                fontSize: 11.5, color: isDark ? '#6B7280' : '#B1B5BA',
                textTransform: 'capitalize',
              }}>{profile?.role || 'student'}{profile?.school_name ? ' · ' + profile.school_name : ''}</div>
            </div>
            <button onClick={() => {
              clearAuthTokens()
              clearAuthTokens()
              removeStoredProfile()
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
