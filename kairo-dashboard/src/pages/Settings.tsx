import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, User, Bell, Shield, Trash2, Check, FileJson, Smartphone, Laptop, ChevronsRight, KeyRound, Sparkles, RotateCcw, Mail, RefreshCw, CloudOff, Loader2, Terminal, ExternalLink } from 'lucide-react'
import { confirmDialog } from '../components/ConfirmModal'
import TwinBackupModal from '../components/TwinBackupModal'
import DeviceTransferModal from '../components/DeviceTransferModal'
import ResetPasscode from './ResetPasscode'
import { seedDemo, resetAllData, reconcileWithCloud, deleteCloudSnapshot } from '../lib/twin'
import { loadGame } from '../lib/game'
import { getNotificationPrefs, setNotificationPref } from '../lib/notifications'
import { PrimaryButton, ToggleChip } from '../components/PrimaryButton'
import { getRaw, setRaw, activeBackend } from '../lib/storage'
import { DecoratedAvatar, DECORATIONS, getDecor, setDecor } from '../components/AvatarDecor'
import { isDevMode, setDevMode, getDevKeyRaw, setDevKey, looksLikeGroqKey, aiHeaders } from '../lib/devKey'

const BOARDS = ['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka', 'UP Board', 'Bihar Board']
const CLASSES = ['6', '7', '8', '9', '10', '11', '12']

function safeProfile(): any {
  try { return JSON.parse(localStorage.getItem('kairo_profile') || '{}') || {} }
  catch { return {} }
}

