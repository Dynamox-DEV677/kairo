import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, BookMarked, Calendar, FileText, BarChart3,
  BookOpen, Bell, Settings, LogOut, ChevronDown,
  Sun, Moon, Clock, Camera, Plus, X,
  GraduationCap, Shield, Sparkles, DollarSign, Bot, UserCheck, Grid3x3, Building2,
  Edit3, Lightbulb, FunctionSquare, Brain, Star, Timer, Megaphone,
  Target, Activity, Zap, Compass, Network, Mic, Swords, Share2, AlertTriangle,
  Beaker, Cpu, Trophy,
  PanelLeftClose, PanelLeftOpen, MoreHorizontal, ChevronUp,
} from 'lucide-react'
import { useGeneration } from '../lib/generationContext'
import { getRecentChats, deleteRecentChat, timeAgo } from '../lib/recentChats'
import type { RecentChat } from '../lib/recentChats'
import { selectXP } from '../lib/selectors'
import { DecoratedAvatar } from './AvatarDecor'

interface NavItem {
  label: string
  icon: React.ElementType
  badge?: number
  to: string
  color?: string
  /**
   * Known to be incomplete, duplicated, or dependent on something the student
   * has not got. Sorted below the finished tools and rendered with a visible
   * "beta" chip. The code stays; it just stops being presented as finished.
   *
   * `why` is the reason, kept next to the flag so the next person can tell
   * whether it still applies rather than guessing.
   */
  beta?: string
}

/**
 * Order matters: the first DEFAULT_VISIBLE entries are what a student sees
 * before expanding, so everything above the beta block must genuinely work
 * end to end.
 */
const STUDENT_NAV: NavItem[] = [
  // ── working, in rough order of daily usefulness ──────────────────────────
  { label: 'Home',            icon: Sparkles,        to: 'home',             color: '#A5B4FC' },
  { label: "Kyno's Solver",  icon: MessageCircle,   to: 'doubt',            color: '#A5B4FC' },
  { label: 'Adaptive Quiz',   icon: Brain,           to: 'quiz',             color: '#A5B4FC' },
  { label: 'Flashcards',      icon: BookMarked,      to: 'flashcards',       color: '#A5B4FC' },
  { label: 'Camera Study',    icon: Camera,          to: 'camera',           color: '#A5B4FC' },
  { label: 'Mistake Analysis',icon: Activity,        to: 'mistakes',         color: '#A5B4FC' },
  { label: 'AI Notebook',     icon: BookOpen,        to: 'notebook',         color: '#A5B4FC' },
  { label: 'Exam Planner',    icon: Target,          to: 'exam-planner',     color: '#A5B4FC' },

  { label: 'Focus Mode',      icon: Target,          to: 'focus',            color: '#A5B4FC' },
  { label: 'Study Plan',      icon: Calendar,        to: 'study-plan',       color: '#A5B4FC' },
  { label: 'Knowledge Graph', icon: Share2,          to: 'knowledge',        color: '#A5B4FC' },
  { label: 'Formula Sheet',   icon: FunctionSquare,  to: 'formula',          color: '#A5B4FC' },
  { label: 'Grader',          icon: FileText,        to: 'essay',            color: '#A5B4FC' },
  { label: 'Teach Back',      icon: GraduationCap,   to: 'teach-back',       color: '#4FD8E8' },
  { label: 'League',          icon: Trophy,          to: 'league',           color: '#FFB44A' },
  { label: 'Topic Architect', icon: Brain,           to: 'topic-architect',  color: '#A5B4FC' },
  { label: 'Writing Tools',   icon: Edit3,           to: 'writing',          color: '#A5B4FC' },

  // ── beta: real screens, but not finished enough to present as done ───────
  { label: 'Kyno',            icon: Cpu,             to: 'kairo-os',         color: '#A5B4FC',
    beta: 'Duplicates Home — the two are being merged' },
  { label: 'Study Mode · Live', icon: Camera,        to: 'camera-live',      color: '#4FD8E8',
    beta: 'Camera hang fixed; the live session flow still needs a pass' },
  { label: 'Concept Map',     icon: Network,         to: 'concept-map',      color: '#A5B4FC',
    beta: 'Canvas renders nothing — use Knowledge Graph' },
  { label: 'Battle Mode',     icon: Swords,          to: 'battle',           color: '#A5B4FC',
    beta: 'Daily challenge works; the leaderboard needs other players' },
  { label: 'Revision Sim',    icon: Zap,             to: 'simulator',        color: '#A5B4FC',
    beta: 'Exam mode is labelled untimed and has no timer' },
  { label: 'Explain Mistake', icon: AlertTriangle,   to: 'explain-mistake',  color: '#A5B4FC',
    beta: 'Explains at topic level, not per mistake; merging into Mistake Analysis' },
  { label: 'Concept Tools',   icon: Lightbulb,       to: 'concept',          color: '#A5B4FC',
    beta: 'Overlaps Writing Tools — being merged' },
  { label: 'Pomodoro',        icon: Timer,           to: 'pomodoro',         color: '#A5B4FC',
    beta: 'Duplicate of Focus Mode' },
  // Was labelled "My Tasks" but routed to 'school', so tapping it opened
  // School Hub saying "Not in a school yet". Named for where it actually goes.
  { label: 'School Hub',      icon: BookOpen,        to: 'school',           color: '#A5B4FC',
    beta: 'Only joinable from the login screen — unreachable for most students' },
]

