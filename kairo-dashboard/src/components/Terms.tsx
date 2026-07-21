import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Shield, ChevronDown } from 'lucide-react'

const C = {
  bg:        '#0A0D16',
  panel:     '#141A2A',
  border:    'rgba(255,255,255,0.08)',
  borderSoft:'rgba(255,255,255,0.06)',
  text:      '#ffffff',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
  textVery:  '#6B7280',
  purple:    '#A5B4FC',
  purpleHi:  '#7C5CFF',
  purpleSoft:'#A5B4FC',
  purpleLite:'#DBE7FF',
}
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif"

const EFFECTIVE_DATE = 'May 16, 2026'
const CONTACT_EMAIL  = 'kairoindustries.cor@gmail.com'
const CONTACT_PHONE  = '877 800 4043'

type Tab = 'terms' | 'privacy'
const EV_OPEN = 'kairo:terms:open'

export function openTerms(tab: Tab = 'terms') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EV_OPEN, { detail: { tab } }))
}

export function TermsAcceptLine({ action = 'continuing' }: { action?: string }) {
  return (
    <p style={{
      fontSize: 11, lineHeight: 1.55, color: C.textVery,
      textAlign: 'center', margin: '12px 0 0', padding: '0 6px',
      fontFamily: FONT,
    }}>
      By {action}, you agree to Kyno's{' '}
      <button onClick={() => openTerms('terms')} style={linkBtn}>
        Terms &amp; Conditions
      </button>
      {' '}and{' '}
      <button onClick={() => openTerms('privacy')} style={linkBtn}>
        Privacy Policy
      </button>.
    </p>
  )
}

export function TermsInlineLink({ tab = 'terms', children }: { tab?: Tab; children: React.ReactNode }) {
  return (
    <button onClick={() => openTerms(tab)} style={{
      ...linkBtn, fontSize: 'inherit', color: 'inherit',
    }}>
      {children}
    </button>
  )
}

export function TermsHost() {
  const [open, setOpen] = useState(false)
  const [tab, setTab]   = useState<Tab>('terms')

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<{ tab?: Tab }>
      setTab(ce.detail?.tab || 'terms')
      setOpen(true)
    }
    window.addEventListener(EV_OPEN, onOpen as EventListener)
    return () => window.removeEventListener(EV_OPEN, onOpen as EventListener)
  }, [])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <TermsSheet tab={tab} setTab={setTab} onClose={() => setOpen(false)} />
      )}
    </AnimatePresence>,
    document.body,
  )
}

