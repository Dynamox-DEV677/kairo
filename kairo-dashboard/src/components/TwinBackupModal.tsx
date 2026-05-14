/**
 * TwinBackupModal — export / import your Kairo OS twin so it can travel
 * between devices without any server involvement.
 *
 * Render path: any page can mount <TwinBackupModal open={...} onClose={...} />.
 * Currently mounted from KairoOS header + Settings.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Download, Upload, Copy, Check, ClipboardPaste,
  Smartphone, Laptop, AlertTriangle, Sparkles, FileJson, Layers, ChevronsRight,
} from 'lucide-react'
import {
  exportTwin, exportFilename, importTwin,
  type ImportMode, type ImportResult, dumpState,
} from '../lib/twin'

// ─── Strict monochrome palette ──────────────────────────────────────────────
const C = {
  bg:        '#06060a',
  panel:     '#0e0e16',
  panel2:    '#13131d',
  border:    '#22222e',
  borderSoft:'#1a1a26',
  text:      '#fafafa',
  textDim:   '#a1a1aa',
  textFaint: '#71717a',
  textGhost: '#52525b',
  purple:    '#a78bfa',
  purpleHi:  '#7c3aed',
  purpleDeep:'#5b21b6',
  purpleLite:'#c4b5fd',
  purpleSoft:'#e9d5ff',
}

interface Props {
  open:    boolean
  onClose: () => void
  onChange?: () => void   // notify parent so it can reload its snapshot
}

export default function TwinBackupModal({ open, onClose, onChange }: Props) {
  const [tab, setTab]               = useState<'export' | 'import'>('export')
  const [mode, setMode]             = useState<ImportMode>('replace')
  const [importText, setImportText] = useState('')
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [exportCopied, setCopied]   = useState(false)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  // Snapshot the current state for stats display
  const stats = useMemo(() => {
    if (!open) return null
    try {
      const s = dumpState()
      return {
        events:     s.events.length,
        doubts:     s.doubts.length,
        concepts:   s.concepts.length,
        formulas:   s.formulas.length,
        flashcards: s.flashcards.length,
        mastery:    s.mastery.length,
      }
    } catch { return null }
  }, [open])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset state on open
  useEffect(() => {
    if (open) { setResult(null); setImportText(''); setCopied(false); setTab('export') }
  }, [open])

  if (!open) return null

  function downloadFile() {
    const blob = new Blob([exportTwin()], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = exportFilename()
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(exportTwin())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* permission denied — user can still use the download button */ }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setImportText(text)
      runImport(text)
    }
    reader.readAsText(file)
  }

  function runImport(text?: string) {
    const r = importTwin(text ?? importText, mode)
    setResult(r)
    if (r.ok) onChange?.()
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="tbm-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(6,6,10,0.78)', backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />
      <motion.div
        key="tbm-panel"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        exit={{ opacity: 0, y: 24,    scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(640px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 80px)',
          zIndex: 9999,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.15)',
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '18px 22px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', gap: 14,
          background: `linear-gradient(180deg, rgba(124,58,237,0.10), transparent)`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 8px 22px rgba(124,58,237,0.4)',
          }}>
            <FileJson size={20} color="#000" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.purpleLite,
              textTransform: 'uppercase', letterSpacing: 1.6,
            }}>Twin · backup & restore</div>
            <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: -0.3, lineHeight: 1.25 }}>
              Move your Twin to another device
            </h2>
            <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4, lineHeight: 1.5 }}>
              Export here, then import on your phone or other laptop. Nothing leaves your device — it's a single JSON file.
            </div>
          </div>
          <button onClick={onClose} title="Close" style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'transparent', border: `1px solid ${C.border}`,
            cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <X size={14} color={C.textDim} />
          </button>
        </div>

        {/* TABS */}
        <div style={{
          display: 'flex', gap: 4, padding: '12px 18px 0',
          borderBottom: `1px solid ${C.borderSoft}`,
        }}>
          <TabBtn active={tab === 'export'} onClick={() => setTab('export')}>
            <Download size={12} /> Export
          </TabBtn>
          <TabBtn active={tab === 'import'} onClick={() => setTab('import')}>
            <Upload size={12} /> Import
          </TabBtn>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 22px' }}>
          {tab === 'export' && (
            <>
              {/* Step 1 visual */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(167,139,250,0.06)',
                border: '1px solid rgba(167,139,250,0.22)',
              }}>
                <Laptop size={18} color={C.purpleLite} />
                <ChevronsRight size={14} color={C.textFaint} />
                <Smartphone size={18} color={C.purpleLite} />
                <span style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, marginLeft: 4 }}>
                  Download the file here, then open Kairo on your other device and use <strong style={{ color: C.text }}>Import</strong> with the same file.
                </span>
              </div>

              {/* Stats summary */}
              {stats && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>
                    What's in your backup
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <StatTile label="Events"     value={stats.events} />
                    <StatTile label="Doubts"     value={stats.doubts} />
                    <StatTile label="Concepts"   value={stats.concepts} />
                    <StatTile label="Formulas"   value={stats.formulas} />
                    <StatTile label="Flashcards" value={stats.flashcards} />
                    <StatTile label="Mastery rows" value={stats.mastery} />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ y: -2, boxShadow: '0 12px 30px rgba(124,58,237,0.5)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={downloadFile}
                  style={{
                    flex: 1, minWidth: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px 20px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
                    color: '#000', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
                  }}>
                  <Download size={15} /> Download JSON
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={copyToClipboard}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '13px 18px', borderRadius: 12,
                    background: C.panel2, border: `1px solid ${C.border}`,
                    color: exportCopied ? C.purpleLite : C.textDim,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    transition: 'color 0.18s',
                  }}>
                  {exportCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy text</>}
                </motion.button>
              </div>

              <div style={{
                marginTop: 18, padding: '12px 14px', borderRadius: 10,
                background: 'rgba(196,181,253,0.04)', border: '1px solid rgba(196,181,253,0.16)',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <Sparkles size={13} color={C.purpleLite} style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 11.5, color: C.textDim, lineHeight: 1.55 }}>
                  Keep this file private — it contains every doubt, mistake, and formula Kairo has learned about you.
                  Save it somewhere only you can reach (cloud drive, email-to-self, AirDrop).
                </p>
              </div>
            </>
          )}

          {tab === 'import' && (
            <>
              {/* Mode toggle */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>
                  When importing
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <ModeCard
                    selected={mode === 'replace'}
                    onClick={() => setMode('replace')}
                    title="Replace"
                    sub="Wipe this device's twin and use the imported snapshot."
                  />
                  <ModeCard
                    selected={mode === 'merge'}
                    onClick={() => setMode('merge')}
                    title="Merge"
                    sub="Add the imported history on top of what's already here."
                  />
                </div>
              </div>

              {/* File picker */}
              <input
                ref={fileInputRef}
                type="file" accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={onPickFile}
              />
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '20px', borderRadius: 14,
                  background: 'rgba(167,139,250,0.05)',
                  border: '2px dashed rgba(167,139,250,0.4)',
                  color: C.purpleLite, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                  cursor: 'pointer', textAlign: 'center',
                  marginBottom: 14,
                }}>
                <Upload size={16} />
                Pick a .json backup file
              </motion.button>

              {/* Paste textarea */}
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 }}>
                …or paste the JSON
              </div>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder='{"schema":"kairo-twin-backup-v1", …}'
                rows={5}
                style={{
                  width: '100%', resize: 'vertical', minHeight: 110, maxHeight: 240,
                  padding: '12px 14px',
                  background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 10,
                  fontSize: 11.5, fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                  color: C.text, outline: 'none',
                }}
              />

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => runImport()}
                disabled={!importText.trim()}
                style={{
                  marginTop: 12, width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px', borderRadius: 12, border: 'none',
                  background: importText.trim() ? 'linear-gradient(135deg, #c4b5fd, #7c3aed)' : C.panel2,
                  color: importText.trim() ? '#000' : C.textGhost,
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
                  cursor: importText.trim() ? 'pointer' : 'not-allowed',
                }}>
                <ClipboardPaste size={14} /> Apply ({mode})
              </motion.button>

              {/* Result */}
              {result && <ResultPanel result={result} />}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '8px 14px', borderRadius: '8px 8px 0 0',
      background: 'transparent', border: 'none',
      borderBottom: `2px solid ${active ? C.purple : 'transparent'}`,
      color: active ? C.text : C.textDim,
      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
      cursor: 'pointer', letterSpacing: 0.3,
      transition: 'all 0.18s',
    }}>{children}</button>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: C.panel2, border: `1px solid ${C.borderSoft}`,
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2, letterSpacing: -0.4 }}>{value}</div>
    </div>
  )
}

