import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, User, Bell, Shield, Trash2, Check, FileJson, Smartphone, Laptop, ChevronsRight, KeyRound } from 'lucide-react'
import { confirmDialog } from '../components/ConfirmModal'
import TwinBackupModal from '../components/TwinBackupModal'
import ResetPasscode from './ResetPasscode'

const BOARDS = ['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka', 'UP Board', 'Bihar Board']
const CLASSES = ['6', '7', '8', '9', '10', '11', '12']

export default function Settings() {
  const stored = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
  const [name, setName] = useState(stored.name || 'Arjun Sharma')
  const [board, setBoard] = useState(stored.board || 'CBSE')
  const [cls, setCls] = useState(stored.cls || '10')
  const [role] = useState(stored.role || 'student')
  const [pic, setPic] = useState<string | null>(localStorage.getItem('kairo_profile_pic'))
  const [notifs, setNotifs] = useState(true)
  const [saved, setSaved] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePic(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setPic(url)
      localStorage.setItem('kairo_profile_pic', url)
    }
    reader.readAsDataURL(file)
  }

  function save() {
    const profile = { name, board, cls, role }
    localStorage.setItem('kairo_profile', JSON.stringify(profile))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function clearData() {
    const ok = await confirmDialog({
      title:        'Clear all saved data?',
      body:         'Your local Kairo profile, settings, and Twin data will be erased from this device. Your account on the server is not affected.',
      confirmLabel: 'Yes, clear everything',
      cancelLabel:  'Keep my data',
      tone:         'danger',
    })
    if (!ok) return
    localStorage.clear()
    window.location.reload()
  }

  const inp = {
    width: '100%', background: '#0E1117', border: '1px solid #1f2532',
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

      {/* Profile card */}
      <Section icon={<User size={14} />} title="Profile">
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePic} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            onClick={() => fileRef.current?.click()}
            style={{
              width: 68, height: 68, borderRadius: 18, overflow: 'hidden',
              background: pic ? 'transparent' : 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, position: 'relative',
              border: '2px solid #1f2532',
            }}
          >
            {pic
              ? <img src={pic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{name.charAt(0).toUpperCase()}</span>
            }
          </motion.div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginBottom: 4 }}>{name || 'Your Name'}</p>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ fontSize: 12, color: '#4F7CFF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Board">
                <select value={board} onChange={e => setBoard(e.target.value)} style={sel}>
                  {BOARDS.map(b => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Class">
                <select value={cls} onChange={e => setCls(e.target.value)} style={sel}>
                  {CLASSES.map(c => <option key={c}>Class {c}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={save}
          style={{
            marginTop: 18, padding: '10px 22px', borderRadius: 9, border: 'none',
            background: saved ? '#4F7CFF' : 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
            color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            transition: 'background 0.2s',
          }}
        >
          {saved ? <><Check size={14} /> Saved!</> : 'Save changes'}
        </motion.button>
      </Section>

      {/* Notifications */}
      <Section icon={<Bell size={14} />} title="Notifications">
        <ToggleRow
          label="Study reminders"
          desc="Get daily nudges to stay on track"
          value={notifs}
          onChange={setNotifs}
        />
      </Section>

      {/* Cross-device backup */}
      <Section icon={<FileJson size={14} />} title="Backup & sync">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(102, 217, 255, 0.08)',
          border: '1px solid rgba(102, 217, 255, 0.32)',
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
          Your study history syncs to your Kairo account automatically. Sign in on any phone or laptop and you'll see the sprint animation as your data arrives — then the cloud copy is wiped immediately so your data only ever lives on the device in your hand.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(102, 217, 255, 0.05)',
          border: '1px solid rgba(102, 217, 255, 0.22)',
        }}>
          <Laptop size={16} color="#A5B4FC" />
          <ChevronsRight size={13} color="#9CA3AF" />
          <Smartphone size={16} color="#A5B4FC" />
          <span style={{ fontSize: 12, color: '#B1B5BA', marginLeft: 4 }}>
            Need a manual file backup too? Open the tool below.
          </span>
        </div>

        <button
          onClick={() => setBackupOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
            background: 'linear-gradient(135deg, #A5B4FC, #4F7CFF)',
            border: 'none',
            color: '#000', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
            boxShadow: '0 6px 18px rgba(79, 124, 255, 0.35)',
          }}
        >
          <FileJson size={13} /> Open backup tool
        </button>
      </Section>

      {/* Security */}
      <Section icon={<KeyRound size={14} />} title="Security">
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.6 }}>
          Your 6-digit Kairo OS passcode locks the app on this device. Forgot it? Reset it via email below.
        </p>
        <button
          onClick={() => setResetOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 18px', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(165, 180, 252, 0.15), rgba(79, 124, 255, 0.10))',
            border: '1px solid rgba(165, 180, 252, 0.40)',
            color: '#A5B4FC',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          }}
        >
          <KeyRound size={13} /> Reset Passcode
        </button>
      </Section>

      {/* Privacy */}
      <Section icon={<Shield size={14} />} title="Privacy & Data">
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.6 }}>
          All your data is stored locally on your device. Nothing is sent to our servers. You can clear everything below.
        </p>
        <button
          onClick={clearData}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.2)',
            color: '#66D9FF', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}
        >
          <Trash2 size={13} /> Clear all data &amp; reset
        </button>
      </Section>

      {/* About */}
      <div style={{ padding: '20px 0', borderTop: '1px solid #1a1f2e', marginTop: 8 }}>
        <p style={{ fontSize: 11, color: '#27272a' }}>Kairo v1.0 · Built for Indian students · Powered by OpenRouter</p>
      </div>

      <TwinBackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />

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
    <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
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
          width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? '#4F7CFF' : '#1a1f2e',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ x: value ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }}
        />
      </button>
    </div>
  )
}