function TermsSheet({ tab, setTab, onClose }: {
  tab: Tab
  setTab: (t: Tab) => void
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [shadow, setShadow] = useState(false)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    setShadow(false)
  }, [tab])

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    setShadow(e.currentTarget.scrollTop > 4)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(2,2,5,0.86)',

        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'env(safe-area-inset-top) 0 env(safe-area-inset-bottom)',
        fontFamily: FONT,
      }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ y: 24, opacity: 0, scale: 0.985 }}
        animate={{ y: 0,  opacity: 1, scale: 1 }}
        exit={{    y: 18, opacity: 0, scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        style={{
          width: '100%', maxWidth: 720,
          height: '100%', maxHeight: 'min(880px, 92dvh)',
          margin: '0 16px',
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 22,
          boxShadow: '0 30px 100px rgba(124, 92, 255, 0.01), 0 0 0 1px rgba(165, 180, 252, 0.01)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kairo-terms-title"
      >
        <div style={{
          flexShrink: 0,
          padding: '18px 18px 14px',
          borderBottom: `1px solid ${shadow ? C.border : 'transparent'}`,
          boxShadow: shadow ? '0 6px 18px rgba(0,0,0,0.35)' : 'none',
          background: `linear-gradient(180deg, ${C.panel} 0%, ${C.panel} 70%, rgba(12,12,20,0.95) 100%)`,
          transition: 'border-color .18s, box-shadow .18s',
          zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'linear-gradient(135deg, rgba(165, 180, 252, 0.18), rgba(124, 92, 255, 0.08))',
              border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {tab === 'terms'
                ? <FileText size={17} color={C.purple} />
                : <Shield   size={17} color={C.purple} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id="kairo-terms-title" style={{
                margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.3,
                color: C.text,
              }}>
                {tab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
              </h2>
              <div style={{
                marginTop: 3, fontSize: 11, color: C.textFaint, letterSpacing: 0.2,
              }}>
                Kyno · Effective {EFFECTIVE_DATE}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.textDim, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, color .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(165, 180, 252, 0.08)'
                e.currentTarget.style.color = C.purpleSoft
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = C.textDim
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{
            display: 'flex', gap: 4, marginTop: 14,
            padding: 4, borderRadius: 11,
            background: 'rgba(6,6,10,0.6)',
            border: `1px solid ${C.borderSoft}`,
          }}>
            <TabBtn active={tab === 'terms'}   onClick={() => setTab('terms')}>
              Terms
            </TabBtn>
            <TabBtn active={tab === 'privacy'} onClick={() => setTab('privacy')}>
              Privacy
            </TabBtn>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{
            flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            padding: '20px 22px 28px',
            color: C.textDim, fontSize: 13.5, lineHeight: 1.65,
          }}
        >
          {tab === 'terms' ? <TermsBody /> : <PrivacyBody />}

          <div style={{
            marginTop: 28, padding: '14px 16px', borderRadius: 12,
            background: 'rgba(165, 180, 252, 0.05)',
            border: `1px solid ${C.borderSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 12, color: C.textFaint }}>
              Questions? Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.purpleSoft, textDecoration: 'none' }}>
                {CONTACT_EMAIL}
              </a>
              {' '}· Call{' '}
              <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} style={{ color: C.purpleSoft, textDecoration: 'none' }}>
                {CONTACT_PHONE}
              </a>
            </div>
            <button
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              style={{
                ...linkBtn, display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11,
              }}
            >
              Back to top
              <ChevronDown size={12} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </div>

        <div style={{
          flexShrink: 0,
          padding: '14px 18px',
          borderTop: `1px solid ${C.border}`,
          background: 'rgba(6,6,10,0.4)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '11px 22px', borderRadius: 11, border: 'none',
              background: 'linear-gradient(135deg, #7C5CFF, #4A2FA8)',
              color: '#fff', fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 22px rgba(124, 92, 255, 0.03)',
            }}
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TabBtn({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
        background: active ? 'rgba(165, 180, 252, 0.12)' : 'transparent',
        color: active ? C.purpleSoft : C.textFaint,
        fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer',
        transition: 'background .15s, color .15s',
      }}
    >
      {children}
    </button>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      margin: '22px 0 8px', fontSize: 14, fontWeight: 800,
      color: C.text, letterSpacing: -0.1,
    }}>{children}</h3>
  )
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 10px', color: C.textDim }}>{children}</p>
}
function L({ children }: { children: React.ReactNode }) {
  return (
    <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: C.textDim }}>
      {children}
    </ul>
  )
}
function Em({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: C.text, fontWeight: 700 }}>{children}</strong>
}

function TermsBody() {
  return (
    <>
      <div style={lead}>
        Welcome to Kyno — your AI academic twin. These Terms govern your
        use of Kyno's apps, websites, and services (collectively, the{' '}
        <Em>"Service"</Em>). By creating an account or using the Service you
        agree to these Terms. If you don't agree, please don't use Kyno.
      </div>

      <H>1. Who can use Kyno</H>
      <P>
        Kyno is built for students, teachers, parents, and school
        administrators. You may use the Service if:
      </P>
      <L>
        <li>You are <Em>13 years or older</Em>, or</li>
        <li>You are <Em>under 13</Em> and a parent, legal guardian, or
            authorized school administrator has created the account on your
            behalf and supervises your use, or</li>
        <li>You are a teacher or admin acting within the scope of a school
            account, with proper authority from that school.</li>
      </L>

      <H>2. Your account</H>
      <P>
        You are responsible for everything that happens under your account.
        Keep your password and 6-digit device passcode private. If you
        believe your account has been accessed without permission, change
        your password immediately and email us. We may suspend accounts
        that show signs of compromise.
      </P>

      <H>3. What Kyno is (and isn't)</H>
      <P>
        Kyno is an AI-powered learning companion. It generates explanations,
        flashcards, study plans, predictions, and other content based on
        your inputs. The Service is offered to support your learning — it is{' '}
        <Em>not a replacement</Em> for a qualified teacher, doctor, lawyer,
        or other professional, and is not a guarantee of any specific exam
        result or grade.
      </P>

      <H>4. AI-generated content — important</H>
      <P>
        AI can be wrong. Outputs from Kyno Solver, Kyno, Voice Tutor,
        flashcards, predictions, and other AI features may contain errors,
        omissions, or outdated information. Always verify important answers
        — especially those used in graded coursework, board examinations,
        or any high-stakes setting — against your textbook, teacher, or
        other authoritative source. Don't paste passwords, financial data,
        or other sensitive secrets into any AI prompt.
      </P>

      <H>5. Your data &amp; the Kyno Twin</H>
      <P>
        Most of your Kyno data — your study history, flashcards, formulas,
        notes, and the personalised "Twin" memory — lives directly on your
        device. We treat the cloud as a transit lane: when you sync across
        devices, your snapshot is uploaded, restored on the new device, and
        then promptly deleted from our servers. See our Privacy Policy for
        the full picture.
      </P>

      <H>6. Acceptable use</H>
      <P>You agree not to:</P>
      <L>
        <li>Use Kyno to cheat on proctored or formally graded work,
            including exams that explicitly forbid AI assistance.</li>
        <li>Submit Kyno-generated work as entirely your own in violation
            of your school's academic-integrity policy.</li>
        <li>Harass, threaten, or impersonate others — including teachers,
            classmates, or Kyno staff.</li>
        <li>Try to reverse-engineer, scrape, or systematically extract the
            Service or its AI models.</li>
        <li>Use the Service to generate illegal content, hate speech,
            sexual content involving minors, or anything intended to cause
            real-world harm.</li>
        <li>Run bots, automation, or rate-bypass tools against the API.</li>
        <li>Resell, sublicense, or redistribute the Service without our
            written permission.</li>
      </L>

      <H>7. School accounts</H>
      <P>
        If you create a school on Kyno, you warrant that you have authority
        from the school to bind it to these Terms. The admin who created the
        school is responsible for inviting teachers and students, managing
        join codes, and complying with the school's own acceptable-use,
        privacy, and data-protection policies. Teachers and students who
        join via a school code are also bound by these Terms in addition to
        their school's policies.
      </P>

      <H>8. Content you submit</H>
      <P>
        You keep ownership of the content you submit to Kyno — notes,
        questions, images, voice recordings, study materials. You grant
        Kyno a limited, worldwide, royalty-free licence to process,
        display, and store that content solely for the purpose of
        delivering the Service to you (for example: indexing it for your
        Twin, passing it to AI models to generate replies). We do not sell
        your content.
      </P>

      <H>9. Intellectual property</H>
      <P>
        The Kyno name, logo, app, model scaffolds, prompts, designs, and
        original written content are owned by Kyno or its licensors. You
        may not copy, modify, distribute, or create derivative works of
        these without our written permission. Open-source components are
        licensed under their respective open-source licences.
      </P>

      <H>10. Paid features &amp; billing</H>
      <P>
        Kyno is <Em>free during early access</Em>. We may introduce paid
        plans in future for advanced features or for schools. If we do, we
        will give you clear notice in advance and a separate set of billing
        terms will apply. We will never charge you without explicit consent
        through a payment screen.
      </P>

      <H>11. Suspension &amp; termination</H>
      <P>
        You may delete your Kyno account at any time from{' '}
        <Em>Settings → Security</Em>. We may suspend or terminate accounts
        that violate these Terms, that pose a security risk, or that we are
        required to remove by law. On termination, your local data on the
        device is preserved (it's yours); server-side data is wiped within
        30 days, unless retention is required to comply with the law.
      </P>

      <H>12. Disclaimers</H>
      <P>
        The Service is provided <Em>"as is"</Em> and <Em>"as available"</Em>.
        We make no warranties about accuracy, fitness for a particular
        purpose, or uninterrupted availability. Kyno is not responsible
        for academic outcomes, exam scores, or decisions you make based on
        AI-generated content.
      </P>

      <H>13. Limitation of liability</H>
      <P>
        To the maximum extent allowed by law, Kyno, its founders, and its
        contributors are <Em>not liable</Em> for indirect, incidental,
        consequential, or punitive damages, including loss of grades,
        scholarships, or opportunities. Our total liability for any claim
        arising from the Service is capped at <Em>₹1,000</Em> or the
        amount you paid us in the 12 months before the claim, whichever
        is higher.
      </P>

      <H>14. Changes to these Terms</H>
      <P>
        We may update these Terms from time to time. Material changes will
        be announced inside the app at least <Em>14 days</Em> before they
        take effect. Continued use after the change means you accept the
        new Terms.
      </P>

      <H>15. Governing law</H>
      <P>
        These Terms are governed by the laws of <Em>India</Em>. Any dispute
        will be decided exclusively by the courts at Chennai, Tamil Nadu,
        India.
      </P>

      <H>16. Contact</H>
      <P>
        Questions, concerns, or legal notices: write to Kairo Industries at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.purpleSoft, textDecoration: 'none' }}>
          {CONTACT_EMAIL}
        </a>{' '}or call{' '}
        <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} style={{ color: C.purpleSoft, textDecoration: 'none' }}>
          {CONTACT_PHONE}
        </a>.
      </P>
    </>
  )
}

function PrivacyBody() {
  return (
    <>
      <div style={lead}>
        Your privacy is core to Kyno's design. This policy describes
        what we collect, where it lives, and the choices you have. We try
        hard to keep most of your data on your device — Kyno is a learning
        twin, not a surveillance product.
      </div>

      <H>1. What we collect</H>
      <L>
        <li><Em>Account info</Em> — name, email, role (student / teacher /
            parent / admin), optional avatar, optional class &amp; board,
            and the school you belong to.</li>
        <li><Em>Learning activity</Em> — topics you study, flashcards you
            create, formulas saved, notes, quiz scores, focus sessions.
            Most of this lives on <Em>your device</Em>.</li>
        <li><Em>AI prompts &amp; responses</Em> — what you ask Kyno's AI
            features and what they say back.</li>
        <li><Em>Technical metadata</Em> — browser type, OS, IP address (for
            anti-abuse), session timestamps.</li>
      </L>

      <H>2. Where your data lives — the Kyno Twin</H>
      <P>
        Kyno's memory engine — your "Twin" — is stored primarily in your
        browser's <Em>local storage</Em>. When you sync across devices we
        encrypt and upload a snapshot, restore it on the new device, and{' '}
        <Em>delete the cloud copy</Em> shortly after. The server holds your
        snapshot only during transit.
      </P>

      <H>3. AI processing</H>
      <P>
        When you use AI features, your prompt (plus relevant context from
        your Twin) is sent to AI model providers — currently OpenRouter
        and Groq — to generate a response. We instruct these providers
        not to train their models on your data. Don't paste passwords,
        financial account numbers, or other secrets into prompts.
      </P>

      <H>4. Passcode &amp; email OTP</H>
      <P>
        Your Kyno device passcode is hashed with SHA-256 and stored
        locally — Kyno never sees the plain digits. When you reset your
        passcode, we send a 6-digit one-time code to your email via our
        transactional email transport. The code is hashed in memory on the
        server, expires after 10 minutes, and is destroyed on first
        successful verification.
      </P>

      <H>5. Cookies &amp; local storage</H>
      <P>
        Kyno uses local storage to keep you signed in and to hold your
        Twin. We do not use third-party advertising cookies or cross-site
        trackers.
      </P>

      <H>6. Who we share data with</H>
      <P>
        We <Em>do not sell</Em> your data. We share data only with
        infrastructure providers necessary to deliver the Service:
      </P>
      <L>
        <li><Em>Supabase</Em> — authentication and primary database</li>
        <li><Em>Vercel</Em> — hosting</li>
        <li><Em>OpenRouter / Groq</Em> — AI inference</li>
        <li><Em>Gmail SMTP (transactional)</Em> — email delivery (OTP,
            password resets)</li>
      </L>
      <P>
        Each of these is bound by their own privacy commitments. We may
        also disclose data if required by law or to protect users from
        serious harm.
      </P>

      <H>7. Children's privacy</H>
      <P>
        Kyno can be used by students under 13 <Em>only</Em> when an
        account is created and supervised by a parent, legal guardian, or
        authorised school administrator acting in loco parentis. If you
        believe a child has signed up without proper consent, email us and
        we will remove the account.
      </P>

      <H>8. Your rights</H>
      <P>
        You can view, export, or delete your Kyno data at any time:
      </P>
      <L>
        <li><Em>View &amp; export</Em> — Settings → Data → Export Twin</li>
        <li><Em>Reset device passcode</Em> — Settings → Security → Reset
            Passcode</li>
        <li><Em>Delete account</Em> — Settings → Account → Delete Account.
            Server data is wiped within 30 days.</li>
      </L>

      <H>9. Security</H>
      <P>
        Passwords are managed by Supabase Auth (bcrypt-style hashing).
        Sessions use JWTs over HTTPS. The passcode you set is hashed
        client-side with SHA-256 before it ever leaves your device. We
        follow industry-standard practices, but no system is 100% secure —
        please tell us immediately if you spot a vulnerability.
      </P>

      <H>10. Retention</H>
      <P>
        Account-level data is kept while your account is active. Twin
        snapshots in the cloud are auto-deleted after the next device pulls
        them. Logs and anti-abuse metadata are retained up to 90 days.
        After account deletion, residual backups are purged within 30 days.
      </P>

      <H>11. International users</H>
      <P>
        Kyno is built primarily for users in India, but the Service may be
        used from anywhere with internet access. By using Kyno you
        consent to your data being processed in India and in the regions
        where our infrastructure providers operate.
      </P>

      <H>12. Changes to this policy</H>
      <P>
        We may update this Privacy Policy from time to time. Material
        changes will be announced in-app at least 14 days before they take
        effect.
      </P>

      <H>13. Contact</H>
      <P>
        For privacy questions, data-access requests, or to report a
        concern, email Kairo Industries at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.purpleSoft, textDecoration: 'none' }}>
          {CONTACT_EMAIL}
        </a>{' '}or call{' '}
        <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} style={{ color: C.purpleSoft, textDecoration: 'none' }}>
          {CONTACT_PHONE}
        </a>.
      </P>
    </>
  )
}

const lead: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 12,
  background: 'rgba(165, 180, 252, 0.06)',
  border: `1px solid ${C.borderSoft}`,
  color: C.purpleLite,
  fontSize: 13, lineHeight: 1.65,
  marginBottom: 10,
}

const linkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', padding: 0,
  fontFamily: FONT, fontSize: 11, fontWeight: 700,
  color: C.purpleSoft, cursor: 'pointer',
  textDecoration: 'underline', textUnderlineOffset: 2,
  textDecorationColor: 'rgba(165, 180, 252, 0.4)',
}