function ModeCard({ selected, onClick, title, sub }: { selected: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        padding: '12px 14px', borderRadius: 10, textAlign: 'left',
        background: selected ? 'rgba(167,139,250,0.10)' : C.panel2,
        border: `1px solid ${selected ? C.purple : C.borderSoft}`,
        cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
        transition: 'all 0.18s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {selected
          ? <Check size={11} color={C.purpleLite} />
          : <Layers size={11} color={C.textFaint} />}
        <span style={{ fontSize: 12, fontWeight: 800, color: selected ? C.purpleLite : C.text, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.4 }}>{sub}</div>
    </motion.button>
  )
}

function ResultPanel({ result }: { result: ImportResult }) {
  if (!result.ok) {
    const msg = result.reason === 'invalid-json' ? 'That doesn\'t look like valid JSON.'
              : result.reason === 'wrong-schema' ? 'This file isn\'t a Kairo Twin backup. Schema mismatch.'
              :                                     'No data found in the backup.'
    return (
      <div style={{
        marginTop: 14, padding: '12px 14px', borderRadius: 10,
        background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.32)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <AlertTriangle size={14} color="#a78bfa" style={{ marginTop: 1, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12.5, color: C.textDim, lineHeight: 1.55 }}>{msg}</p>
      </div>
    )
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: 14, padding: '14px 16px', borderRadius: 12,
        background: 'rgba(196,181,253,0.08)', border: '1px solid rgba(196,181,253,0.4)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Check size={14} color={C.purpleLite} />
        <span style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>
          Twin restored ({result.mode === 'merge' ? 'merged' : 'replaced'})
        </span>
      </div>
      {result.stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, color: C.textDim }}>
          <Pill>{result.stats.events} events</Pill>
          <Pill>{result.stats.doubts} doubts</Pill>
          <Pill>{result.stats.concepts} concepts</Pill>
          <Pill>{result.stats.formulas} formulas</Pill>
          <Pill>{result.stats.flashcards} flashcards</Pill>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: C.textFaint }}>
        Kairo OS will recompute on the next refresh. Reload the page to see everything in place.
      </div>
    </motion.div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 999,
      background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)',
      fontWeight: 600,
    }}>{children}</span>
  )
}
