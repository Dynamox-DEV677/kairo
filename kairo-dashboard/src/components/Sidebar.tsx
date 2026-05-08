import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, BookMarked, Calendar, FileText, BarChart3,
  BookOpen, Bell, Settings, LogOut, ChevronDown,
  Sun, Moon, Clock, Camera, Plus, X,
  GraduationCap, Shield, Sparkles, DollarSign, Bot, UserCheck, Grid3x3, Building2,
  Edit3, Lightbulb, FunctionSquare, Brain, TrendingUp, Star, Timer, Megaphone,
  Target, Activity, Zap, Compass, Network, Mic, Swords, Share2, AlertTriangle,
  Beaker,
} from 'lucide-react'
import { useGeneration } from '../lib/generationContext'
import { getRecentChats, deleteRecentChat, timeAgo } from '../lib/recentChats'
import type { RecentChat } from '../lib/recentChats'

interface NavItem {
  label: string
  icon: React.ElementType
  badge?: number
  to: string
  color?: string
}

// ── Role-isolated navigation ─────────────────────────────────────────────────
// Each role sees ONLY their own tools — no cross-access.
const STUDENT_NAV: NavItem[] = [
  { label: 'Doubt Solver',    icon: MessageCircle,   to: 'doubt',         color: '#818cf8' },
  { label: 'AI Memory',       icon: Brain,           to: 'memory',        color: '#a78bfa' },
  { label: 'Kairo Labs',      icon: Beaker,          to: 'labs',          color: '#ec4899' },
  { label: 'Mistake Analysis',icon: Activity,        to: 'mistakes',      color: '#f87171' },
  { label: 'Revision Sim',    icon: Zap,             to: 'simulator',     color: '#fb923c' },
  { label: 'Adaptive Path',   icon: Compass,         to: 'adaptive',      color: '#38bdf8' },
  { label: 'Concept Map',     icon: Network,         to: 'concept-map',   color: '#a78bfa' },
  { label: 'AI Notebook',     icon: BookOpen,        to: 'notebook',      color: '#fbbf24' },
  { label: 'Voice Tutor',     icon: Mic,             to: 'voice',         color: '#34d399' },
  { label: 'Battle Mode',     icon: Swords,          to: 'battle',        color: '#fbbf24' },
  { label: 'Explain Mistake', icon: AlertTriangle,   to: 'explain-mistake', color: '#fb923c' },
  { label: 'Predictor',       icon: TrendingUp,      to: 'perf-predictor',  color: '#38bdf8' },
  { label: 'Panic Mode',      icon: Zap,             to: 'panic',           color: '#f87171' },
  { label: 'Knowledge Graph', icon: Share2,          to: 'knowledge',     color: '#818cf8' },
  { label: 'Camera Study',    icon: Camera,          to: 'camera',        color: '#f472b6' },
  { label: 'Focus Mode',      icon: Target,          to: 'focus',         color: '#34d399' },
  { label: 'Flashcards',      icon: BookMarked,      to: 'flashcards',    color: '#34d399' },
  { label: 'Grader',          icon: FileText,        to: 'essay',         color: '#f472b6' },
  { label: 'My Tasks',        icon: BookOpen,        to: 'school',        color: '#fb923c' },
  { label: 'Study Plan',      icon: Calendar,        to: 'study-plan',    color: '#fb923c' },
  { label: 'Adaptive Quiz',   icon: Brain,           to: 'quiz',          color: '#38bdf8' },
  { label: 'Writing Tools',   icon: Edit3,           to: 'writing',       color: '#a78bfa' },
  { label: 'Concept Tools',   icon: Lightbulb,       to: 'concept',       color: '#34d399' },
  { label: 'Formula Sheet',   icon: FunctionSquare,  to: 'formula',       color: '#fbbf24' },
  { label: 'Pomodoro',        icon: Timer,           to: 'pomodoro',      color: '#fb923c' },
  { label: 'Analytics',       icon: TrendingUp,      to: 'analytics',     color: '#818cf8' },
  { label: 'My Progress',     icon: Star,            to: 'gamification',  color: '#f59e0b' },
]

