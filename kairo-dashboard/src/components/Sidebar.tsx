import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, BookMarked, Calendar, FileText, BarChart3,
  BookOpen, Bell, Settings, LogOut, ChevronDown,
  Sun, Moon, Clock, Camera,
  GraduationCap, Shield, Sparkles, DollarSign, Bot, UserCheck, Grid3x3, Building2,
  Edit3, Lightbulb, FunctionSquare, Brain, TrendingUp, Star, Timer, Megaphone,
} from 'lucide-react'
import { useGeneration } from '../lib/generationContext'

interface NavItem {
  label: string
  icon: React.ElementType
  badge?: number
  to: string
  color?: string
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Doubt Solver',    icon: MessageCircle,   to: 'doubt',         color: '#818cf8' },
  { label: 'Flashcards',      icon: BookMarked,      to: 'flashcards',    color: '#34d399' },
  { label: 'Study Plan',      icon: Calendar,        to: 'study-plan',    color: '#fb923c' },
  { label: 'Essay Grader',    icon: FileText,        to: 'essay',         color: '#f472b6' },
  { label: 'Exam Predictor',  icon: BarChart3,       to: 'predictor',     color: '#fbbf24' },
  { label: 'Adaptive Quiz',   icon: Brain,           to: 'quiz',          color: '#38bdf8' },
  { label: 'Writing Tools',   icon: Edit3,           to: 'writing',       color: '#a78bfa' },
  { label: 'Concept Tools',   icon: Lightbulb,       to: 'concept',       color: '#34d399' },
  { label: 'Formula Sheet',   icon: FunctionSquare,  to: 'formula',       color: '#fbbf24' },
  { label: 'Pomodoro',        icon: Timer,           to: 'pomodoro',      color: '#fb923c' },
  { label: 'Analytics',       icon: TrendingUp,      to: 'analytics',     color: '#818cf8' },
  { label: 'My Progress',     icon: Star,            to: 'gamification',  color: '#f59e0b' },
]

const TEACHER_NAV: NavItem[] = [
  { label: 'Question Paper',  icon: BookOpen,    to: 'question-paper',  color: '#a78bfa' },
  { label: 'Lesson Plan',     icon: Calendar,    to: 'lesson-plan',     color: '#38bdf8' },
  { label: 'Parent Message',  icon: Bell,        to: 'parent-message',  color: '#fb923c' },
  { label: 'Announcements',   icon: Megaphone,   to: 'announcement',    color: '#f472b6' },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Fee Reminder',    icon: DollarSign,  to: 'fee-reminder',    color: '#34d399' },
  { label: 'Admission Bot',   icon: Bot,         to: 'admission',       color: '#818cf8' },
  { label: 'Attendance',      icon: UserCheck,   to: 'attendance',      color: '#fbbf24' },
  { label: 'Timetable',       icon: Grid3x3,     to: 'timetable',       color: '#38bdf8' },
]

const RECENT = [
  { label: 'Newton\'s 3rd Law', time: '2h ago' },
  { label: 'Mitosis vs Meiosis', time: '5h ago' },
  { label: 'French Revolution', time: 'Yesterday' },
]

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
  const [studentOpen, setStudentOpen] = useState(true)
  const [teacherOpen, setTeacherOpen] = useState(false)
  const [adminOpen, setAdminOpen]     = useState(false)
  const [recentOpen, setRecentOpen]   = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [profilePic, setProfilePic] = useState<string | null>(() =>
    profile?.avatar_url || profile?.pic || localStorage.getItem('kairo_profile_pic')
  )
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
      background: '#0d0d0d',
      borderRight: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo area */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <img src="/kairo_logo.png" alt="Kairo" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 12 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.3px' }}>kairo</div>
            <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>Improve Academics</div>
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

        {/* Student section */}
        <SectionHeader
          label="Student" icon={GraduationCap}
          open={studentOpen} toggle={() => setStudentOpen(o => !o)}
        />
        <AnimatePresence initial={false}>
          {studentOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {STUDENT_NAV.map(item => (
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
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ height: 8 }} />

        {/* Teacher section */}
        <SectionHeader
          label="Teacher" icon={Shield}
          open={teacherOpen} toggle={() => setTeacherOpen(o => !o)}
        />
        <AnimatePresence initial={false}>
          {teacherOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {TEACHER_NAV.map(item => (
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
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ height: 8 }} />

        {/* Admin section */}
        <SectionHeader
          label="Admin" icon={Building2}
          open={adminOpen} toggle={() => setAdminOpen(o => !o)}
        />
        <AnimatePresence initial={false}>
          {adminOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {ADMIN_NAV.map(item => (
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
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ height: 8 }} />

        {/* Recent Activity */}
        <SectionHeader
          label="Recent" icon={Clock}
          open={recentOpen} toggle={() => setRecentOpen(o => !o)}
        />
        <AnimatePresence initial={false}>
          {recentOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {RECENT.map((r, i) => (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 1, transition: 'background 0.1s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#161616' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 12, color: '#71717a', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}
                  </span>
                  <span style={{ fontSize: 10, color: '#3f3f46' }}>{r.time}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Bottom section */}
      <div style={{ padding: '8px', borderTop: '1px solid #1a1a1a' }}>
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
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 10, color: '#3f3f46' }}>{displaySub}</div>
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
