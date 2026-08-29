import { useEffect, useState } from 'react'
import { studentMessage } from '../lib/aiError.core'
import { motion } from 'framer-motion'
import {
  Activity, Cpu, Database, GitBranch, Globe, Users, AlertTriangle,
  CheckCircle2, Server, Clock, Zap, Layers, Loader2,
} from 'lucide-react'

interface DeployInfo {
  commit:        string | null
  commitShort:   string | null
  commitMessage: string | null
  branch:        string | null
  repo:          string | null
  owner:         string | null
  deploymentId:  string | null
  region:        string | null
  env:           string
  url:           string | null
  nodeVersion:   string
  uptimeSeconds: number
}

interface StatusSnapshot {
  project:   string
  timestamp: string
  deploy:    DeployInfo
  users:     { total: number | null; students: number | null; teachers: number | null; admins: number | null; parents: number | null; activeLast24h: number | null }
  schools:   { total: number | null; active: number | null }
  database:  { reachable: boolean; recentLogins24h: number | null; recentRegistrations7d: number | null; error?: string }
  errors:    { totalLogged: number; recent: Array<{ ts: string; message: string; page?: string; stack?: string }> }
  features:  { total: number; list: Array<{ id: string; label: string; route: string; audience: string }>; byAudience: Record<string, number> }
  env:       Record<string, boolean>
}