const TEACHER_NAV: NavItem[] = [
  { label: 'AI Teacher',      icon: Bot,             to: 'teacher-ai',      color: '#818cf8' },
  { label: 'Doubt Solver',    icon: MessageCircle,   to: 'doubt',           color: '#818cf8' },
  { label: 'Flashcards',      icon: BookMarked,      to: 'flashcards',      color: '#34d399' },
  { label: 'Grader',          icon: FileText,        to: 'essay',           color: '#f472b6' },
  { label: 'Tasks & Marks',   icon: BookOpen,        to: 'school',          color: '#fbbf24' },
  { label: 'Question Paper',  icon: BookOpen,        to: 'question-paper',  color: '#a78bfa' },
  { label: 'Lesson Plan',     icon: Calendar,        to: 'lesson-plan',     color: '#38bdf8' },
  { label: 'Parent Message',  icon: Bell,            to: 'parent-message',  color: '#fb923c' },
  { label: 'Announcements',   icon: Megaphone,       to: 'announcement',    color: '#f472b6' },
  { label: 'Analytics',       icon: TrendingUp,      to: 'analytics',       color: '#818cf8' },
]

// Admin = command center ONLY. No student learning tools.
const ADMIN_NAV: NavItem[] = [
  { label: 'School Hub',      icon: Building2,   to: 'school',          color: '#6366f1' },
  { label: 'Announcements',   icon: Megaphone,   to: 'announcement',    color: '#f472b6' },
  { label: 'Fee Reminder',    icon: DollarSign,  to: 'fee-reminder',    color: '#34d399' },
  { label: 'Admission Bot',   icon: Bot,         to: 'admission',       color: '#818cf8' },
  { label: 'Attendance',      icon: UserCheck,   to: 'attendance',      color: '#fbbf24' },
  { label: 'Timetable',       icon: Grid3x3,     to: 'timetable',       color: '#38bdf8' },
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
  // legacy local fields (still supported)
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

export default function Sidebar({ active, setActive, isDark, toggleTheme, profile, onLogout }: SidebarProps) {
  const [recentOpen, setRecentOpen]   = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentChat[]>(() => getRecentChats())
  const [profilePic, setProfilePic] = useState<string | null>(() =>
    profile?.avatar_url || profile?.pic || localStorage.getItem('kairo_profile_pic')
  )

  // Listen for recent-chats updates from ChatWindow
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
  function removeChat(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    deleteRecentChat(id)
    setRecents(getRecentChats())
  }
  const displayName = profile?.name || 'Arjun Sharma'
  const displaySub  = profile?.school_name
    ? `🏫 ${profile.school_name}`
    : profile?.board && profile?.cls
      ? `${profile.board} · Class ${profile.cls}`
      : 'Free plan · 450 XP'
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
    <aside style={{
      width: 240,
      flexShrink: 0,
      height: '100%',
      background: isDark ? '#0d0d0d' : '#fafafa',
      borderRight: `1px solid ${isDark ? '#1a1a1a' : '#e4e4e7'}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>
      {/* Logo area */}
      <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${isDark ? '#1a1a1a' : '#e4e4e7'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <img src="/kairo_logo.png" alt="Kairo" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 12 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fafafa' : '#18181b', letterSpacing: '-0.3px' }}>kairo</div>
            <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>Accelerate Your Academics</div>
          </div>
        </div>

        {/* Search shortcut */}
        <button style={{
          width: '100%', padding: '8px 12px', background: '#161616',
          border: '1px solid #1e1e1e', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 8,
          color: '#52525b', fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3f3f46' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e1e' }}
        >
          <MessageCircle size={12} />
          <span>Ask anything...</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, background: '#1c1c1c', padding: '1px 6px', borderRadius: 4 }}>⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>

        {/* Role-filtered nav — admins see only admin tools, etc. */}
        {(() => {
          const { items, label, icon: SectionIcon } = navForRole(profile?.role)
          return (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px 6px',
                color: '#3f3f46', fontSize: 10,
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              }}>
                <SectionIcon size={10} />{label}
              </div>
              {items.map(item => (
                <NavItemRow
                  key={item.to}
                  item={item}
                  isActive={active === item.to}
                  isHovered={hoveredItem === item.to}
                  isGenerating={!!(generating[item.to] && active !== item.to)}
                  onHover={setHoveredItem}
                  onClick={() => setActive(item.to)}
                />
              ))}
            </>
          )
        })()}

        <div style={{ height: 8 }} />

        {/* Recent Activity */}
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
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              color: '#818cf8', cursor: 'pointer',
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
                <div style={{ padding: '8px 10px', fontSize: 11, color: isDark ? '#3f3f46' : '#a1a1aa', fontStyle: 'italic' }}>
                  No chats yet — ask anything in Doubt Solver
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
                    (e.currentTarget as HTMLDivElement).style.background = isDark ? '#161616' : '#f4f4f5';
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
                    color: isDark ? '#71717a' : '#52525b',
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
                      color: '#52525b', padding: 2, display: 'flex',
                    }}
                  >
                    <X size={11} />
                  </button>
                  <span style={{ fontSize: 10, color: isDark ? '#3f3f46' : '#a1a1aa', flexShrink: 0 }}>
                    {timeAgo(r.updated)}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Bottom section */}
      <div style={{ padding: '8px', borderTop: `1px solid ${isDark ? '#1a1a1a' : '#e4e4e7'}` }}>
        {/* Settings + theme row */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button style={{
            flex: 1, padding: '8px 10px', background: 'none',
            border: '1px solid transparent', borderRadius: 7,
            color: '#52525b', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 0.12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#161616'; (e.currentTarget as HTMLButtonElement).style.color = '#fafafa' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#52525b' }}
            onClick={() => setActive('settings')}
          >
            <Settings size={13} /> Settings
          </button>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Light mode' : 'Dark mode'}
            style={{
              width: 34, height: 34, borderRadius: 7, background: '#161616',
              border: '1px solid #1e1e1e', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#52525b', transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fafafa'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#3f3f46' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e1e' }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>

        {/* Upgrade CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="gradient-border btn-glow"
          style={{
            width: '100%', padding: '9px 14px',
            borderRadius: 8, background: 'rgba(99,102,241,0.08)',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: '#818cf8', fontWeight: 600,
          }}
        >
          <Sparkles size={13} />
          Upgrade to Pro
          <span style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: 4 }}>✦</span>
        </motion.button>

        {/* Hidden file input for profile pic */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleProfilePicChange}
        />

        {/* User card */}
        <div style={{ padding: '10px 10px 4px', display: 'flex', alignItems: 'center', gap: 9, marginTop: 4 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            title="Click to set profile picture"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: profilePic ? 'transparent' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff',
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              border: '2px solid transparent',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent' }}
          >
            {profilePic ? (
              <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : displayName.charAt(0).toUpperCase()}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0' }}
            >
              <Camera size={11} color="#fff" />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#fafafa' : '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 10, color: isDark ? '#3f3f46' : '#a1a1aa' }}>{displaySub}</div>
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: 2 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#3f3f46' }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function SectionHeader({ label, icon: Icon, open, toggle }: { label: string; icon: React.ElementType; open: boolean; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px 6px', background: 'none', border: 'none',
        cursor: 'pointer', color: '#3f3f46', fontSize: 10,
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

function NavItemRow({ item, isActive, isHovered, isGenerating = false, onHover, onClick }: {
  item: NavItem
  isActive: boolean
  isHovered: boolean
  isGenerating?: boolean
  onHover: (v: string | null) => void
  onClick: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => onHover(item.to)}
      onMouseLeave={() => onHover(null)}
      whileTap={{ scale: 0.98 }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
        marginBottom: 2, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
        background: isActive
          ? `rgba(${item.color === '#818cf8' ? '99,102,241' : item.color === '#34d399' ? '52,211,153' : item.color === '#fb923c' ? '251,146,60' : item.color === '#f472b6' ? '244,114,182' : '251,191,36'},0.1)`
          : isHovered ? '#161616' : 'transparent',
        position: 'relative',
        transition: 'background 0.12s',
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="active-indicator"
          style={{
            position: 'absolute', left: 0, top: '15%', bottom: '15%',
            width: 2.5, borderRadius: 2,
            background: item.color || '#6366f1',
            boxShadow: `0 0 8px ${item.color || '#6366f1'}`,
          }}
        />
      )}

      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: isActive ? `${item.color}22` : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 0.12s', position: 'relative',
      }}>
        <item.icon size={13} color={isActive ? item.color : '#52525b'} />
        {/* Background generation pulse indicator */}
        {isGenerating && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.9, 0.4, 0.9] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', top: -2, right: -2,
              width: 6, height: 6, borderRadius: '50%',
              background: '#6366f1',
              boxShadow: '0 0 6px #6366f1',
            }}
          />
        )}
      </div>

      <span style={{
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        color: isActive ? '#fafafa' : '#71717a',
        flex: 1, textAlign: 'left',
      }}>
        {item.label}
      </span>

      {isGenerating ? (
        <span style={{
          fontSize: 9, fontWeight: 600, color: '#6366f1',
          letterSpacing: 0.3, animation: 'pulse 1.2s ease-in-out infinite',
        }}>
          AI…
        </span>
      ) : item.badge ? (
        <span style={{
          fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
          borderRadius: 5, background: '#6366f1',
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '0 4px',
        }}>
          {item.badge}
        </span>
      ) : null}
    </motion.button>
  )
}
