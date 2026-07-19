import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import {
  X, ArrowLeft, Send, Download, Upload, Copy, Check, Lock, ShieldCheck,
  Loader2, CheckCircle2, AlertTriangle, FileDown, Share2, RefreshCw,
  Smartphone, Zap, Layers, BookOpen,
} from 'lucide-react'
import {
  exportToFile, importFromFile, peekFileManifest,
  downloadTransferFile, shareTransferFile,
  type FileExportResult,
} from '../transfer/transferManager'
import type { TransferManifest } from '../transfer/types'
import type { RestoreResult } from '../transfer/importer'

const C = {
  bg: '#0A0D16', panel: '#141A2A', panel2: '#1C2233',
  border: 'rgba(255,255,255,0.08)', text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF',
  purple: '#A5B4FC', purpleHi: '#7C6BF6', green: '#34D399', amber: '#FFB44A', coral: '#FB7185',
}

type Mode = 'home' | 'send' | 'receive'

export default function DeviceTransferModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('home')

  useEffect(() => { if (open) setMode('home') }, [open])
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="dt-bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(4,5,8,0.92)', backdropFilter: 'blur(14px)' }} />
          <motion.div key="dt-panel"
            initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 'min(500px, calc(100vw - 28px))', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
              zIndex: 9999, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20,
              boxShadow: '0 24px 70px rgba(0,0,0,0.72)', padding: '22px 22px 26px',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              {mode !== 'home' && (
                <button onClick={() => setMode('home')} aria-label="Back" style={iconBtn}>
                  <ArrowLeft size={16} color={C.dim} />
                </button>
              )}
              <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: -0.2 }}>
                {mode === 'home' ? 'Transfer to a new device' : mode === 'send' ? 'Send your data' : 'Receive your data'}
              </div>
              <button onClick={onClose} aria-label="Close" style={iconBtn}><X size={16} color={C.dim} /></button>
            </div>

            <AnimatePresence mode="wait">
              {mode === 'home'    && <Home    key="home"    onSend={() => setMode('send')} onReceive={() => setMode('receive')} />}
              {mode === 'send'    && <SendFlow key="send" />}
              {mode === 'receive' && <ReceiveFlow key="recv" />}
            </AnimatePresence>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18, fontSize: 11, color: C.faint }}>
              <Lock size={12} color={C.purple} />
              End-to-end encrypted (AES-256) · never uploaded to Kyno servers
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Home({ onSend, onReceive }: { onSend: () => void; onReceive: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Radar />
      <p style={{ textAlign: 'center', fontSize: 13, color: C.dim, margin: '4px 0 18px', lineHeight: 1.55 }}>
        Move your whole Kyno profile — notes, flashcards, XP, study history, the works — to another device. Encrypted the entire way.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <BigCard icon={<Send size={22} color={C.purple} />} title="Send" sub="From this device" onClick={onSend} accent={C.purple} />
        <BigCard icon={<Download size={22} color={C.green} />} title="Receive" sub="Onto this device" onClick={onReceive} accent={C.green} />
      </div>
    </motion.div>
  )
}

function SendFlow() {
  const [exp, setExp]     = useState<FileExportResult | null>(null)
  const [err, setErr]     = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState<'idle' | 'ok'>('idle')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    exportToFile()
      .then(setExp)
      .catch(e => setErr(String(e?.message || e)))
  }, [])

  useEffect(() => {
    if (!exp?.keyB64) return
    QRCode.toDataURL(exp.keyB64, { width: 240, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0f19', light: '#ffffff' } })
      .then(setQrUrl).catch(() => setQrUrl(''))
  }, [exp?.keyB64])

  if (err) return <ErrorBox message={err} />
  if (!exp) return <Building label="Encrypting your data…" sub="Compressing + locking everything with a one-time key." />

  const s = exp.manifest.stats
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <StatsRow s={s} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <div style={{ padding: 10, background: '#fff', borderRadius: 16, boxShadow: '0 8px 30px rgba(124,107,246,0.25)' }}>
          {qrUrl
            ? <img src={qrUrl} alt="One-time key QR" width={200} height={200} style={{ display: 'block', borderRadius: 8 }} />
            : <div style={{ width: 200, height: 200, display: 'grid', placeItems: 'center' }}><Loader2 size={20} className="animate-spin" color="#0b0f19" /></div>}
        </div>
        <div style={{ fontSize: 11.5, color: C.faint, textAlign: 'center' }}>Scan this key on the new device — or copy it below</div>
        <button onClick={() => { navigator.clipboard?.writeText(exp.keyB64).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }) }}
          style={{ ...keyPill }}>
          {copied ? <Check size={13} color={C.green} /> : <Copy size={13} color={C.purple} />}
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.dim, wordBreak: 'break-all', textAlign: 'left' }}>{exp.keyB64}</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => downloadTransferFile(exp.fileText, exp.fileName)} style={{ ...primaryBtn, flex: 1 }}>
          <FileDown size={15} /> Download .kyno file
        </button>
        <button onClick={async () => { const ok = await shareTransferFile(exp.fileText, exp.fileName); if (ok) setShared('ok') }} style={secondaryBtn}>
          {shared === 'ok' ? <Check size={15} color={C.green} /> : <Share2 size={15} />}
        </button>
      </div>

      <Steps items={[
        'Download (or Share) the .kyno file and move it to your new device.',
        'On the new device: open Kyno → Transfer → Receive → pick the file.',
        'Scan or paste this key to unlock it. Nothing decrypts without it.',
      ]} />
    </motion.div>
  )
}

