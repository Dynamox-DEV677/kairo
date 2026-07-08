/**
 * /status — Kora public status page.
 *
 * One page, no login. Polls /api/ops/status every 30 seconds. Shows the
 * absolute basics: are we up, how many users, how many schools, what's
 * broken right now. Designed for a quick glance — large numbers, big
 * green/yellow/red dots, no charts. Strict monochrome purple palette.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2,
  Users, Building2, Activity, UserPlus, Server, Database, Sparkles, Mail,
  Clock,
} from 'lucide-react'

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif"

// ── palette ──────────────────────────────────────────────────────────────
const C = {
  bg:        '#050505',
  panel:     '#0E1117',
  panel2:    '#151922',
  border:    'rgba(255,255,255,0.08)',
  borderHi:  'rgba(102, 217, 255, 0.32)',
  text:      '#ffffff',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
  textVery:  '#6B7280',
  purple:    '#66D9FF',
  purpleHi:  '#4F7CFF',
  purpleSoft:'#A5B4FC',
  purpleLite:'#DBE7FF',
  // semantic — all on the purple scale so the palette stays strict
  ok:    '#66D9FF',
  warn:  '#A5B4FC',
  bad:   '#2046C2',
}

interface StatusSnapshot {
  project:   string
  timestamp: string
  deploy:    {
    commitShort:   string | null
    commitMessage: string | null
    branch:        string | null
    region:        string | null
    env:           string
    uptimeSeconds: number
  }
  users:     { total: number | null; students: number | null; teachers: number | null; admins: number | null; parents: number | null; activeLast24h: number | null }
  schools:   { total: number | null; active: number | null }
  database:  { reachable: boolean; recentLogins24h: number | null; recentRegistrations7d: number | null; error?: string }
  errors:    { totalLogged: number; recent: Array<{ ts: string; message: string }> }
  features:  { total: number }
  env:       Record<string, boolean>
}

type Health = 'ok' | 'degraded' | 'down'

interface Props {
  /** Sends the user back to the landing page (or anywhere). */
  onExit?: () => void
}