export default function Settings() {
  const stored = safeProfile()
  const [name, setName] = useState(stored.name || 'Arjun Sharma')
  const [board, setBoard] = useState(stored.board || 'CBSE')
  const [cls, setCls] = useState(stored.cls || '10')
  const [role] = useState(stored.role || 'student')
  const [pic, setPic] = useState<string | null>(
    () => getRaw('kairo_profile_pic') ?? localStorage.getItem('kairo_profile_pic'),
  )
  // Persisted per kind — the old single boolean was component state that
  // nothing saved and nothing read.
  const [notifPrefs, setNotifPrefs] = useState(getNotificationPrefs)
  const [saved, setSaved] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Developer Mode (bring-your-own Groq key) ──────────────────────────────
  const [devMode, setDevModeState] = useState(isDevMode())
  const [devKeyInput, setDevKeyInput] = useState(getDevKeyRaw())
  const [showKey, setShowKey] = useState(false)
  const [devMsg, setDevMsg] = useState('')
  const [devTesting, setDevTesting] = useState(false)

  function toggleDevMode(on: boolean) {
    setDevModeState(on)
    setDevMode(on)
    setDevMsg(on
      ? (looksLikeGroqKey(getDevKeyRaw()) ? 'Developer mode on — Kyno is using your key.' : 'Developer mode on — add your Groq key below to start using it.')
      : 'Developer mode off — back to Kyno\'s built-in AI.')
  }

  function saveDevKey() {
    const k = devKeyInput.trim()
    setDevKey(k)
    setDevKeyInput(k)
    if (!k) { setDevMsg('Key cleared.'); return }
    setDevMsg(looksLikeGroqKey(k)
      ? 'Saved ✓ Stored on this device only.'
      : '⚠ That doesn\'t look like a Groq key (they start with "gsk_"). Saved anyway — double-check it.')
  }

  async function testDevKey() {
    const k = devKeyInput.trim()
    if (!looksLikeGroqKey(k)) { setDevMsg('Enter a valid gsk_… key first.'); return }
    setDevKey(k)
    setDevTesting(true); setDevMsg('Testing your key…')
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders(), 'x-groq-key': k },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with only the word: ok' }] }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && !data?._fallback && data?.choices?.[0]?.message?.content) {
        setDevMsg('Key works ✓ Kyno is now running on your Groq account.')
      } else {
        setDevMsg('Key failed: ' + String(data?.error || `HTTP ${res.status}`).slice(0, 160))
      }
    } catch (e: any) {
      setDevMsg('Key test failed: ' + String(e?.message || e).slice(0, 160))
    } finally {
      setDevTesting(false)
    }
  }

  async function syncNow() {
    if (syncing) return
    setSyncing(true); setSyncMsg('')
    try {
      const r = await reconcileWithCloud()
      if (r.ok) {
        const xp = (() => { try { return loadGame().totalXP } catch { return 0 } })()
        setSyncMsg(`Synced ✓ This device now has ${xp.toLocaleString()} XP. Reloading…`)
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setSyncMsg(r.reason === 'not-signed-in'
          ? 'You must be signed in to sync — sign in and try again.'
          : `Sync failed: ${r.reason || 'network issue'}`)
      }
    } catch (e: any) {
      setSyncMsg('Sync failed: ' + String(e?.message || e))
    } finally {
      setSyncing(false)
    }
  }

  async function deleteCloud() {
    const ok = await confirmDialog({
      title:        'Delete your cloud backup?',
      body:         'Removes the copy stored in your Kyno account. Your data stays on this device, but other devices won\'t be able to pull it until this device syncs again.',
      confirmLabel: 'Delete cloud copy',
      cancelLabel:  'Keep it',
      tone:         'danger',
    })
    if (!ok) return
    setSyncMsg('')
    try {
      const r = await deleteCloudSnapshot()
      setSyncMsg(r.ok ? 'Cloud backup deleted.' : 'Could not delete — try again.')
    } catch {
      setSyncMsg('Could not delete — try again.')
    }
  }

  const [decor, setDecorSel] = useState(getDecor())
  function pickDecor(id: string) { setDecor(id); setDecorSel(id) }

  const [emailCur] = useState<string>(stored.email || '')
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailStep, setEmailStep] = useState<'idle' | 'sending' | 'code' | 'verifying' | 'done'>('idle')
  const [emailErr, setEmailErr] = useState('')

  async function requestEmailCode() {
    setEmailErr('')
    setEmailStep('sending')
    try {
      const r = await fetch('/api/account/email-change/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail, name }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Could not send the code.')
      setEmailStep('code')
    } catch (e: any) {
      setEmailErr(e.message || 'Could not send the code.')
      setEmailStep('idle')
    }
  }

  async function verifyEmailCode() {
    setEmailErr('')
    setEmailStep('verifying')
    try {
      // The server now identifies the account from this token — it no longer
      // accepts a user_id from the body (that allowed account takeover).
      const r = await fetch('/api/account/email-change/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}`,
        },
        body: JSON.stringify({ new_email: newEmail, code: emailCode }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Verification failed.')
      const merged = { ...safeProfile(), email: newEmail.trim().toLowerCase() }
      localStorage.setItem('kairo_profile', JSON.stringify(merged))
      setEmailStep('done')
    } catch (e: any) {
      setEmailErr(e.message || 'Verification failed.')
      setEmailStep('code')
    }
  }

  function handlePic(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setPic(url)
      setRaw('kairo_profile_pic', url)
      try { localStorage.setItem('kairo_profile_pic', url) } catch {  }
      console.log('[settings] profile pic saved via', activeBackend())
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    const profile = { ...stored, name, board, cls, role }
    localStorage.setItem('kairo_profile', JSON.stringify(profile))
    try { window.dispatchEvent(new CustomEvent('kairo:profile')) } catch {  }
    if (stored.id && !stored.localMode) {
      try {
        const { supabase } = await import('../lib/supabase')
        await supabase.from('users').update({ name }).eq('id', stored.id)
      } catch {  }
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function clearData() {
    const ok = await confirmDialog({
      title:        'Clear all saved data?',
      body:         'Your local Kyno profile, settings, and Twin data will be erased from this device. Your account on the server is not affected.',
      confirmLabel: 'Yes, clear everything',
      cancelLabel:  'Keep my data',
      tone:         'danger',
    })
    if (!ok) return
    localStorage.clear()
    window.location.reload()
  }

  async function loadDemoProfile() {
    const ok = await confirmDialog({
      title:        'Load demo profile?',
      body:         'Adds two weeks of realistic activity for a Class 10 CBSE student — flashcards, mistakes, concept graph nodes, and pinned formulas. Stacks on top of your existing data; use "Reset to fresh state" first to start clean.',
      confirmLabel: 'Load demo data',
      cancelLabel:  'Cancel',
      tone:         'primary',
    })
    if (!ok) return
    seedDemo()
    window.location.reload()
  }

  async function resetToFresh() {
    const ok = await confirmDialog({
      title:        'Reset to fresh state?',
      body:         'Wipes every Kyno data store on this device — Twin events, flashcards, mistakes, concept graph, study history, recent chats. Your login stays signed in.',
      confirmLabel: 'Reset everything',
      cancelLabel:  'Keep my data',
      tone:         'danger',
    })
    if (!ok) return
    resetAllData()
    window.location.reload()
  }

  const inp = {
    width: '100%', background: '#141A2A', border: '1px solid #1f2532',
    borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fafafa',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
  }

  const sel = { ...inp, appearance: 'none' as const }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 680, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Manage your profile and preferences</p>
      </div>

      <Section icon={<User size={14} />} title="Profile">
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePic} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            onClick={() => fileRef.current?.click()}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          >
            <DecoratedAvatar pic={pic} name={name} size={64} decor={decor} rounded={18} />
          </motion.div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginBottom: 4 }}>{name || 'Your Name'}</p>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ fontSize: 12, color: '#7C5CFF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Camera size={11} /> Change photo
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          <Field label="Full name">
            <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Your name" />
          </Field>

          {role === 'student' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Board">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {BOARDS.map(b => (
                    <ToggleChip key={b} type="button" selected={board === b} onClick={() => setBoard(b)}>{b}</ToggleChip>
                  ))}
                </div>
              </Field>
              <Field label="Class">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CLASSES.map(c => (
                    <ToggleChip key={c} type="button" selected={cls === `Class ${c}`} onClick={() => setCls(`Class ${c}`)}>Class {c}</ToggleChip>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>

        <PrimaryButton onClick={save} style={{ marginTop: 18 }}>
          {saved ? <><Check size={14} /> Saved!</> : 'Save changes'}
        </PrimaryButton>
      </Section>

      <Section icon={<Mail size={14} />} title="Email">
        <p style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 12, lineHeight: 1.5 }}>
          {emailCur
            ? <>Signed in as <span style={{ color: '#fafafa', fontWeight: 600 }}>{emailCur}</span>. </>
            : null}
          To switch to a new email, we send a 6-digit code to the new address to prove it's yours.
        </p>

        {emailStep === 'done' ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
            borderRadius: 10, background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.35)',
            fontSize: 13, color: '#4ade80', fontWeight: 600,
          }}>
            <Check size={14} /> Email updated to {newEmail.trim().toLowerCase()}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="new@email.com"
                type="email"
                disabled={emailStep === 'sending' || emailStep === 'verifying'}
                style={{ ...inp, flex: 1 }}
              />
              <button
                onClick={requestEmailCode}
                disabled={!newEmail.includes('@') || emailStep === 'sending' || emailStep === 'verifying'}
                className="kyno-chunky"
                style={{ padding: '10px 16px', fontSize: 12.5, whiteSpace: 'nowrap' }}
              >
                {emailStep === 'sending' ? 'Sending…' : emailStep === 'code' || emailStep === 'verifying' ? 'Resend code' : 'Send code'}
              </button>
            </div>

            {(emailStep === 'code' || emailStep === 'verifying') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={emailCode}
                  onChange={e => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  style={{ ...inp, flex: 1, letterSpacing: 6, fontWeight: 700, textAlign: 'center' }}
                />
                <button
                  onClick={verifyEmailCode}
                  disabled={emailCode.length !== 6 || emailStep === 'verifying'}
                  className="kyno-chunky cyan"
                  style={{ padding: '10px 16px', fontSize: 12.5, whiteSpace: 'nowrap' }}
                >
                  {emailStep === 'verifying' ? 'Checking…' : 'Verify & change'}
                </button>
              </div>
            )}

            {emailErr && (
              <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{emailErr}</p>
            )}
          </div>
        )}
      </Section>

      <Section icon={<Sparkles size={14} />} title="Avatar decoration">
        <p style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.5 }}>
          Pick a ring or orbiter that hangs around your profile picture everywhere in Kyno.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {DECORATIONS.map(d => (
            <button
              key={d.id}
              onClick={() => pickDecor(d.id)}
              title={d.label}
              className={`kyno-tile${decor === d.id ? ' on' : ''}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '10px 8px 8px', width: 84, fontFamily: 'inherit',
              }}
            >
              <DecoratedAvatar pic={pic} name={name} size={40} decor={d.id} rounded={11} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: decor === d.id ? '#A5B4FC' : '#9CA3AF' }}>
                {d.label}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Bell size={14} />} title="Notifications">
        <ToggleRow
          label="Study reminders"
          desc="One nudge a day about your own plan"
          value={notifPrefs.study}
          onChange={v => setNotifPrefs(setNotificationPref('study', v))}
        />
        <ToggleRow
          label="Progress and streaks"
          desc="When you hit a milestone or a streak"
          value={notifPrefs.achievement}
          onChange={v => setNotifPrefs(setNotificationPref('achievement', v))}
        />
        <ToggleRow
          label="News about Kyno"
          desc="New features and updates. Off by default."
          value={notifPrefs.product}
          onChange={v => setNotifPrefs(setNotificationPref('product', v))}
        />
      </Section>

      <Section icon={<FileJson size={14} />} title="Backup & sync">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(165, 180, 252, 0.08)',
          border: '1px solid rgba(165, 180, 252, 0.32)',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#A5B4FC', boxShadow: '0 0 12px #A5B4FC' }} />
          <span style={{ fontSize: 12.5, color: '#fafafa', fontWeight: 700 }}>
            Auto-sync is on
          </span>
          <span style={{ fontSize: 11.5, color: '#B1B5BA', marginLeft: 'auto' }}>
            Every change uploads in the background.
          </span>
        </div>

        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.6 }}>
          Your study history is backed up to your Kyno account and kept there — so you can sign in on any phone or laptop and pull it, even when your other devices are off. Only you can read it. Tap <strong style={{ color: '#fafafa' }}>Sync now</strong> to push this device up and pull anything new down.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(165, 180, 252, 0.05)',
          border: '1px solid rgba(165, 180, 252, 0.22)',
        }}>
          <Laptop size={16} color="#A5B4FC" />
          <ChevronsRight size={13} color="#9CA3AF" />
          <Smartphone size={16} color="#A5B4FC" />
          <span style={{ fontSize: 12, color: '#B1B5BA', marginLeft: 4 }}>
            Includes your XP, streak, mistakes, flashcards and concept map.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="kyno-chunky cyan"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '11px 18px', fontSize: 13,
            }}
          >
            {syncing
              ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}><Loader2 size={13} /></motion.span>
              : <RefreshCw size={13} />}
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>

          <button
            onClick={() => setBackupOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              background: '#1C2233', border: '1px solid rgba(255,255,255,0.08)',
              color: '#B1B5BA', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            }}
          >
            <FileJson size={13} /> Manual file backup
          </button>

          <button
            onClick={deleteCloud}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(251,113,133,0.28)',
              color: '#FB7185', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
              marginLeft: 'auto',
            }}
          >
            <CloudOff size={13} /> Delete cloud copy
          </button>
        </div>

        <PrimaryButton onClick={() => setTransferOpen(true)} full style={{ marginTop: 12 }}>
          <Smartphone size={15} /> Transfer to a new device
        </PrimaryButton>
        <p style={{ fontSize: 11, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>
          Move your whole profile to another phone or laptop — encrypted end-to-end, nothing uploaded to Kyno.
        </p>

        {syncMsg && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: '#A5B4FC', fontWeight: 600 }}>
            {syncMsg}
          </div>
        )}
      </Section>

      <Section icon={<KeyRound size={14} />} title="Security">
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.6 }}>
          Your 6-digit Kyno passcode locks the app on this device. Forgot it? Reset it via email below.
        </p>
        <PrimaryButton variant="secondary" onClick={() => setResetOpen(true)}>
          <KeyRound size={13} /> Reset Passcode
        </PrimaryButton>
      </Section>

      <Section icon={<Sparkles size={14} />} title="Demo & Data">
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.6 }}>
          Populate Kyno with realistic Class 10 CBSE activity so the dashboard, Flashcards,
          Mistake Analysis, Concept Map and Formula Sheet all read as a real student's history.
          Use "Reset" to wipe and start clean.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <PrimaryButton onClick={loadDemoProfile}>
            <Sparkles size={13} /> Load Demo Profile
          </PrimaryButton>
          <button
            onClick={resetToFresh}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#B1B5BA', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            }}
          >
            <RotateCcw size={13} /> Reset to fresh state
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#6B7280', marginTop: 10, lineHeight: 1.5 }}>
          Demo loads 14 backdated activity events, 30 flashcards, 3 mistakes, 12 concept-map nodes,
          5 pinned formulas. All on-device — nothing leaves your browser.
        </p>
      </Section>

      <Section icon={<Shield size={14} />} title="Privacy & Data">
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.6 }}>
          All your data is stored locally on your device. Nothing is sent to our servers. You can clear everything below.
        </p>
        <button
          onClick={clearData}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.28)',
            color: '#FB7185', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          }}
        >
          <Trash2 size={13} /> Clear all data &amp; reset
        </button>
      </Section>

      <Section icon={<Terminal size={14} />} title="Developer Mode">
        <ToggleRow
          label="Use my own Groq API key"
          desc="Run all of Kyno's AI on your personal Groq account. While this is on, Kyno's shared keys are never used."
          value={devMode}
          onChange={toggleDevMode}
        />

        {devMode && (
          <div style={{ marginTop: 18 }}>
            <Field label="Groq API key">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="kyno-input"
                  type={showKey ? 'text' : 'password'}
                  value={devKeyInput}
                  onChange={e => { setDevKeyInput(e.target.value); setDevMsg('') }}
                  placeholder="gsk_…"
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  style={{ flex: 1, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 13 }}
                />
                <button
                  onClick={() => setShowKey(s => !s)}
                  className="kyno-ghost"
                  style={{ padding: '10px 13px', fontSize: 12, flexShrink: 0 }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <PrimaryButton onClick={saveDevKey}>
                <Check size={13} /> Save key
              </PrimaryButton>
              <button
                onClick={testDevKey}
                disabled={devTesting}
                className="kyno-chunky cyan"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', fontSize: 13 }}
              >
                {devTesting
                  ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}><Loader2 size={13} /></motion.span>
                  : <Sparkles size={13} />}
                {devTesting ? 'Testing…' : 'Test key'}
              </button>
            </div>

            {devMsg && (
              <div style={{
                marginTop: 12, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5,
                color: /works|Saved|✓/.test(devMsg) ? 'var(--c-cyan)'
                  : /fail|⚠/.test(devMsg) ? 'var(--c-error)'
                  : '#A5B4FC',
              }}>
                {devMsg}
              </div>
            )}

            <p style={{ fontSize: 11, color: '#6B7280', marginTop: 16, lineHeight: 1.65 }}>
              Get a free key at{' '}
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
                 style={{ color: '#A5B4FC', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                console.groq.com/keys <ExternalLink size={10} />
              </a>. Your key stays only in this browser — never uploaded, synced, or shared. Turn this off any time to switch back to Kyno's built-in AI.
            </p>
          </div>
        )}
      </Section>

      <div style={{ padding: '20px 0', borderTop: '1px solid #171D2D', marginTop: 8 }}>
        <p style={{ fontSize: 11, color: '#27272a' }}>Kyno v1.0 · Built for Indian students · Powered by Groq</p>
      </div>

      <TwinBackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
      <DeviceTransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />

      {resetOpen && (
        <ResetPasscode
          onClose={() => setResetOpen(false)}
          initialEmail={stored.email || ''}
        />
      )}
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#141A2A', border: '1px solid #1f2532', borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: '#B1B5BA' }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#B1B5BA' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</label>
      {children}
    </div>
  )
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <p style={{ fontSize: 13, color: '#d4d4d8', fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: value ? 'var(--c-purple)' : '#171D2D',
          boxShadow: value
            ? 'inset 0 2px 5px rgba(0,0,0,0.28), 0 2px 0 0 var(--c-purple-deep)'
            : 'inset 0 2px 5px rgba(0,0,0,0.40)',
          position: 'relative', transition: 'background 0.2s, box-shadow 0.2s', flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ x: value ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
        />
      </button>
    </div>
  )
}