function ReceiveFlow() {
  const [fileText, setFileText] = useState('')
  const [manifest, setManifest] = useState<TransferManifest | null>(null)
  const [key, setKey] = useState('')
  const [phase, setPhase] = useState<'pick' | 'preview' | 'restoring' | 'done' | 'error'>('pick')
  const [result, setResult] = useState<RestoreResult | null>(null)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    try {
      const text = await f.text()
      const m = peekFileManifest(text)
      if (!m) { setErr('That doesn\'t look like a Kyno transfer file.'); setPhase('error'); return }
      setFileText(text); setManifest(m); setPhase('preview'); setErr('')
    } catch { setErr('Could not read that file.'); setPhase('error') }
  }

  async function restore() {
    setPhase('restoring'); setErr('')
    const r = await importFromFile(fileText, key)
    setResult(r)
    if (r.ok) setPhase('done')
    else { setErr(r.error || 'Import failed.'); setPhase('error') }
  }

  if (phase === 'error') return <ErrorBox message={err} onRetry={() => { setPhase('pick'); setErr('') }} />
  if (phase === 'restoring') return <Building label="Restoring your data…" sub="Verifying, decrypting and rebuilding everything locally." />

  if (phase === 'done' && result) return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{ width: 68, height: 68, borderRadius: '50%', margin: '10px auto 14px', display: 'grid', placeItems: 'center', background: 'rgba(52,211,153,0.14)', border: `1px solid ${C.green}55` }}>
        <CheckCircle2 size={34} color={C.green} />
      </motion.div>
      <div style={{ fontSize: 19, fontWeight: 800, color: C.text }}>Transfer Complete</div>
      <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Everything restored successfully — {result.restoredKeys} data stores.</div>
      {manifest && <div style={{ marginTop: 14 }}><StatsRow s={manifest.stats} /></div>}
      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: C.panel2, border: `1px solid ${C.border}`, textAlign: 'left', fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>What now?</div>
        • Once you've confirmed everything's here, you can wipe the old device from its <b style={{ color: C.text }}>Settings → Clear all data</b>.<br />
        • Or keep both — they stay independent, and you can re-sync anytime from <b style={{ color: C.text }}>Settings → Sync now</b>.
      </div>
      <button onClick={() => window.location.reload()} style={{ ...primaryBtn, width: '100%', marginTop: 16, justifyContent: 'center' }}>
        <RefreshCw size={15} /> Reload to finish
      </button>
    </motion.div>
  )

  if (phase === 'preview' && manifest) return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ fontSize: 13, color: C.dim, textAlign: 'center', marginBottom: 12 }}>
        From <b style={{ color: C.text }}>{manifest.deviceLabel}</b> — you're about to restore:
      </div>
      <StatsRow s={manifest.stats} />
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: 1.2, margin: '18px 0 6px' }}>Key from the other device</label>
      <input value={key} onChange={e => setKey(e.target.value)} placeholder="Paste or scan the key…" autoFocus
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10, background: C.panel2, border: `1px solid ${C.border}`, color: C.text, fontFamily: 'ui-monospace, monospace', fontSize: 12, outline: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, margin: '10px 0 0', fontSize: 11, color: C.amber }}>
        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        This replaces the data currently on this device with the incoming profile.
      </div>
      <button onClick={restore} disabled={!key.trim()} style={{ ...primaryBtn, width: '100%', marginTop: 14, justifyContent: 'center', opacity: key.trim() ? 1 : 0.5, cursor: key.trim() ? 'pointer' : 'not-allowed' }}>
        <ShieldCheck size={15} /> Unlock & restore
      </button>
    </motion.div>
  )

  // pick
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Radar tint={C.green} />
      <input ref={fileRef} type="file" accept=".kyno,application/json,application/octet-stream" onChange={onPick} style={{ display: 'none' }} />
      <button onClick={() => fileRef.current?.click()} style={{ ...dashedBtn, marginTop: 4 }}>
        <Upload size={18} color={C.green} />
        Choose the .kyno file
      </button>
      <p style={{ textAlign: 'center', fontSize: 12, color: C.faint, marginTop: 12, lineHeight: 1.55 }}>
        Pick the transfer file you moved over from your other device. You'll enter its key next.
      </p>
    </motion.div>
  )
}