const TEACHER_NAV: NavItem[] = [
  { label: 'AI Teacher',      icon: Bot,             to: 'teacher-ai',      color: '#A5B4FC' },
  { label: "Kyno's Solver",    icon: MessageCircle,   to: 'doubt',           color: '#A5B4FC' },
  { label: 'Flashcards',      icon: BookMarked,      to: 'flashcards',      color: '#34d399' },
  { label: 'Grader',          icon: FileText,        to: 'essay',           color: '#f472b6' },
  { label: 'Tasks & Marks',   icon: BookOpen,        to: 'school',          color: '#C7D2E8' },
  { label: 'Question Paper',  icon: BookOpen,        to: 'question-paper',  color: '#A5B4FC' },
  { label: 'Lesson Plan',     icon: Calendar,        to: 'lesson-plan',     color: '#8FA0FA' },
  { label: 'Parent Message',  icon: Bell,            to: 'parent-message',  color: '#7C5CFF' },
  { label: 'Announcements',   icon: Megaphone,       to: 'announcement',    color: '#f472b6' },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'School Hub',      icon: Building2,   to: 'school',          color: '#7C5CFF' },
  { label: 'Announcements',   icon: Megaphone,   to: 'announcement',    color: '#f472b6' },
  { label: 'Fee Reminder',    icon: DollarSign,  to: 'fee-reminder',    color: '#34d399' },
  { label: 'Admission Bot',   icon: Bot,         to: 'admission',       color: '#A5B4FC' },
  { label: 'Attendance',      icon: UserCheck,   to: 'attendance',      color: '#C7D2E8' },
  { label: 'Timetable',       icon: Grid3x3,     to: 'timetable',       color: '#8FA0FA' },
  { label: 'Ops Dashboard',   icon: Activity,    to: 'ops',             color: '#34d399' },
]

function navForRole(role?: string): { items: NavItem[]; label: string; icon: React.ElementType } {
  if (role === 'admin')   return { items: ADMIN_NAV,   label: 'Admin Console', icon: Shield }
  if (role === 'teacher') return { items: TEACHER_NAV, label: 'Teacher Tools', icon: GraduationCap }
  return { items: STUDENT_NAV, label: 'My Tools', icon: GraduationCap }
}

interface Profile {
  name: string
  role: string
  avatar_url?: string
  school_name?: string
  school_logo_url?: string
  plan?: string
  cls?: string
  board?: string
  pic?: string
}

interface SidebarProps {
  active: string
  setActive: (v: string) => void
  isDark: boolean
  toggleTheme: () => void
  profile?: Profile
  onLogout?: () => void
}

