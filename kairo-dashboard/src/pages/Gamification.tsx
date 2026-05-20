import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star, Trophy, Shield, Zap } from 'lucide-react'
import { get, post } from '../lib/api'

const SCHOOL_ID = 'demo_school'
const USER_ID   = 'default'

const card = { background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14, padding: 20 } as React.CSSProperties

export default function Gamification() {
  const [profile, setProfile]   = useState<any>(null)
  const [badges, setBadges]     = useState<any[]>([])
  const [leaderboard, setLboard]= useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('profile')

  useEffect(() => {
    Promise.all([
      get(`/gamification/profile?school_id=${SCHOOL_ID}&user_id=${USER_ID}`),
      get(`/gamification/badges?school_id=${SCHOOL_ID}&user_id=${USER_ID}`),
      get(`/gamification/leaderboard?school_id=${SCHOOL_ID}`),
    ]).then(([p, b, l]) => {
      setProfile(p); setBadges(b); setLboard(l)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function addXP(action: string) {
    const r = await post('/gamification/xp', { school_id: SCHOOL_ID, user_id: USER_ID, action })
    setProfile((p: any) => p ? { ...p, xp: r.total_xp, level: r.level } : p)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #1f2532', borderTopColor: '#4F7CFF', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const TABS = [
    { id: 'profile',     label: 'My Profile',   icon: Star  },
    { id: 'badges',      label: 'Badges',        icon: Shield },
    { id: 'leaderboard', label: 'Leaderboard',   icon: Trophy },
  ]

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Gamification</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>XP · Levels · Badges · Leaderboard</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0E1117', border: '1px solid #1f2532', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 8px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1f2532' : 'transparent',
            color: tab === t.id ? '#66D9FF' : '#6B7280', transition: 'all 0.15s',
          }}><t.icon size={12} /> {t.label}</button>
        ))}
      </div>

      {tab === 'profile' && profile && <ProfileTab profile={profile} onAddXP={addXP} />}
      {tab === 'badges'  && <BadgesTab badges={badges} />}
      {tab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} />}
    </div>
  )
}

function ProfileTab({ profile, onAddXP }: any) {
  const level   = profile.level
  return (
    <div>
      {/* Level Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ ...card, background: 'linear-gradient(135deg,#1f2532,#0E1117)', borderColor: '#4F7CFF30', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 70, height: 70, borderRadius: 16, background: `linear-gradient(135deg,#4F7CFF,#4F7CFF)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{level?.level}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fafafa' }}>{level?.title}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>{profile.xp} XP total</div>
            <div style={{ height: 6, background: '#1f2532', borderRadius: 3 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#4F7CFF,#4F7CFF)', borderRadius: 3, width: `${level?.progress_to_next || 100}%`, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>
              {level?.next_level ? `${level.progress_to_next}% to Level ${level.next_level.level} (${level.next_level.title})` : 'Max Level! 🎉'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          ['Quizzes', profile.quizzes_completed || 0, '#38bdf8'],
          ['Essays', profile.essays_graded || 0, '#A5B4FC'],
          ['Flashcards', profile.flashcards_created || 0, '#A5B4FC'],
          ['Doubts Asked', profile.doubts_asked || 0, '#A5B4FC'],
          ['Study Plans', profile.study_plans || 0, '#A5B4FC'],
          ['Streak 🔥', `${profile.streak || 0} days`, '#66D9FF'],
        ].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, textAlign: 'center', padding: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c as string }}>{v}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Quick XP actions */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Earn XP Now</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['Login Bonus', 'login', '+2 XP', '#4F7CFF'],
            ['Review Flashcard', 'flashcard_review', '+5 XP', '#A5B4FC'],
            ['Ask Doubt', 'doubt_asked', '+5 XP', '#38bdf8'],
            ['Formula Sheet', 'formula_sheet', '+10 XP', '#A5B4FC'],
          ].map(([label, action, xp, color]) => (
            <button key={action as string} onClick={() => onAddXP(action)} style={{
              padding: '8px 14px', borderRadius: 8, border: `1px solid ${color}30`,
              background: `${color}10`, color: color as string,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Zap size={11} /> {label} <span style={{ opacity: 0.6 }}>{xp}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BadgesTab({ badges }: any) {
  const earned   = badges.filter((b: any) => b.earned)
  const unearned = badges.filter((b: any) => !b.earned)

  return (
    <div>
      <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>{earned.length}/{badges.length} badges earned</div>
      {earned.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Earned ✓</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 20 }}>
            {earned.map((b: any) => <BadgeCard key={b.id} badge={b} earned />)}
          </div>
        </>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Locked</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
        {unearned.map((b: any) => <BadgeCard key={b.id} badge={b} earned={false} />)}
      </div>
    </div>
  )
}

function BadgeCard({ badge, earned }: any) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: 16, opacity: earned ? 1 : 0.4, position: 'relative', overflow: 'hidden' }}>
      {earned && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4F7CFF,#A5B4FC)' }} />}
      <div style={{ fontSize: 28, marginBottom: 8 }}>{badge.icon}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>{badge.name}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{badge.desc}</div>
    </div>
  )
}

function LeaderboardTab({ leaderboard }: any) {
  if (leaderboard.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#4B5563', fontSize: 13 }}>
      No leaderboard data yet. Complete quizzes and essays to appear here!
    </div>
  )

  return (
    <div>
      {leaderboard.map((entry: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
        return (
          <div key={entry.user_id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', marginBottom: 8 }}>
            <div style={{ fontSize: i < 3 ? 22 : 14, fontWeight: 700, color: '#6B7280', width: 32, textAlign: 'center' }}>{medal}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{entry.user_id === 'default' ? 'You' : entry.user_id}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Level {entry.level?.level} · {entry.level?.title}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#66D9FF' }}>{entry.xp} XP</div>
          </div>
        )
      })}
    </div>
  )
}
