/**
 * Profile -- space 7. The settings screen becomes one place that answers
 * three questions a student should never have to wonder about:
 *
 *   What do strangers see of me?      the username, first, and nothing else
 *   What does Kyno think I study?     board, class, subjects, next exam
 *   Who can see me, and can I stop it? three switches, each saying exactly
 *                                     what is exposed; rooms default OFF
 *
 * Plus the app rows (reminder, theme, download my data) and the two DPDP
 * obligations at the bottom: sign out and delete -- really delete.
 *
 * No AI anywhere on this screen. Everything here is stored rows.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Check, X, Loader2, LogOut, Trash2, Download, Pencil } from 'lucide-react'
import { T, FONT, MONO, ICON } from '../lib/spaceTokens'
import { validateUsername, tileHue, tileLetter } from '../lib/username.core'
import { getSocialCached, refreshSocial, setUsername, setSocialSettings, forgetSocial, SOCIAL_EVENT, type SocialProfile } from '../lib/social'
import { getProfile, saveProfile, exportTwin } from '../lib/twin'
import { getJSON, setJSON, getRaw, setRaw, storedProfileRaw, setStoredProfileRaw, clearAuthTokens, removeStoredProfile } from '../lib/storage'
import { BOARD_OPTIONS } from '../lib/curriculum.core'
import { graphForProfile } from '../lib/syllabusFor'
import { getNotificationPrefs, setNotificationPref, type NotificationKind } from '../lib/notifications'
import Switch from '../components/Switch'
import { confirmDialog } from '../components/ConfirmModal'
import TwinBackupModal from '../components/TwinBackupModal'
import DeviceTransferModal from '../components/DeviceTransferModal'
import ResetPasscode from './ResetPasscode'
import { seedDemo, resetAllData, reconcileWithCloud, deleteCloudSnapshot } from '../lib/twin'
import { activeFlows, privacyHeadline } from '../lib/privacy.core'
import { telemetryEnabled, setTelemetryEnabled } from '../lib/usage'
import { isDevMode, setDevMode, getDevKeyRaw, setDevKey, looksLikeGroqKey, aiHeadersAsync } from '../lib/devKey'
import { safeDetail } from '../lib/aiError.core'
import { failureLog, clearFailureLog } from '../lib/dbError'
import { authToken } from '../lib/storage'
import { api, post, friendlyError } from '../lib/api'
import { getReminderTime, setReminderTime, askNotificationPermission } from '../lib/reminder'

type Style = React.CSSProperties

const CLASSES = ['6', '7', '8', '9', '10', '11', '12']
const STUDENT_PROFILE_KEY = 'kyno:student_profile'
const THEME_PREF_KEY = 'kyno:theme:pref'

/* ── shared bits ─────────────────────────────────────────────────────────── */

function Eyebrow({ children, color = T.muted }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color, textTransform: 'uppercase' }}>{children}</div>
}