const DEFAULT_VISIBLE = 8

export default function Sidebar({ active, setActive, isDark, toggleTheme, profile, onLogout }: SidebarProps) {
  const [recentOpen, setRecentOpen]   = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentChat[]>(() => getRecentChats())
  const [profilePic, setProfilePic] = useState<string | null>(() =>
    profile?.avatar_url || profile?.pic || localStorage.getItem('kairo_profile_pic')
  )
  const [decorTick, setDecorTick] = useState(0)
  useEffect(() => {
    const onDecor = () => setDecorTick(t => t + 1)
    window.addEventListener('kairo:decor', onDecor)
    return () => window.removeEventListener('kairo:decor', onDecor)
  }, [])

  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('kairo:sidebar:expanded') !== '0' }
    catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('kairo:sidebar:expanded', expanded ? '1' : '0') }
    catch {  }
  }, [expanded])

  // Keep the footer XP live + correct (mirrors the top bar).
  const [, forceXp] = useState(0)
  useEffect(() => {
    const onXP = () => forceXp(n => n + 1)
    window.addEventListener('kairo:xp', onXP)
    return () => window.removeEventListener('kairo:xp', onXP)
  }, [])

  const [showAll, setShowAll] = useState<boolean>(() => {
    try { return localStorage.getItem('kairo:sidebar:showAll') === '1' }
    catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('kairo:sidebar:showAll', showAll ? '1' : '0') }
    catch {  }
  }, [showAll])

  useEffect(() => {
    const reload = () => setRecents(getRecentChats())
    window.addEventListener('kairo:recents-updated', reload)
    return () => window.removeEventListener('kairo:recents-updated', reload)
  }, [])

  function openChat(id: string) {
    setActive('doubt')
    window.dispatchEvent(new CustomEvent('kairo:load-chat', { detail: { id } }))
  }
  function newChat() {
    setActive('doubt')
    window.dispatchEvent(new CustomEvent('kairo:load-chat', { detail: { id: 'new' } }))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        newChat()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function removeChat(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    deleteRecentChat(id)
    setRecents(getRecentChats())
  }
  const totalXP = selectXP().total
  const displayName = profile?.name || 'Arjun Sharma'
  const displaySub  = profile?.school_name
    ? `🏫 ${profile.school_name}`
    : profile?.board && profile?.cls
      ? `${profile.board} · Class ${profile.cls}`
      : `Free plan · ${totalXP.toLocaleString()} XP`
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { generating } = useGeneration()

  function handleProfilePicChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setProfilePic(url)
      localStorage.setItem('kairo_profile_pic', url)
    }
    reader.readAsDataURL(file)
  }

  return (
    <motion.aside
      animate={{ width: expanded ? 216 : 72 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{
        flexShrink: 0,
        margin: '10px 0 10px 10px',
        height: 'calc(100% - 20px)',
        background: isDark
          ? 'linear-gradient(180deg, rgba(20, 24, 35, 0.78) 0%, rgba(14, 17, 23, 0.78) 100%)'
          : 'rgba(255, 255, 255, 0.82)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e4e4e7'}`,
        borderRadius: 26,
        boxShadow: isDark
          ? '0 24px 60px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.025) inset'
          : '0 18px 48px rgba(0, 0, 0, 0.08)',


        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'background 0.32s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
      <div style={{ padding: '14px 12px', borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.04)' : '#e4e4e7'}` }}>
        <div style={{
          display: 'flex',
          flexDirection: expanded ? 'row' : 'column',
          alignItems: 'center',
          gap: expanded ? 10 : 8,
          marginBottom: expanded ? 14 : 0,
          justifyContent: expanded ? 'flex-start' : 'center',
          padding: expanded ? '8px 10px' : '10px 6px',
          borderRadius: 16,
          background: 'linear-gradient(150deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',


          border: '1px solid rgba(165, 180, 252, 0.16)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: expanded ? 48 : 42, height: expanded ? 48 : 42,
            flexShrink: 0,
            borderRadius: expanded ? 13 : 11,
            background: 'linear-gradient(150deg, #0B0F1C 0%, #05060A 100%)',
            border: '1px solid rgba(165, 180, 252, 0.30)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 20px rgba(124, 92, 255,0.30), inset 0 1px 0 rgba(255,255,255,0.08)',
            transition: 'width 0.32s cubic-bezier(0.22, 1, 0.36, 1), height 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <img
              src="/kairo-mark.svg"
              alt="Kyno"
              style={{
                width: '74%', height: '74%', objectFit: 'contain',
                filter: 'drop-shadow(0 0 8px rgba(165,180,252,0.45))',
              }}
            />
          </div>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="brand-text"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
              >
                <div style={{
                  fontSize: 17, fontWeight: 700,
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  color: isDark ? '#F5F5F7' : '#18181b',
                  letterSpacing: '0.2px',
                  whiteSpace: 'nowrap',
                  textShadow: isDark ? '0 0 20px rgba(124, 92, 255,0.45)' : 'none',
                }}>Kyno</div>
                <div style={{
                  fontSize: 8, fontWeight: 600,
                  color: 'rgba(165, 180, 252, 0.55)',
                  letterSpacing: 1.2, textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  marginTop: 2,
                }}>Kairo Industries</div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Shrink sidebar' : 'Expand sidebar'}
            aria-label={expanded ? 'Shrink sidebar' : 'Expand sidebar'}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              color: '#6B7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'rgba(255, 255, 255, 0.04)'
              b.style.color = '#A5B4FC'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'transparent'
              b.style.color = '#6B7280'
            }}
          >
            {expanded ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.button
              key="search-shortcut"
              onClick={newChat}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: '100%', padding: '9px 14px',
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 999,
                display: 'flex', alignItems: 'center', gap: 8,
                color: '#6B7280', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.22s cubic-bezier(0.22, 1, 0.36, 1)',


                marginTop: 4,
              }}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.borderColor = 'rgba(165, 180, 252, 0.30)'
                b.style.background  = 'rgba(255, 255, 255, 0.04)'
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.borderColor = 'rgba(255, 255, 255, 0.06)'
                b.style.background  = 'rgba(255, 255, 255, 0.025)'
              }}
            >
              <MessageCircle size={12} />
              <span>Ask anything…</span>
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '2px 7px', borderRadius: 999,
                letterSpacing: 0.3,
              }}>⌘K</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>

        {(() => {
          const { items, label, icon: SectionIcon } = navForRole(profile?.role)
          const visible = showAll ? items : items.slice(0, DEFAULT_VISIBLE)
          const hidden  = showAll ? [] : items.slice(DEFAULT_VISIBLE)
          const hasMore = items.length > DEFAULT_VISIBLE
          return (
            <>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key="section-header"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 8px 6px',
                      color: '#4B5563', fontSize: 10,
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <SectionIcon size={10} />{label}
                  </motion.div>
                )}
              </AnimatePresence>

              {visible.slice(0, DEFAULT_VISIBLE).map(item => (
                <NavItemRow
                  key={item.to}
                  item={item}
                  isActive={active === item.to}
                  isHovered={hoveredItem === item.to}
                  isGenerating={!!(generating[item.to] && active !== item.to)}
                  compact={!expanded}
                  onHover={setHoveredItem}
                  onClick={() => setActive(item.to)}
                />
              ))}

              <AnimatePresence initial={false}>
                {showAll && items.slice(DEFAULT_VISIBLE).map((item, i) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{
                      duration: 0.28,
                      delay: 0.02 * i,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <NavItemRow
                      item={item}
                      isActive={active === item.to}
                      isHovered={hoveredItem === item.to}
                      isGenerating={!!(generating[item.to] && active !== item.to)}
                      compact={!expanded}
                      onHover={setHoveredItem}
                      onClick={() => setActive(item.to)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {hasMore && (
                <button
                  onClick={() => setShowAll(s => !s)}
                  title={showAll ? 'Show fewer tools' : `Show ${hidden.length} more tools`}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center',
                    gap: expanded ? 11 : 0,
                    justifyContent: expanded ? 'flex-start' : 'center',
                    padding: '8px 12px', borderRadius: 14,
                    marginTop: 4, marginBottom: 4,
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    color: '#6B7280', fontSize: 12, fontWeight: 600,
                    transition: 'background 0.22s cubic-bezier(0.22, 1, 0.36, 1), color 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLButtonElement
                    b.style.background = 'rgba(255, 255, 255, 0.035)'
                    b.style.color = '#A5B4FC'
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLButtonElement
                    b.style.background = 'transparent'
                    b.style.color = '#6B7280'
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {showAll ? <ChevronUp size={13} /> : <MoreHorizontal size={13} />}
                  </div>
                  {expanded && (
                    <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {showAll ? 'Show less' : `${hidden.length} more`}
                    </span>
                  )}
                </button>
              )}
            </>
          )
        })()}

        <div style={{ height: 8 }} />

        {expanded && (
        <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1 }}>
            <SectionHeader
              label="Recent" icon={Clock}
              open={recentOpen} toggle={() => setRecentOpen(o => !o)}
            />
          </div>
          <button
            onClick={newChat}
            title="New chat"
            style={{
              width: 22, height: 22, borderRadius: 5, marginRight: 6,
              background: 'rgba(124, 92, 255, 0.1)', border: '1px solid rgba(124, 92, 255, 0.2)',
              color: '#A5B4FC', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, flexShrink: 0,
            }}
          >
            <Plus size={11} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {recentOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {recents.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 11, color: isDark ? '#4B5563' : '#B1B5BA', fontStyle: 'italic' }}>
                  No chats yet — ask anything in Kyno's Solver
                </div>
              )}
              {recents.map(r => (
                <div
                  key={r.id}
                  onClick={() => openChat(r.id)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 1, transition: 'background 0.1s', gap: 6,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = isDark ? '#1C2233' : '#f4f4f5';
                    const x = e.currentTarget.querySelector('[data-del]') as HTMLElement | null
                    if (x) x.style.opacity = '1'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    const x = e.currentTarget.querySelector('[data-del]') as HTMLElement | null
                    if (x) x.style.opacity = '0'
                  }}
                >
                  <span style={{
                    fontSize: 12,
                    color: isDark ? '#9CA3AF' : '#6B7280',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.title}
                  </span>
                  <button
                    data-del
                    onClick={(e) => removeChat(e, r.id)}
                    title="Delete"
                    style={{
                      opacity: 0, transition: 'opacity 0.15s',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#6B7280', padding: 2, display: 'flex',
                    }}
                  >
                    <X size={11} />
                  </button>
                  <span style={{ fontSize: 10, color: isDark ? '#4B5563' : '#B1B5BA', flexShrink: 0 }}>
                    {timeAgo(r.updated)}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}
      </nav>

      <div style={{ padding: '8px', borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.04)' : '#e4e4e7'}` }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button
            title={expanded ? undefined : 'Settings'}
            className="kyno-ghost"
            onClick={() => setActive('settings')}
            style={{
              flex: 1, padding: expanded ? '8px 10px' : '8px 0', fontSize: 12,
              display: 'flex', alignItems: 'center',
              gap: expanded ? 7 : 0,
              justifyContent: expanded ? 'flex-start' : 'center',
            }}
          >
            <Settings size={13} />
            {expanded && <span>Settings</span>}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleProfilePicChange}
        />

        <div className="kyno-stat" style={{
          padding: expanded ? '10px 10px' : '8px 4px',
          display: 'flex', alignItems: 'center',
          gap: expanded ? 9 : 0,
          justifyContent: expanded ? 'flex-start' : 'center',
          marginTop: 4,
        }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            title={expanded ? 'Click to set profile picture' : displayName}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          >
            <DecoratedAvatar key={decorTick} pic={profilePic} name={displayName} size={30} rounded={10} />
          </div>
          {expanded && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#fafafa' : '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 10, color: isDark ? '#4B5563' : '#B1B5BA' }}>{displaySub}</div>
              </div>
              <button
                title="Log out"
                onClick={() => {
                  localStorage.removeItem('kairo_token')
                  localStorage.removeItem('kairo_refresh')
                  localStorage.removeItem('kairo_profile')
                  if (onLogout) onLogout()
                  else window.location.reload()
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', padding: 2 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4B5563' }}
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  )
}

function SectionHeader({ label, icon: Icon, open, toggle }: { label: string; icon: React.ElementType; open: boolean; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px 6px', background: 'none', border: 'none',
        cursor: 'pointer', color: '#4B5563', fontSize: 10,
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
        fontFamily: 'inherit',
      }}
    >
      <Icon size={10} />
      {label}
      <motion.div
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ marginLeft: 'auto' }}
      >
        <ChevronDown size={11} />
      </motion.div>
    </button>
  )
}