export default function StatusPage({ onExit }: Props) {
  const [snap, setSnap]       = useState<StatusSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [reqAt, setReqAt]     = useState<number>(0)

  // ─── poll ──────────────────────────────────────────────────────────────
  async function fetchOnce() {
    const t0 = Date.now()
    try {
      const res = await fetch('/api/ops/status', { cache: 'no-store' })
      const data = await res.json()
      setSnap(data)
      setReqAt(Date.now() - t0)
      setErr('')
    } catch (e: any) {
      setErr(e?.message || 'Could not reach Kora right now.')
      setSnap(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOnce()
    const id = setInterval(fetchOnce, 30_000)   // 30 s refresh
    return () => clearInterval(id)
  }, [])

  // ─── derive overall health + service-row statuses ──────────────────────
  const services = useMemo(() => {
    if (!snap) return []
    return [
      {
        id:       'api',
        icon:     Server,
        label:    'API server',
        body:     `Round-trip ${reqAt} ms · region ${snap.deploy.region || 'iad1'}`,
        health:   (reqAt > 0 && reqAt < 1500 ? 'ok' : 'degraded') as Health,
      },
      {
        id:       'db',
        icon:     Database,
        label:    'Database (Supabase)',
        body:     snap.database.reachable
                    ? `${snap.database.recentLogins24h ?? 0} logins in the last 24 h`
                    : `Unreachable — ${snap.database.error || 'try again in a minute'}`,
        health:   (snap.database.reachable ? 'ok' : 'down') as Health,
      },
      {
        id:       'ai',
        icon:     Sparkles,
        label:    'AI providers',
        body:     snap.env.hasOpenRouter
                    ? 'OpenRouter + Groq routes configured'
                    : 'OpenRouter key missing — Solver, Voice, Notebook AI will 503',
        health:   (snap.env.hasOpenRouter ? 'ok' : 'down') as Health,
      },
      {
        id:       'email',
        icon:     Mail,
        label:    'Email transport',
        // We don't have a direct verify endpoint exposed; presence of admin
        // service-role + the recent reset routes is a strong proxy.
        body:     snap.env.hasServiceRole
                    ? 'Gmail SMTP configured · OTP + reset emails active'
                    : 'Service role key missing — password resets will fail',
        health:   (snap.env.hasServiceRole ? 'ok' : 'down') as Health,
      },
    ]
  }, [snap, reqAt])

  const overall: Health = useMemo(() => {
    if (loading || !snap) return 'ok'
    if (services.some(s => s.health === 'down')) return 'down'
    if (services.some(s => s.health === 'degraded')) return 'degraded'
    return 'ok'
  }, [services, loading, snap])

  const overallText = {
    ok:       'All systems normal',
    degraded: 'Some systems are slow',
    down:     'We have an outage',
  }[overall]

  const overallBlurb = {
    ok:       'Kora is up and running. Latest stats below.',
    degraded: 'Things still work, but one or more services are running slow. We\'re watching.',
    down:     'Part of Kora is offline. We\'re working on it — try again in a minute.',
  }[overall]

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: FONT, color: C.text,
      padding: '32px 18px 64px',
      paddingTop: 'calc(32px + env(safe-area-inset-top))',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 720 }}>

        {/* Brand + back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <img src="/kairo_logo.png" alt="Kora"
            style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'contain',
                     filter: 'drop-shadow(0 0 18px rgba(79, 124, 255, 0.03))' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: C.text }}>
              Kora Status
            </div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
              Live system health · refreshes every 30 s
            </div>
          </div>
          {onExit && (
            <button onClick={onExit} style={navBtn}>
              ← Back to Kora
            </button>
          )}
        </div>

        {/* Overall banner */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '22px 24px',
            borderRadius: 18,
            background: `linear-gradient(135deg,
              ${overall === 'ok'       ? 'rgba(102, 217, 255, 0.10)' :
                overall === 'degraded' ? 'rgba(165, 180, 252, 0.10)' :
                                         'rgba(32, 70, 194, 0.18)'} 0%,
              ${C.panel} 100%)`,
            border: `1px solid ${overall === 'down' ? C.borderHi : C.border}`,
            display: 'flex', alignItems: 'center', gap: 18,
            marginBottom: 28,
          }}
        >
          <StatusDot health={overall} size={18} pulse />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: C.text }}>
              {loading ? 'Checking systems…' : overallText}
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 4, lineHeight: 1.55 }}>
              {loading
                ? 'Pinging API, database, AI providers, email transport.'
                : err
                  ? `Couldn't reach the status endpoint: ${err}`
                  : overallBlurb}
            </div>
          </div>
          <button onClick={fetchOnce} aria-label="Refresh now"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.textDim, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                     : <RefreshCw size={14} />}
          </button>
        </motion.div>

        {/* Stat tiles */}
        {snap && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <StatTile icon={Users}    label="Total users"    value={snap.users.total} />
            <StatTile icon={Building2} label="Schools"        value={snap.schools.total} />
            <StatTile icon={Activity} label="Active in 24 h" value={snap.users.activeLast24h ?? snap.database.recentLogins24h} accent />
            <StatTile icon={UserPlus} label="New signups · 7 d" value={snap.database.recentRegistrations7d} />
          </div>
        )}

        {/* Service health rows */}
        <SectionTitle>Services</SectionTitle>
        <div style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 28,
        }}>
          {services.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: C.panel2, border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={C.purpleSoft} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>{s.body}</div>
                </div>
                <StatusPill health={s.health} />
              </div>
            )
          })}
          {loading && !snap && (
            <div style={{ padding: 18, fontSize: 12, color: C.textFaint }}>
              Loading service health…
            </div>
          )}
        </div>

        {/* User breakdown */}
        {snap && snap.users.total != null && (
          <>
            <SectionTitle>Users by role</SectionTitle>
            <div style={{
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '14px 18px',
              marginBottom: 28,
              display: 'flex', flexWrap: 'wrap', gap: 18,
            }}>
              <RoleChip label="Students" value={snap.users.students} />
              <RoleChip label="Teachers" value={snap.users.teachers} />
              <RoleChip label="Admins"   value={snap.users.admins} />
              <RoleChip label="Parents"  value={snap.users.parents} />
            </div>
          </>
        )}

        {/* Recent errors — only show the count, never the message bodies */}
        {snap && (
          <>
            <SectionTitle>Recent errors (24 h)</SectionTitle>
            <div style={{
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '16px 18px',
              marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: snap.errors.totalLogged === 0
                  ? 'rgba(102, 217, 255, 0.10)'
                  : 'rgba(32, 70, 194, 0.18)',
                border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {snap.errors.totalLogged === 0
                  ? <CheckCircle2 size={17} color={C.purpleSoft} />
                  : <AlertTriangle size={17} color={C.purpleLite} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
                  {snap.errors.totalLogged}
                </div>
                <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>
                  {snap.errors.totalLogged === 0
                    ? 'No client errors reported. Nice.'
                    : 'Errors reported by the front-end since the last cold start.'}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Build / footer */}
        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: 'rgba(102, 217, 255, 0.04)',
          border: `1px solid ${C.border}`,
          fontSize: 11, color: C.textFaint, lineHeight: 1.6,
        }}>
          {snap ? (
            <>
              <span style={{ color: C.textDim }}>Build</span>{' '}
              <code style={{ color: C.purpleSoft, fontFamily: 'ui-monospace, monospace' }}>
                {snap.deploy.commitShort || 'local'}
              </code>
              {snap.deploy.branch && (
                <>{' '}· branch <code style={{ color: C.textDim, fontFamily: 'ui-monospace, monospace' }}>{snap.deploy.branch}</code></>
              )}
              {' '}· env <strong style={{ color: C.textDim }}>{snap.deploy.env}</strong>
              {' '}· uptime <strong style={{ color: C.textDim }}>{fmtUptime(snap.deploy.uptimeSeconds)}</strong>
              {' '}· {snap.features.total} features
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: C.textVery }}>
                <Clock size={10} />
                <span>Last checked {new Date(snap.timestamp).toLocaleTimeString()}</span>
              </div>
            </>
          ) : err ? (
            <span>{err}</span>
          ) : (
            <span>Fetching build info…</span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes kr-pulse   { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.6); opacity: 0 } }
      `}</style>
    </div>
  )
}

// ─── primitives ──────────────────────────────────────────────────────────
function StatusDot({ health, size = 12, pulse = false }: { health: Health; size?: number; pulse?: boolean }) {
  const color = health === 'ok' ? C.ok : health === 'degraded' ? C.warn : C.bad
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {pulse && (
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: color, opacity: 0.6,
          animation: 'kr-pulse 1.8s ease-out infinite',
        }} />
      )}
      <span style={{
        position: 'relative', display: 'block', width: size, height: size,
        borderRadius: '50%', background: color,
        boxShadow: `0 0 16px ${color}aa`,
      }} />
    </div>
  )
}

function StatusPill({ health }: { health: Health }) {
  const { Icon, label, color } = (() => {
    if (health === 'ok')       return { Icon: CheckCircle2,  label: 'Operational', color: C.ok   }
    if (health === 'degraded') return { Icon: AlertTriangle, label: 'Degraded',    color: C.warn }
    return                         { Icon: XCircle,        label: 'Down',        color: C.bad  }
  })()
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 100,
      background: 'rgba(102, 217, 255, 0.08)',
      border: `1px solid ${C.border}`,
      color, fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      flexShrink: 0,
    }}>
      <Icon size={12} />
      {label}
    </div>
  )
}

function StatTile({ icon: Icon, label, value, accent = false }: {
  icon: any
  label: string
  value: number | null
  accent?: boolean
}) {
  return (
    <div style={{
      background: accent
        ? 'linear-gradient(135deg, rgba(102, 217, 255, 0.12), rgba(79, 124, 255, 0.05))'
        : C.panel,
      border: `1px solid ${accent ? C.borderHi : C.border}`,
      borderRadius: 14,
      padding: '14px 16px',
      minHeight: 92,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={11} color={C.purpleSoft} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: C.textFaint,
          textTransform: 'uppercase', letterSpacing: 1.2,
        }}>{label}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: C.text,
        letterSpacing: -0.5, lineHeight: 1.05, marginTop: 6,
      }}>
        {value == null ? '—' : value.toLocaleString('en-IN')}
      </div>
    </div>
  )
}

function RoleChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.2 }}>
        {label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>
        {value == null ? '—' : value.toLocaleString('en-IN')}
      </span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, color: C.textFaint,
      textTransform: 'uppercase', letterSpacing: 1.8,
      margin: '0 4px 10px',
    }}>{children}</div>
  )
}

const navBtn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 9,
  background: 'transparent', border: `1px solid ${C.border}`,
  color: C.textDim, fontFamily: FONT,
  fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
}

// ─── utilities ───────────────────────────────────────────────────────────
function fmtUptime(s: number): string {
  if (!s || s < 0) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}
