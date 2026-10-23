import { useEffect, useState } from 'react'
import { studentMessage } from '../lib/aiError.core'
import { motion } from 'framer-motion'
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2,
  Activity, Server, Sparkles, Gauge, Clock,
} from 'lucide-react'
import { readHealth, type Health, type ServiceRow } from '../lib/statusHealth.core.js'

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif"

const C = {
  bg:        '#0A0D16',
  panel:     '#141A2A',
  panel2:    '#1C2233',
  border:    'rgba(255,255,255,0.08)',
  borderHi:  'rgba(165, 180, 252, 0.32)',
  text:      '#ffffff',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
  textVery:  '#6B7280',
  purple:    '#A5B4FC',
  purpleHi:  '#7C5CFF',
  purpleSoft:'#A5B4FC',
  purpleLite:'#DBE7FF',
  ok:    '#A5B4FC',
  warn:  '#A5B4FC',
  bad:   '#4A2FA8',
}

/**
 * /status - the public health page.
 *
 * It used to read /api/ops/status (user counts, schools, the error log, build
 * info). That endpoint was locked to operators because it leaked exactly that,
 * the page was repointed at the public /api/ops/health probe, and its code was
 * never changed: `snap.deploy.region` on a payload with no `deploy` crashed it
 * to a blank screen in production. It now shows what the public probe can
 * honestly say - is the server answering, and is the AI tutor working - and
 * nothing about any user. statusHealth.core.js does the reading.
 */

interface Props {
  onExit?: () => void
}

const ICONS: Record<string, any> = { api: Server, ai: Sparkles }

export default function StatusPage({ onExit }: Props) {
  const [view, setView]       = useState<ReturnType<typeof readHealth> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')

  async function fetchOnce() {
    const t0 = performance.now()
    try {
      const res = await fetch('/api/ops/health', { cache: 'no-store' })
      if (!res.ok) throw Object.assign(new Error(`health ${res.status}`), { status: res.status })
      const data = await res.json()
      setView(readHealth(data, performance.now() - t0))
      setErr('')
    } catch (e: any) {
      setErr(studentMessage(e))
      setView(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOnce()
    const id = setInterval(fetchOnce, 30_000)
    return () => clearInterval(id)
  }, [])

  const services: ServiceRow[] = view?.services ?? []
  const overall: Health = err ? 'down' : view?.overall ?? 'ok'

  const overallText = {
    ok:       'All systems normal',
    degraded: 'Some systems are slow',
    down:     'We have an outage',
  }[overall]

  const overallBlurb = {
    ok:       'Kyno is up and running.',
    degraded: 'Things still work, but something is running slow. We\'re watching.',
    down:     'Part of Kyno is offline. We\'re working on it — try again in a minute.',
  }[overall]

  const pct = view?.stats.failRate == null ? null : Math.round(view.stats.failRate * 100)

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <img src="/kairo_logo.png" alt="Kyno"
            style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'contain' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: C.text }}>
              Kyno Status
            </div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
              Live system health · refreshes every 30 s
            </div>
          </div>
          {onExit && (
            <button className="kyno-ghost" onClick={onExit} style={navBtn}>
              ← Back to Kyno
            </button>
          )}
        </div>

        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '22px 24px',
            borderRadius: 18,
            background: `linear-gradient(135deg, ${overall === 'down' ? 'rgba(74, 47, 168, 0.18)' : 'rgba(165, 180, 252, 0.10)'} 0%, ${C.panel} 100%)`,
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
              {loading ? 'Asking the Kyno server and the AI tutor.' : err ? `Couldn't reach Kyno: ${err}` : overallBlurb}
            </div>
          </div>
          <button className="kyno-ghost" onClick={fetchOnce} aria-label="Refresh now"
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

        <SectionTitle>Services</SectionTitle>
        <div style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 28,
        }}>
          {services.map((s, i) => {
            const Icon = ICONS[s.id] || Server
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
          {!services.length && (
            <div style={{ padding: 18, fontSize: 12, color: C.textFaint }}>
              {loading ? 'Loading service health…' : 'No health data right now.'}
            </div>
          )}
        </div>

        {view && (
          <>
            <SectionTitle>AI tutor · last hour</SectionTitle>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12, marginBottom: 28,
            }}>
              <StatTile icon={Activity} label="Requests" value={view.stats.calls} accent />
              <StatTile icon={AlertTriangle} label="Failed %" value={pct} />
              <StatTile icon={Gauge} label="Slowest 5% · ms" value={view.stats.p95ms} />
            </div>
          </>
        )}

        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: 'rgba(165, 180, 252, 0.04)',
          border: `1px solid ${C.border}`,
          fontSize: 11, color: C.textFaint, lineHeight: 1.6,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Clock size={10} />
          <span>
            {view ? `Last checked ${new Date(view.checkedAt).toLocaleTimeString()}` : err || 'Checking…'}
            {' '}· figures are per server instance, so a quiet one can show 0 requests.
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes kr-pulse   { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.6); opacity: 0 } }
      `}</style>
    </div>
  )
}

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
      background: 'rgba(165, 180, 252, 0.08)',
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
        ? 'linear-gradient(135deg, rgba(165, 180, 252, 0.12), rgba(124, 92, 255, 0.05))'
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