function NavItemRow({ item, isActive, isHovered, isGenerating = false, compact = false, onHover, onClick }: {
  item: NavItem
  isActive: boolean
  isHovered: boolean
  isGenerating?: boolean
  compact?: boolean
  onHover: (v: string | null) => void
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(item.to)}
      onMouseLeave={() => onHover(null)}
      title={compact ? item.label : undefined}
      className={`kyno-nav${isActive ? ' on' : ''}`}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center',
        gap: compact ? 0 : 11,
        justifyContent: compact ? 'center' : 'flex-start',
        padding: compact ? '10px 0' : '10px 12px',
        marginBottom: 6, fontFamily: 'inherit',
        position: 'relative',
      }}
    >
      {isActive && (
        <motion.div
          layoutId="active-indicator"
          style={{
            position: 'absolute', left: 0, top: '18%', bottom: '18%',
            width: 2, borderRadius: 2,
            background: '#7C5CFF',
            boxShadow: '0 0 6px rgba(124, 92, 255, 0.12)',
          }}
        />
      )}

      <div style={{
        width: 26, height: 26, borderRadius: 8,
        background: isActive ? 'rgba(124, 92, 255, 0.16)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 0.22s cubic-bezier(0.22, 1, 0.36, 1)', position: 'relative',
      }}>
        <item.icon size={13} color={isActive ? '#A5B4FC' : '#6B7280'} />
        {isGenerating && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.9, 0.4, 0.9] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', top: -2, right: -2,
              width: 6, height: 6, borderRadius: '50%',
              background: '#7C5CFF',
              boxShadow: '0 0 6px #7C5CFF',
            }}
          />
        )}
      </div>

      {!compact && (
        <span style={{
          fontSize: 13, fontWeight: isActive ? 600 : 400,
          color: isActive ? '#fafafa' : '#9CA3AF',
          flex: 1, textAlign: 'left',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.label}
        </span>
      )}

      {/* Unfinished tools say so. The alternative is a student tapping into a
          screen that looks done, finding it isn't, and reasonably concluding
          the whole app is like that. The reason is in the tooltip. */}
      {!compact && item.beta && !isGenerating && (
        <span
          title={item.beta}
          style={{
            fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: '#C8952A',
            background: 'rgba(255, 180, 74, 0.13)',
            border: '1px solid rgba(255, 180, 74, 0.3)',
            borderRadius: 999, padding: '2px 6px',
            flexShrink: 0,
          }}
        >
          beta
        </span>
      )}

      {isGenerating ? (
        <span style={{
          fontSize: 9, fontWeight: 600, color: '#7C5CFF',
          letterSpacing: 0.3, animation: 'pulse 1.2s ease-in-out infinite',
        }}>
          AI…
        </span>
      ) : item.badge ? (
        <span style={{
          fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
          borderRadius: 5, background: '#7C5CFF',
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '0 4px',
        }}>
          {item.badge}
        </span>
      ) : null}
    </button>
  )
}