// ── shared bits ──────────────────────────────────────────────────────────────
function Radar({ tint = C.purple }: { tint?: string }) {
  return (
    <div style={{ position: 'relative', height: 96, display: 'grid', placeItems: 'center', margin: '2px 0 4px' }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          initial={{ scale: 0.4, opacity: 0.5 }} animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', border: `1.5px solid ${tint}` }} />
      ))}
      <div style={{ width: 58, height: 58, borderRadius: 16, background: `linear-gradient(135deg, ${tint}, ${C.purpleHi})`, display: 'grid', placeItems: 'center', boxShadow: `0 8px 28px ${tint}55` }}>
        <Smartphone size={26} color="#0b0f19" />
      </div>
    </div>
  )
}

function BigCard({ icon, title, sub, onClick, accent }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; accent: string }) {
  return (
    <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{ padding: '20px 14px', borderRadius: 16, cursor: 'pointer', background: C.panel2, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
      <div style={{ width: 48, height: 48, borderRadius: 13, display: 'grid', placeItems: 'center', background: `${accent}18`, border: `1px solid ${accent}44` }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{title}</div>
      <div style={{ fontSize: 11, color: C.faint }}>{sub}</div>
    </motion.button>
  )
}

function StatsRow({ s }: { s: TransferManifest['stats'] }) {
  const chips = [
    { icon: Zap,      label: 'XP',         val: s.xp,          col: C.amber },
    { icon: Layers,   label: 'Flashcards', val: s.flashcards,  col: C.purple },
    { icon: BookOpen, label: 'Events',     val: s.events,      col: C.purple },
    { icon: ShieldCheck, label: 'Badges',  val: s.achievements, col: C.green },
  ].filter(c => c.val > 0)
  if (chips.length === 0) chips.push({ icon: Layers, label: 'Data stores', val: s.keys, col: C.purple })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
      {chips.map(c => (
        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 10, background: C.panel2, border: `1px solid ${C.border}` }}>
          <c.icon size={13} color={c.col} />
          <b style={{ fontSize: 14, color: C.text }}>{c.val}</b>
          <span style={{ fontSize: 10.5, color: C.faint, fontWeight: 600 }}>{c.label}</span>
        </div>
      ))}
    </div>
  )
}

function Building({ label, sub }: { label: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '18px 0' }}>
      <Radar />
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 12, color: C.faint, marginTop: 5 }}>{sub}</div>
    </motion.div>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'rgba(165,180,252,0.14)', color: C.purple, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{t}</div>
        </div>
      ))}
    </div>
  )
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '14px 0' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '4px auto 12px', display: 'grid', placeItems: 'center', background: 'rgba(251,113,133,0.14)', border: `1px solid ${C.coral}55` }}>
        <AlertTriangle size={26} color={C.coral} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Something went wrong</div>
      <div style={{ fontSize: 12.5, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>{message}</div>
      {onRetry && <button onClick={onRetry} style={{ ...primaryBtn, marginTop: 14 }}>Try again</button>}
    </motion.div>
  )
}

const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, background: 'transparent', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C.purple}, ${C.purpleHi})`, color: '#0b0f19', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }
const secondaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 12, background: C.panel2, border: `1px solid ${C.border}`, color: C.dim, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }
const dashedBtn: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '22px', borderRadius: 14, background: 'rgba(52,211,153,0.05)', border: '2px dashed rgba(52,211,153,0.3)', color: C.green, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const keyPill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: C.panel2, border: `1px solid ${C.border}`, cursor: 'pointer', maxWidth: '100%', fontFamily: 'inherit' }