export default function Ops() {
  const [data, setData] = useState<StatusSnapshot | null>(null)
  const [err,  setErr]  = useState('')
  const [lastFetch, setLastFetch] = useState<number>(0)

  async function load() {
    try {
      const r = await fetch('/api/ops/status', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setData(d)
      setErr('')
      setLastFetch(Date.now())
    } catch (e: any) {
      setErr(studentMessage(e))
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: 'linear-gradient(135deg, #7C5CFF, #A5B4FC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 22px rgba(124, 92, 255, 0.04)',
        }}>
          <Activity size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fafafa', margin: 0, letterSpacing: '-0.5px' }}>
            Kyno Ops
          </h1>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>
            Live status — auto-refreshes every 30s · Public JSON at <code style={{ background: '#1a1a2e', padding: '1px 6px', borderRadius: 4, color: '#A5B4FC', fontSize: 11 }}>/api/ops/status</code>
          </p>
        </div>
        <LiveDot lastFetch={lastFetch} err={err} />
      </div>

      {!data && !err && (
        <div style={{ padding: 60, textAlign: 'center', color: '#6B7280' }}>
          <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 13 }}>Loading status…</p>
        </div>
      )}

      {err && (
        <div style={{
          padding: 16, borderRadius: 10, marginBottom: 18,
          background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)',
          color: '#A5B4FC', fontSize: 13,
        }}>
          ⚠ {err}
        </div>
      )}

      {data && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12, marginBottom: 20,
          }}>
            <StatCard icon={Users}    label="Total Users"           value={data.users.total} accent="#A5B4FC" />
            <StatCard icon={Activity} label="Active (24h)"           value={data.users.activeLast24h} accent="#A5B4FC" />
            <StatCard icon={Globe}    label="Schools"                value={data.schools.total} sub={`${data.schools.active ?? 0} active`} accent="#A5B4FC" />
            <StatCard icon={Zap}      label="Logins (24h)"           value={data.database.recentLogins24h} accent="#A5B4FC" />
            <StatCard icon={Users}    label="New users (7d)"         value={data.database.recentRegistrations7d} accent="#DBE7FF" />
            <StatCard icon={Layers}   label="Features"               value={data.features.total} accent="#A5B4FC" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <DeployCard deploy={data.deploy} />
            <DatabaseCard db={data.database} env={data.env} />
          </div>

          <Section title="Users by role" icon={Users}>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <RolePill label="Students" count={data.users.students} color="#A5B4FC" />
              <RolePill label="Teachers" count={data.users.teachers} color="#A5B4FC" />
              <RolePill label="Admins"   count={data.users.admins}   color="#A5B4FC" />
              <RolePill label="Parents"  count={data.users.parents}  color="#A5B4FC" />
            </div>
          </Section>

          <Section title={`Recent errors (${data.errors.totalLogged} total)`} icon={AlertTriangle} accent="#A5B4FC">
            {data.errors.recent.length === 0 ? (
              <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>No errors logged 🎉</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.errors.recent.map((e, i) => (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(165, 180, 252, 0.05)', border: '1px solid rgba(165, 180, 252, 0.2)',
                    fontSize: 12,
                  }}>
                    <div style={{ color: '#A5B4FC', fontWeight: 600 }}>{e.message}</div>
                    <div style={{ color: '#9CA3AF', marginTop: 3, fontFamily: 'monospace', fontSize: 10.5 }}>
                      {e.page} · {new Date(e.ts).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Features (${data.features.total})`} icon={Layers}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
              {Object.entries(data.features.byAudience).map(([aud, n]) => (
                <span key={aud} style={{
                  padding: '4px 10px', borderRadius: 100,
                  background: 'rgba(124, 92, 255, 0.08)', border: '1px solid rgba(124, 92, 255, 0.25)',
                  fontSize: 11, color: '#A5B4FC', fontWeight: 600,
                }}>
                  {aud}: {n}
                </span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {data.features.list.map(f => (
                <div key={f.id} style={{
                  padding: '8px 11px', borderRadius: 7,
                  background: '#141A2A', border: '1px solid #1f2532',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span style={{ fontSize: 12, color: '#fafafa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.label}
                  </span>
                  <span style={{ fontSize: 9.5, color: '#6B7280', fontFamily: 'monospace' }}>{f.id}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, accent }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '14px 16px', borderRadius: 11,
        background: '#141A2A', border: '1px solid #1f2532',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
        <Icon size={11} color={accent} /> {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#fafafa', letterSpacing: '-1px' }}>
        {value === null || value === undefined ? '—' : value.toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#B1B5BA' }}>{sub}</div>}
    </motion.div>
  )
}

function DeployCard({ deploy }: { deploy: DeployInfo }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: '#141A2A', border: '1px solid #1f2532',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
        <GitBranch size={11} /> Latest Deploy
      </div>
      <Row label="Branch"   value={deploy.branch || 'local'} mono />
      <Row label="Commit"   value={deploy.commitShort ? `${deploy.commitShort}` : 'unknown'} mono />
      {deploy.commitMessage && <Row label="Message" value={deploy.commitMessage} truncate />}
      <Row label="Env"      value={deploy.env} accent={deploy.env === 'production' ? '#A5B4FC' : '#A5B4FC'} />
      <Row label="Region"   value={deploy.region || 'localhost'} mono />
      <Row label="Node"     value={deploy.nodeVersion} mono />
      <Row label="Uptime"   value={formatUptime(deploy.uptimeSeconds)} />
      {deploy.url && (
        <Row label="URL" value={
          <a href={deploy.url} target="_blank" rel="noreferrer" style={{ color: '#A5B4FC' }}>{deploy.url}</a>
        } />
      )}
    </div>
  )
}

function DatabaseCard({ db, env }: { db: any; env: Record<string, boolean> }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: '#141A2A', border: '1px solid #1f2532',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
        <Database size={11} /> Database & Services
      </div>
      <Row label="Supabase" value={db.reachable ? <Pill color="#A5B4FC" label="Reachable" /> : <Pill color="#A5B4FC" label={db.error || 'Down'} />} />
      <Row label="OpenRouter"     value={env.hasOpenRouter   ? <Pill color="#A5B4FC" label="OK" /> : <Pill color="#A5B4FC" label="Missing" />} />
      <Row label="Gemini (image)" value={env.hasGemini       ? <Pill color="#A5B4FC" label="OK" /> : <Pill color="#B1B5BA" label="Off" />} />
      <Row label="Pexels"         value={env.hasPexels       ? <Pill color="#A5B4FC" label="OK" /> : <Pill color="#B1B5BA" label="Off" />} />
      <Row label="Unsplash"       value={env.hasUnsplash     ? <Pill color="#A5B4FC" label="OK" /> : <Pill color="#B1B5BA" label="Off" />} />
      <Row label="Service Role"   value={env.hasServiceRole  ? <Pill color="#A5B4FC" label="OK" /> : <Pill color="#A5B4FC" label="Missing" />} />
      <Row label="Razorpay"       value={env.hasRazorpay     ? <Pill color="#A5B4FC" label="Live" /> : <Pill color="#A5B4FC" label="Demo" />} />
      <Row label="PWA"            value={env.pwaEnabled      ? <Pill color="#A5B4FC" label="On" /> : <Pill color="#B1B5BA" label="Off" />} />
    </div>
  )
}

function Section({ title, icon: Icon, children, accent = '#A5B4FC' }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, color: accent,
        textTransform: 'uppercase', letterSpacing: 1.5,
        margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon size={12} /> {title}
      </h2>
      <div style={{ background: '#141A2A', border: '1px solid #1f2532', borderRadius: 12, padding: 14 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, mono, accent, truncate }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 12 }}>
      <span style={{ color: '#9CA3AF' }}>{label}</span>
      <span style={{
        color: accent || '#fafafa',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontSize: mono ? 11.5 : 12,
        fontWeight: 600,
        maxWidth: '60%',
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        whiteSpace: truncate ? 'nowrap' : undefined,
      }}>
        {value}
      </span>
    </div>
  )
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 10,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
    }}>
      {label}
    </span>
  )
}

function RolePill({ label, count, color }: any) {
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 9,
      background: `${color}10`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', gap: 8, minWidth: 130,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#B1B5BA', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 17, color: '#fafafa', fontWeight: 800 }}>{count ?? '—'}</div>
      </div>
    </div>
  )
}

function LiveDot({ lastFetch, err }: { lastFetch: number; err: string }) {
  const stale = !err && Date.now() - lastFetch > 60_000
  const color = err ? '#A5B4FC' : stale ? '#A5B4FC' : '#A5B4FC'
  const label = err ? 'Error' : stale ? 'Stale' : 'Live'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 100,
      background: `${color}10`, border: `1px solid ${color}30`,
    }}>
      <motion.div
        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        style={{ width: 7, height: 7, borderRadius: '50%', background: color }}
      />
      <span style={{ fontSize: 11, color, fontWeight: 700 }}>{label}</span>
    </div>
  )
}

function formatUptime(seconds: number) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