function Group({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div style={{ marginTop: 22 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ marginTop: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>{children}</div>
      {note && <div style={{ fontSize: 12, color: T.faint, lineHeight: 1.5, marginTop: 8, padding: '0 4px' }}>{note}</div>}
    </div>
  )
}

/** One 14px row with a 1px #21212E divider above it (except the first). */
function Row({ label, value, accent, onClick, first, children }: { label: string; value?: React.ReactNode; accent?: boolean; onClick?: () => void; first?: boolean; children?: React.ReactNode }) {
  const Tag: any = onClick ? 'button' : 'div'
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${T.divider2}` }}>
      <Tag onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, width: '100%', padding: '0 14px',
        background: 'none', border: 'none', color: T.text, fontFamily: FONT, fontSize: 14, textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
      }}>
        <span style={{ flex: 1 }}>{label}</span>
        {value != null && <span style={{ fontSize: 14, color: accent ? T.accentPale : T.muted, fontWeight: accent ? 600 : 500, textAlign: 'right' }}>{value}</span>}
        {onClick && <ChevronRight size={16} color={T.faint} {...ICON} />}
      </Tag>
      {children}
    </div>
  )
}


function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 36, padding: '0 12px', borderRadius: 100, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
      background: on ? T.accentSurface : T.raised, border: `1px solid ${on ? T.accent : T.borderCtl}`, color: on ? T.accentPale : T.muted,
    }}>{children}</button>
  )
}

const inputStyle: Style = { height: 44, borderRadius: 12, padding: '0 12px', background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT, fontSize: 16, boxSizing: 'border-box' }

/* ── what Kyno thinks the student studies ─────────────────────────────────── */

function readStudies() {
  const twin = (() => { try { return getProfile() || {} } catch { return {} as any } })() as any
  const stored = (() => { try { return JSON.parse(storedProfileRaw() || '{}') || {} } catch { return {} } })()
  const board: string = twin.board || stored.board || ''
  const cls: string = String(twin.cls || stored.cls || '')
  const sp = getJSON<{ examDates?: Array<{ name?: string; date?: string }> }>(STUDENT_PROFILE_KEY)
  const exams = (sp?.examDates || []).map(e => ({ name: e?.name || 'Exam', date: e?.date || '', t: Date.parse(e?.date || '') })).filter(e => Number.isFinite(e.t)).sort((a, b) => a.t - b.t)
  const next = exams.find(e => e.t > Date.now() - 86400000) || null
  return { board, cls, next, storedId: stored.id as string | undefined, localMode: !!stored.localMode }
}

function fmtDate(iso: string) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/* ── the page ─────────────────────────────────────────────────────────────── */

export default function Profile({ onLogout, onOpenSettings }: { onLogout?: () => void; onOpenSettings?: () => void }) {
  const [social, setSocial] = useState<SocialProfile | null>(() => getSocialCached())
  const [tick, setTick] = useState(0)
  const studies = useMemo(() => readStudies(), [tick])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshSocial().then(p => { if (p) setSocial(p) })
    const on = (e: Event) => setSocial((e as CustomEvent).detail)
    window.addEventListener(SOCIAL_EVENT, on)
    return () => window.removeEventListener(SOCIAL_EVENT, on)
  }, [])

  /* username */
  const [editingName, setEditingName] = useState(false)
  const [draft, setDraft] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const username = social?.username || 'student'
  const live = editingName ? validateUsername(draft) : null

  async function saveName() {
    const v = validateUsername(draft)
    if (!v.ok) { setNameErr(v.reason); return }
    setNameBusy(true); setNameErr('')
    try { setSocial(await setUsername(v.username)); setEditingName(false) }
    catch (e) { setNameErr(friendlyError(e) || 'Could not change your name right now.') }
    finally { setNameBusy(false) }
  }

  /* switches */
  const [switchBusy, setSwitchBusy] = useState<string | null>(null)
  async function flip(key: 'show_in_leagues' | 'allow_battles' | 'join_rooms', v: boolean) {
    if (!social) return
    const before = social
    setSocial({ ...social, [key]: v }); setSwitchBusy(key)
    try { setSocial(await setSocialSettings({ [key]: v })) }
    catch { setSocial(before) }
    finally { setSwitchBusy(null) }
  }

  /* studies */
  const [editing, setEditing] = useState<'board' | 'class' | 'exam' | 'subjects' | null>(null)
  const [examName, setExamName] = useState('')
  const [examDate, setExamDate] = useState('')
  const subjects = useMemo(() => {
    try { return (graphForProfile({ board: studies.board, cls: studies.cls })?.subjects || []).map(s => s.name) } catch { return [] }
  }, [studies.board, studies.cls])

  function saveStudies(patch: { board?: string; cls?: string }) {
    try { saveProfile(patch as any) } catch { /* twin unavailable */ }
    try {
      const stored = JSON.parse(storedProfileRaw() || '{}') || {}
      setStoredProfileRaw(JSON.stringify({ ...stored, ...patch }))
    } catch { /* storage blocked */ }
    try { window.dispatchEvent(new CustomEvent('kairo:profile')) } catch { /* ssr */ }
    setEditing(null); setTick(t => t + 1)
  }

  function saveExam() {
    if (!examDate) return
    const sp = getJSON<{ examDates?: Array<{ name?: string; date?: string }> }>(STUDENT_PROFILE_KEY) || {}
    const rest = (sp.examDates || []).filter(e => e?.date !== examDate)
    setJSON(STUDENT_PROFILE_KEY, { ...sp, examDates: [{ name: examName.trim() || 'Exam', date: examDate }, ...rest] })
    try { window.dispatchEvent(new CustomEvent('kairo:profile')) } catch { /* ssr */ }
    setEditing(null); setTick(t => t + 1)
  }

  /* app rows */
  const [editingApp, setEditingApp] = useState<'reminders' | 'theme' | 'email' | null>(null)
  const [prefs, setPrefs] = useState(() => getNotificationPrefs())
  const [reminder, setReminder] = useState<string | null>(() => getReminderTime())
  const [themePref, setThemePref] = useState<'dark' | 'light' | 'system'>(() => (getRaw(THEME_PREF_KEY) as any) || 'dark')
  const [downloading, setDownloading] = useState(false)
  const [downloadNote, setDownloadNote] = useState('')

  async function download() {
    setDownloading(true); setDownloadNote('')
    let server: unknown
    try { server = await api('/account/export') } catch (e: any) { server = { unavailable: true, reason: e?.message || 'offline' } }
    let device: unknown
    try { device = JSON.parse(exportTwin()) } catch { device = { unavailable: true } }
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), what: 'Everything Kyno holds about you: the server rows and this device\'s learning history.', server, device }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `kyno-my-data-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    setDownloadNote((server as any)?.unavailable ? 'Saved this device\'s data. The server copy was not reachable — try again online.' : 'Saved. That is everything, as JSON.')
    setDownloading(false)
  }

  /* ── moved across from the old Settings screen ─────────────────────────── */
  const stored = useMemo(() => { try { return JSON.parse(storedProfileRaw() || '{}') || {} } catch { return {} as any } }, [tick])
  const [backupOpen, setBackupOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [telemetry, setTelemetry] = useState(telemetryEnabled)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [devMode, setDevModeState] = useState(isDevMode())
  const [devKeyInput, setDevKeyInput] = useState(getDevKeyRaw())
  const [showKey, setShowKey] = useState(false)
  const [devMsg, setDevMsg] = useState('')
  const [devTesting, setDevTesting] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailStep, setEmailStep] = useState<'idle' | 'sending' | 'code' | 'verifying' | 'done'>('idle')
  const [emailErr, setEmailErr] = useState('')
  const [failures, setFailures] = useState(() => { try { return failureLog() } catch { return [] } })
  const [copied, setCopied] = useState(false)

  async function syncNow() {
    if (syncing) return
    setSyncing(true); setSyncMsg('')
    try {
      const r = await reconcileWithCloud()
      if (r.ok) { setSyncMsg('Synced. Reloading…'); setTimeout(() => window.location.reload(), 1200) }
      else setSyncMsg(r.reason === 'not-signed-in' ? 'Sign in first, then sync.' : `Sync failed: ${r.reason || 'network issue'}`)
    } catch (e) { setSyncMsg('Sync failed: ' + safeDetail(e, 'try again in a moment')) }
    finally { setSyncing(false) }
  }

  async function deleteCloud() {
    const ok = await confirmDialog({
      title: 'Delete your cloud backup?',
      body: 'Removes the copy in your Kyno account. Your work stays on this device, but another phone will not be able to pull it.',
      confirmLabel: 'Delete cloud copy', cancelLabel: 'Keep it', tone: 'danger',
    })
    if (!ok) return
    try { const r = await deleteCloudSnapshot(); setSyncMsg(r.ok ? 'Cloud backup deleted.' : 'Could not delete — try again.') }
    catch { setSyncMsg('Could not delete — try again.') }
  }

  async function requestEmailCode() {
    setEmailErr(''); setEmailStep('sending')
    try {
      const r = await fetch('/api/account/email-change/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail, name: stored.name || '' }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Could not send the code.')
      setEmailStep('code')
    } catch (e) { setEmailErr(safeDetail(e, 'Could not send the code.')); setEmailStep('idle') }
  }

  async function verifyEmailCode() {
    setEmailErr(''); setEmailStep('verifying')
    try {
      // The server identifies the account from this token — it does not accept
      // a user_id from the body, which once allowed account takeover.
      const r = await fetch('/api/account/email-change/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken() || ''}` },
        body: JSON.stringify({ new_email: newEmail, code: emailCode }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Verification failed.')
      try { setStoredProfileRaw(JSON.stringify({ ...stored, email: newEmail.trim().toLowerCase() })) } catch { /* storage blocked */ }
      setEmailStep('done')
    } catch (e) { setEmailErr(safeDetail(e, 'Verification failed.')); setEmailStep('code') }
  }

  async function testDevKey() {
    const k = devKeyInput.trim()
    if (!looksLikeGroqKey(k)) { setDevMsg('Enter a valid gsk_… key first.'); return }
    setDevKey(k); setDevTesting(true); setDevMsg('Testing your key…')
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await aiHeadersAsync()), 'x-groq-key': k },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with only the word: ok' }] }),
      })
      const data = await res.json().catch(() => ({}))
      setDevMsg(res.ok && !data?._fallback && data?.choices?.[0]?.message?.content
        ? 'Key works. Kyno is now running on your Groq account.'
        : 'Key failed: ' + String(data?.error || `HTTP ${res.status}`).slice(0, 160))
    } catch (e) { setDevMsg('Key test failed: ' + safeDetail(e, 'the key was rejected')) }
    finally { setDevTesting(false) }
  }

  async function loadDemoProfile() {
    const ok = await confirmDialog({ title: 'Load demo data?', body: 'Adds two weeks of realistic Class 10 activity on this device. Stacks on top of what is already here.', confirmLabel: 'Load demo data', cancelLabel: 'Cancel', tone: 'primary' })
    if (ok) { seedDemo(); window.location.reload() }
  }
  async function resetToFresh() {
    const ok = await confirmDialog({ title: 'Reset to a fresh state?', body: 'Wipes every Kyno data store on this device — events, flashcards, mistakes, history. You stay signed in.', confirmLabel: 'Reset everything', cancelLabel: 'Keep my data', tone: 'danger' })
    if (ok) { resetAllData(); window.location.reload() }
  }
  async function clearData() {
    const ok = await confirmDialog({ title: 'Clear everything on this device?', body: 'Erases your local Kyno profile, settings and learning history. Your account on the server is not affected.', confirmLabel: 'Yes, clear everything', cancelLabel: 'Keep my data', tone: 'danger' })
    if (ok) { localStorage.clear(); window.location.reload() }
  }

  /* sign out / delete */
  function signOut() {
    forgetSocial(); clearAuthTokens(); removeStoredProfile()
    if (onLogout) onLogout(); else window.location.reload()
  }
  const [deleting, setDeleting] = useState<'idle' | 'confirm' | 'busy' | 'error'>('idle')
  const [deleteWord, setDeleteWord] = useState('')
  async function startDelete() {
    const ok = await confirmDialog({
      title: 'Delete your account?',
      body: 'This deletes your account and every row Kyno holds about you — progress, league history, battle records, backups, reports. It really deletes; there is no undo and no 30-day wait.',
      confirmLabel: 'Continue', cancelLabel: 'Keep my account', tone: 'danger',
    })
    if (ok) setDeleting('confirm')
  }
  async function reallyDelete() {
    setDeleting('busy')
    try {
      await post('/account/delete', { confirm: 'DELETE' })
      forgetSocial(); clearAuthTokens(); removeStoredProfile()
      try { localStorage.clear() } catch { /* ignore */ }
      window.location.href = '/'
    } catch { setDeleting('error') }
  }

  const offline = !!social?.offline
  const shell: Style = { position: 'absolute', inset: 0, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }

  return (
    <div style={shell}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px calc(24px + env(safe-area-inset-bottom))' }}>
        <Eyebrow color={T.accent}>Profile</Eyebrow>

        {/* username first: a student should never wonder what strangers see */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
          <div aria-hidden style={{ width: 52, height: 52, borderRadius: 16, background: tileHue(username), display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 700, color: T.text, flexShrink: 0 }}>{tileLetter(username)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {!editingName ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</div>
                  <button onClick={() => { setDraft(username); setNameErr(''); setEditingName(true) }} aria-label="Change username" disabled={offline} style={{ width: 44, height: 44, background: 'none', border: 'none', display: 'grid', placeItems: 'center', cursor: offline ? 'not-allowed' : 'pointer', opacity: offline ? 0.5 : 1 }}>
                    <Pencil size={16} color={T.muted} {...ICON} />
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: T.dim, marginTop: -4 }}>This is the name others see. Never your real name.</div>
                {offline && <div style={{ fontSize: 12, color: T.warning, marginTop: 4 }}>Usernames go live after the server update — until then you appear as this placeholder.</div>}
              </>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={draft} onChange={e => setDraft(e.target.value.toLowerCase())} autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20}
                    aria-label="New username" onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                    style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: MONO }} />
                  <button onClick={saveName} disabled={nameBusy || !live?.ok} aria-label="Save username" style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: live?.ok ? T.accent : T.raised, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    {nameBusy ? <Loader2 size={18} {...ICON} /> : <Check size={18} {...ICON} />}
                  </button>
                  <button onClick={() => setEditingName(false)} aria-label="Cancel" style={{ width: 44, height: 44, borderRadius: 12, background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.muted, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={18} {...ICON} /></button>
                </div>
                <div style={{ fontSize: 12.5, marginTop: 6, color: nameErr ? T.error : live && !live.ok ? T.dim : T.faint }}>
                  {nameErr || (live && !live.ok ? live.reason : 'Lowercase letters, digits and _ · 3 to 20 · once a day')}
                </div>
              </div>
            )}
          </div>
        </div>

        <Group title="Your studies">
          <Row first label="Board" value={studies.board || 'Not set'} onClick={() => setEditing(editing === 'board' ? null : 'board')}>
            {editing === 'board' && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 14px 14px' }}>
                {BOARD_OPTIONS.map(b => <Chip key={b.value} on={studies.board === b.value} onClick={() => saveStudies({ board: b.value })}>{b.label}</Chip>)}
              </div>
            )}
          </Row>
          <Row label="Class" value={studies.cls || 'Not set'} onClick={() => setEditing(editing === 'class' ? null : 'class')}>
            {editing === 'class' && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 14px 14px' }}>
                {CLASSES.map(c => <Chip key={c} on={studies.cls === c} onClick={() => saveStudies({ cls: c })}>Class {c}</Chip>)}
              </div>
            )}
          </Row>
          <Row label="Subjects" value={subjects.length ? `${subjects.length} · ${subjects.join(', ')}` : 'From your board and class'} onClick={() => setEditing(editing === 'subjects' ? null : 'subjects')}>
            {editing === 'subjects' && (
              <div style={{ padding: '0 14px 14px', fontSize: 12.5, color: T.dim, lineHeight: 1.5 }}>
                {subjects.length ? 'These come from the verified syllabus for your board and class. Choosing a subset arrives with the syllabus for more boards.' : 'No verified syllabus for this board and class yet, so Kyno does not invent one.'}
              </div>
            )}
          </Row>
          <Row label="Next exam" accent value={studies.next ? `${fmtDate(studies.next.date)} · ${studies.next.name}` : 'Not set'} onClick={() => { setEditing(editing === 'exam' ? null : 'exam'); setExamName(studies.next?.name || ''); setExamDate(studies.next?.date || '') }}>
            {editing === 'exam' && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={examName} onChange={e => setExamName(e.target.value)} placeholder="Half-yearly" aria-label="Exam name" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
                  <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} aria-label="Exam date" style={{ ...inputStyle, padding: '0 10px' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={saveExam} disabled={!examDate} style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: examDate ? T.accent : T.raised, color: examDate ? '#fff' : T.faint, fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditing(null)} style={{ height: 44, padding: '0 14px', borderRadius: 12, background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text2, fontFamily: FONT, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                </div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>The planner counts every day to this date, so keep it right.</div>
              </div>
            )}
          </Row>
        </Group>

        <Group title="Who can see you" note="Turning a switch off removes you from that pool right away, and your row disappears from other students' screens on their next refresh — not at the end of the week.">
          {([
            ['show_in_leagues', 'Show me in leagues', 'Only your username, never your real name'],
            ['allow_battles',   'Allow battles',      'Random opponents, no messages'],
            ['join_rooms',      'Join study rooms',   'Others see your subject only'],
          ] as Array<['show_in_leagues' | 'allow_battles' | 'join_rooms', string, string]>).map(([key, title, sub], i) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 14px', borderTop: i ? `1px solid ${T.divider2}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: T.dim, marginTop: 2 }}>{sub}</div>
              </div>
              {switchBusy === key ? <Loader2 size={18} color={T.muted} {...ICON} /> : <Switch label={title} on={social ? social[key] : key !== 'join_rooms'} disabled={!social || offline} onChange={v => flip(key, v)} />}
            </div>
          ))}
        </Group>

        <Group title="App">
          <Row first label="Reminders" value={reminder ? `Daily at ${reminder}` : 'Off'} onClick={() => setEditingApp(a => a === 'reminders' ? null : 'reminders')}>
            {editingApp === 'reminders' && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="time" value={reminder || ''} onChange={e => { const t = e.target.value || null; setReminder(t); setReminderTime(t); if (t) askNotificationPermission() }} aria-label="Reminder time" style={{ ...inputStyle, flex: 1 }} />
                  {reminder && <button onClick={() => { setReminder(null); setReminderTime(null) }} style={{ height: 44, padding: '0 14px', borderRadius: 12, background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text2, fontFamily: FONT, fontSize: 14, cursor: 'pointer' }}>Off</button>}
                </div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>Fires while Kyno is open. A website cannot ping a closed phone, so Kyno does not pretend to.</div>
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  {([['study', 'Study reminders'], ['achievement', 'Progress and streaks'], ['product', 'What is new in Kyno']] as Array<[NotificationKind, string]>).map(([k, label]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
                      <span style={{ flex: 1, fontSize: 13.5, color: T.text2 }}>{label}</span>
                      <Switch label={label} on={!!(prefs as any)[k]} onChange={v => setPrefs(setNotificationPref(k, v))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Row>
          <Row label="Theme" value={themePref === 'dark' ? 'Dark' : themePref === 'light' ? 'Light' : 'System'} onClick={() => setEditingApp(a => a === 'theme' ? null : 'theme')}>
            {editingApp === 'theme' && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['dark', 'light', 'system'] as const).map(t => <Chip key={t} on={themePref === t} onClick={() => { setThemePref(t); setRaw(THEME_PREF_KEY, t) }}>{t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'System'}</Chip>)}
                </div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>Kyno is dark today. Your choice is saved and applies as soon as the light theme ships with the new design.</div>
              </div>
            )}
          </Row>
          <Row label="Download my data" value={downloading ? <Loader2 size={16} {...ICON} /> : <Download size={16} color={T.muted} {...ICON} />} onClick={downloading ? undefined : download} />
          {downloadNote && <div style={{ padding: '0 14px 12px', fontSize: 12.5, color: T.dim }}>{downloadNote}</div>}
        </Group>

        {/* ── everything the old Settings screen used to hold ───────────────
            Merged here rather than deleted. Profile had rebuilt the username,
            the studies and the privacy switches; these six were only on
            Settings, so redirecting that route without moving them would have
            quietly removed cloud backup, moving to a new phone, the passcode,
            the privacy inventory, telemetry and developer mode. */}

        <Group title="Account">
          <Row first label="Email" value={emailStep === 'done' ? newEmail : (stored.email || 'Not set')} onClick={() => setEditingApp(a => a === 'email' ? null : 'email')}>
            {editingApp === 'email' && (
              <div style={{ padding: '0 14px 14px' }}>
                {emailStep === 'done' ? (
                  <div style={{ fontSize: 13, color: T.success }}>Changed. Sign in with the new address next time.</div>
                ) : (
                  <>
                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" type="email"
                      autoCapitalize="none" autoCorrect="off" aria-label="New email" style={{ ...inputStyle, width: '100%' }} />
                    {emailStep === 'code' && (
                      <input value={emailCode} onChange={e => setEmailCode(e.target.value)} placeholder="6-digit code" inputMode="numeric"
                        aria-label="Verification code" style={{ ...inputStyle, width: '100%', marginTop: 8, fontFamily: MONO }} />
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={emailStep === 'code' ? verifyEmailCode : requestEmailCode}
                        disabled={emailStep === 'sending' || emailStep === 'verifying' || !newEmail.trim()}
                        style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: newEmail.trim() ? T.accent : T.raised, color: newEmail.trim() ? '#fff' : T.faint, fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        {emailStep === 'sending' ? 'Sending…' : emailStep === 'verifying' ? 'Checking…' : emailStep === 'code' ? 'Verify' : 'Send me a code'}
                      </button>
                    </div>
                    {emailErr && <div style={{ fontSize: 12.5, color: T.error, marginTop: 8 }}>{emailErr}</div>}
                    <div style={{ fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>Only you ever see this. It is never shown to another student.</div>
                  </>
                )}
              </div>
            )}
          </Row>
          <Row label="Passcode" value="Reset" onClick={() => setResetOpen(true)} />
        </Group>

        <Group title="Backup and devices" note={syncMsg || 'Your work lives on this device and is copied to your account so a lost phone does not lose it.'}>
          <Row first label="Sync now" value={syncing ? <Loader2 size={16} {...ICON} /> : undefined} onClick={syncing ? undefined : syncNow} />
          <Row label="Save a backup file" onClick={() => setBackupOpen(true)} />
          <Row label="Move to a new phone" onClick={() => setTransferOpen(true)} />
          <Row label="Delete my cloud copy" onClick={deleteCloud} />
        </Group>

        <Group title="Privacy" note="This is everything that leaves your device, and when.">
          <div style={{ padding: '12px 14px', fontSize: 12.5, color: T.text2, lineHeight: 1.55, borderBottom: `1px solid ${T.divider2}` }}>
            {privacyHeadline({ signedIn: !!studies.storedId && !studies.localMode, schoolMode: false, telemetry })}
          </div>
          {activeFlows({ signedIn: !!studies.storedId && !studies.localMode, schoolMode: false, telemetry }).map((f: any, i: number) => (
            <div key={f.id} style={{ padding: '10px 14px', borderTop: i ? `1px solid ${T.divider2}` : 'none' }}>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{f.what}</div>
              <div style={{ fontSize: 11.5, color: T.dim, marginTop: 3 }}>{f.when} · goes to {f.where}</div>
              {f.note && <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4, lineHeight: 1.5 }}>{f.note}</div>}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 14px', borderTop: `1px solid ${T.divider2}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Share which screens I open</div>
              <div style={{ fontSize: 12.5, color: T.dim, marginTop: 2 }}>The screen name and the time, never what you typed</div>
            </div>
            <Switch label="Share which screens I open" on={telemetry} onChange={v => { setTelemetry(v); setTelemetryEnabled(v) }} />
          </div>
        </Group>

        {/* The real database error, in the app, because a student -- or the
            person fixing this -- cannot open a server log from a phone. Every
            failed Supabase call is recorded verbatim with its Postgres code. */}
        <Group title="Connection" note={failures.length ? 'Kyno could not save something. This is the exact error.' : 'No save has failed on this device.'}>
          {failures.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: T.success }}>Everything has saved.</div>
          ) : (
            <>
              {failures.slice(-4).reverse().map((f, i) => (
                <div key={f.at + String(i)} style={{ padding: '10px 14px', borderTop: i ? `1px solid ${T.divider2}` : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{f.op} {f.table}{f.code ? ` — ${f.code}` : ''}</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 3, fontFamily: MONO, lineHeight: 1.5, wordBreak: 'break-word' }}>{f.message}</div>
                  <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>{new Date(f.at).toLocaleString()}</div>
                </div>
              ))}
              <Row label={copied ? 'Copied' : 'Copy all errors'} onClick={() => {
                const text = failures.map(f => `${new Date(f.at).toISOString()} ${f.op} ${f.table} ${f.code || ''} ${f.message}`).join(String.fromCharCode(10))
                try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* no clipboard */ }
              }} />
              <Row label="Clear this list" onClick={() => { clearFailureLog(); setFailures([]) }} />
            </>
          )}
        </Group>

        <Group title="This device" note="These only touch this phone. Your account is not affected.">
          <Row first label="Load demo data" onClick={loadDemoProfile} />
          <Row label="Reset to a fresh state" onClick={resetToFresh} />
          <Row label="Clear everything on this device" onClick={clearData} />
        </Group>

        <Group title="Developer" note={devMsg || 'Run Kyno on your own Groq key instead of the shared pool.'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 14px' }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Use my own key</div>
            <Switch label="Use my own key" on={devMode} onChange={v => { setDevModeState(v); setDevMode(v) }} />
          </div>
          {devMode && (
            <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${T.divider2}` }}>
              <input value={devKeyInput} onChange={e => setDevKeyInput(e.target.value)} placeholder="gsk_…" type={showKey ? 'text' : 'password'}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Groq API key"
                style={{ ...inputStyle, width: '100%', marginTop: 12, fontFamily: MONO }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={testDevKey} disabled={devTesting} style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: T.accent, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {devTesting ? 'Testing…' : 'Save and test'}
                </button>
                <button onClick={() => setShowKey(s => !s)} style={{ height: 44, padding: '0 14px', borderRadius: 12, background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text2, fontFamily: FONT, fontSize: 14, cursor: 'pointer' }}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}
        </Group>

        <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
          <button onClick={signOut} style={{ flex: 1, height: 48, borderRadius: 14, background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text2, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <LogOut size={16} {...ICON} /> Sign out
          </button>
          <button onClick={startDelete} style={{ flex: 1, height: 48, borderRadius: 14, background: 'transparent', border: `1px solid ${T.errorBorder}`, color: T.error, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Trash2 size={16} {...ICON} /> Delete account
          </button>
        </div>
        {deleting !== 'idle' && (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: T.errorBg, border: `1px solid ${T.errorBorder}` }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Type DELETE to confirm</div>
            <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5, marginTop: 4 }}>Your rows go first, then the account itself. Nothing is kept.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={deleteWord} onChange={e => setDeleteWord(e.target.value)} placeholder="DELETE" aria-label="Type DELETE" autoCapitalize="characters" style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: MONO }} />
              <button onClick={reallyDelete} disabled={deleteWord !== 'DELETE' || deleting === 'busy'} style={{ height: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: deleteWord === 'DELETE' ? T.error : T.raised, color: deleteWord === 'DELETE' ? '#fff' : T.faint, fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {deleting === 'busy' ? <Loader2 size={16} {...ICON} /> : 'Delete everything'}
              </button>
              <button onClick={() => { setDeleting('idle'); setDeleteWord('') }} style={{ height: 44, padding: '0 12px', borderRadius: 12, background: 'transparent', border: `1px solid ${T.borderCtl}`, color: T.text2, fontFamily: FONT, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
            {deleting === 'error' && <div style={{ fontSize: 12.5, color: T.error, marginTop: 8 }}>The server did not confirm the deletion. Nothing was removed — try again online, or email kairoindustries.cor@gmail.com.</div>}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 11.5, color: T.barFlat, marginTop: 28, fontFamily: MONO }}>
          Kyno {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}{typeof __APP_BUILD__ === 'string' && __APP_BUILD__ ? ` · ${__APP_BUILD__}` : ''}
        </div>
      </div>

      <TwinBackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
      <DeviceTransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
      {resetOpen && <ResetPasscode onClose={() => setResetOpen(false)} />}
    </div>
  )
}
