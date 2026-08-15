import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Mail } from 'lucide-react'

const C = {
  ink:         '#0A0D16',
  paper:       '#0A0D16',
  panel:       '#101018',
  panel2:      '#1C2233',
  line:        'rgba(255,255,255,0.06)',
  lineHi:      'rgba(255,255,255,0.10)',
  white:       '#ffffff',
  text:        '#ffffff',
  textDim:     '#CBD5E1',
  textFaint:   '#9CA3AF',
  textVery:    '#6B7280',
  purpleLite:  '#DBE7FF',
  purpleSoft:  '#A5B4FC',
  purple:      '#A5B4FC',
  purpleHi:    '#7C5CFF',
  purpleDeep:  '#4A2FA8',
  purpleInk:   '#0B1530',
}

const DISPLAY = "'Inter Tight', 'Inter', 'Neue Haas Grotesk Display', 'Helvetica Neue', system-ui, sans-serif"
const SERIF   = "'Charter', 'Iowan Old Style', 'Source Serif Pro', Georgia, serif"
const MONO    = "ui-monospace, 'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, monospace"
const SANS    = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"

interface Props {
  onExit: () => void
}

export default function AboutPage({ onExit }: Props) {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    root.style.background = C.ink
    body.style.background = C.ink
    body.style.color = C.text
  }, [])

  return (
    <div style={{
      background: C.ink, color: C.text, fontFamily: SANS,
      width: '100%', minHeight: '100vh', overflowX: 'hidden',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <GrainOverlay />
      <PurpleHalo />

      <header style={{
        position: 'sticky', top: 0, zIndex: 50,

        background: 'rgba(6,6,10,0.72)',
        borderBottom: `1px solid ${C.line}`,
      }}>
        <Container>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 0', gap: 16,
          }}>
            <button className="kyno-ghost" onClick={onExit} style={navBtn}>
              <ArrowLeft size={14} /> Back to Kyno
            </button>
            <span style={{
              fontFamily: MONO, fontSize: 10, color: C.textVery, letterSpacing: 1.8,
            }}>
              ISSUE №01 · COLOPHON · 2026
            </span>
          </div>
        </Container>
      </header>

      <main style={{ position: 'relative', zIndex: 2 }}>
        <Container>

          <section style={{ paddingTop: 80, paddingBottom: 64 }}>
            <SwissRow>
              <SwissCell span={3}>
                <Eyebrow num="00" label="The Founder" />
                <div style={{
                  fontFamily: MONO, fontSize: 10, color: C.textVery,
                  letterSpacing: 2, marginTop: 14, lineHeight: 1.7,
                }}>
                  CHENNAI · IN
                  <br />
                  CLASS · IX
                  <br />
                  AGE · 14
                </div>
              </SwissCell>
              <SwissCell span={9}>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div style={{
                    fontFamily: MONO, fontSize: 12, color: C.purple,
                    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 26,
                  }}>
                    — Built by a student. For students.
                  </div>
                  <h1 style={{
                    fontFamily: DISPLAY, margin: 0,
                    fontSize: 'clamp(44px, 8vw, 132px)',
                    lineHeight: 0.94, letterSpacing: '-0.04em', fontWeight: 800,
                    color: C.text,
                  }}>
                    DARSHAN.
                  </h1>
                  <h2 style={{
                    fontFamily: DISPLAY, margin: '18px 0 0',
                    fontSize: 'clamp(28px, 4vw, 56px)',
                    lineHeight: 1.02, letterSpacing: '-0.02em', fontWeight: 700,
                    color: C.purpleSoft,
                  }}>
                    Class 9 · Builder of Kyno.
                  </h2>
                </motion.div>
              </SwissCell>
            </SwissRow>
          </section>

          <section style={{ padding: '64px 0' }}>
            <SwissRow>
              <SwissCell span={3}>
                <Eyebrow num="01" label="The Story" />
              </SwissCell>
              <SwissCell span={9}>
                <h3 className="kr-headline" style={{
                  fontFamily: DISPLAY, fontSize: 'clamp(28px, 4vw, 56px)',
                  lineHeight: 1.04, letterSpacing: '-0.02em', fontWeight: 700,
                  margin: '0 0 36px', color: C.text, maxWidth: 880,
                }}>
                  I'm fourteen. I'm in Class&nbsp;9.
                  <br />
                  <span style={{ color: C.purpleSoft }}>I'm building the school I wish I had.</span>
                </h3>

                <div className="kr-essay" style={{
                  fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.78,
                  color: C.textDim, maxWidth: 760,
                }}>
                  <DropCap letter="M" />y name is Darshan. I'm a 9th-grader in
                  Chennai trying to crack 490 out of 500 in my boards. The
                  reason Kyno exists is simple — every student in India is
                  taught the same way, with the same textbook, on the same
                  timetable. None of it knows me. None of it remembers what
                  I forgot in November when the March paper lands on my desk.

                  <p style={{ margin: '18px 0' }}>
                    I started Kyno as a side project — a way to teach myself
                    to ship software while I was studying for school. The first
                    version was a doubt-solver for myself. Then it became a
                    flashcards engine for the chapters I kept failing. Then it
                    became a notebook. Then it became an AI tutor. Then it
                    became an operating system.
                  </p>

                  <p style={{ margin: '0 0 18px' }}>
                    Today Kyno has <em style={{ color: C.text }}>more than 40
                    AI features</em>, a memory engine called the Twin that
                    lives on your device, 3D physics labs for every NCERT
                    chapter, voice tutoring, a parent dashboard, a school
                    operations hub. It is built by one student. In her free
                    time. Between two-hour math lessons and bus rides home.
                  </p>

                  <p style={{ margin: 0 }}>
                    None of this was supposed to be a startup. It was
                    supposed to be a study tool. Then it kept working, and
                    other students started using it, and now we're here.
                  </p>
                </div>
              </SwissCell>
            </SwissRow>
          </section>

          <section style={{
            padding: '64px 0',
            borderTop: `1px solid ${C.lineHi}`,
            borderBottom: `1px solid ${C.lineHi}`,
            background: `linear-gradient(180deg, ${C.paper} 0%, ${C.ink} 100%)`,
          }}>
            <SwissRow>
              <SwissCell span={3}>
                <Eyebrow num="02" label="What's Shipped" />
              </SwissCell>
              <SwissCell span={9}>
                <h3 className="kr-headline" style={{
                  fontFamily: DISPLAY, fontSize: 'clamp(28px, 4vw, 56px)',
                  lineHeight: 1.02, letterSpacing: '-0.02em', fontWeight: 700,
                  margin: '0 0 36px', color: C.text,
                }}>
                  By 14 — what I've built so far.
                </h3>

                <div className="kr-stats-grid" style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18,
                  marginBottom: 40,
                }}>
                  <StatTile big="40+"  label="AI features live" />
                  <StatTile big="27"   label="3D NCERT labs" />
                  <StatTile big="8s"   label="Solver answer time" />
                  <StatTile big="0"    label="Cost per student" />
                </div>

                <ul className="kr-ship-list" style={{
                  listStyle: 'none', padding: 0, margin: 0,
                  display: 'flex', flexDirection: 'column', gap: 14,
                  fontFamily: SANS, fontSize: 15, lineHeight: 1.6, color: C.textDim,
                }}>
                  <ShipItem n="01" head="Kyno"
                    body="An AI operating system for students. Memory engine, voice tutor, study plan, focus mode — all built and deployed in production." />
                  <ShipItem n="02" head="Kyno's Solver"
                    body="Any doubt, eight seconds. Step-by-step explanation with live image + video accompaniment, all pulled in real time." />
                  <ShipItem n="03" head="Kyno Labs"
                    body="3D physics, chemistry, biology simulations. Drag, pinch, change variables — diagrams you can touch." />
                  <ShipItem n="04" head="School Operations Hub"
                    body="Admin + teacher tools for whole schools — attendance, announcements, fee reminders, admission bot." />
                  <ShipItem n="05" head="Parent Dashboard"
                    body="Parents see what their child studied today, their scores, and message teachers — all in one place." />
                  <ShipItem n="06" head="Privacy-First Architecture"
                    body="Most of Kyno lives on your device. The cloud is just a transit lane — data is wiped after sync." />
                </ul>
              </SwissCell>
            </SwissRow>
          </section>

          <section style={{ padding: '80px 0' }}>
            <SwissRow>
              <SwissCell span={3}>
                <Eyebrow num="03" label="Why I'm Here" />
              </SwissCell>
              <SwissCell span={9}>
                <blockquote style={{
                  margin: 0, padding: '22px 0 22px 28px',
                  borderLeft: `3px solid ${C.purple}`,
                  fontFamily: SERIF, fontSize: 'clamp(22px, 2.6vw, 34px)',
                  lineHeight: 1.32, color: C.text, fontStyle: 'italic',
                  maxWidth: 820,
                }}>
                  "Indian students don't lack effort. They lack tools that
                  understand them. Kyno is my attempt to fix that — one
                  feature at a time, until every student has an AI that
                  knows their mind."
                  <div style={{
                    marginTop: 18, fontFamily: MONO, fontSize: 11, color: C.purpleSoft,
                    fontStyle: 'normal', letterSpacing: 1.6,
                  }}>
                    — Darshan · Founder · Kyno
                  </div>
                </blockquote>
              </SwissCell>
            </SwissRow>
          </section>

          <section style={{
            padding: '100px 0 120px',
            borderTop: `1px solid ${C.line}`,
          }}>
            <SwissRow>
              <SwissCell span={12} align="center">
                <div style={{
                  fontFamily: MONO, fontSize: 11, letterSpacing: 3.4, color: C.purpleSoft,
                  textTransform: 'uppercase',
                }}>
                  — END OF COLOPHON · ISSUE №01 ·
                </div>
                <h2 className="kr-mega" style={{
                  fontFamily: DISPLAY, fontWeight: 900,
                  fontSize: 'clamp(56px, 12vw, 200px)',
                  lineHeight: 0.86, letterSpacing: '-0.045em',
                  margin: '24px auto 12px', color: C.text, textAlign: 'center',
                }}>
                  WRITE TO ME.
                </h2>
                <p style={{
                  fontFamily: SERIF, fontSize: 17, color: C.textDim,
                  maxWidth: 540, margin: '14px auto 0', textAlign: 'center', lineHeight: 1.55,
                }}>
                  Want to help build, send feedback, or just say hi?
                  I read every email.
                </p>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href="mailto:kairoindustries.cor@gmail.com"
                    style={{
                      marginTop: 38, display: 'inline-flex', alignItems: 'center', gap: 10,
                      padding: '16px 26px', borderRadius: 12, textDecoration: 'none',
                      background: C.white, color: C.ink,
                      fontFamily: SANS, fontSize: 15, fontWeight: 700,
                      boxShadow: `0 0 32px rgba(165, 180, 252, 0.03)`,
                    }}>
                    <Mail size={15} />
                    kairoindustries.cor@gmail.com
                    <ArrowRight size={15} />
                  </a>
                  <a
                    href="tel:8778004043"
                    style={{
                      marginTop: 38, display: 'inline-flex', alignItems: 'center', gap: 10,
                      padding: '16px 26px', borderRadius: 12, textDecoration: 'none',
                      background: 'transparent', color: C.text,
                      border: `1px solid ${C.line}`,
                      fontFamily: SANS, fontSize: 15, fontWeight: 700,
                    }}>
                    📞 877 800 4043
                  </a>
                </div>
              </SwissCell>
            </SwissRow>
          </section>

        </Container>
      </main>

      <footer style={{
        borderTop: `1px solid ${C.line}`, padding: '24px 0 32px',
      }}>
        <Container>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: MONO, fontSize: 10, color: C.textVery, letterSpacing: 2,
            flexWrap: 'wrap', gap: 16,
          }}>
            <span>© {new Date().getFullYear()}  ·  KYNO  ·  COLOPHON</span>
            <span>CHENNAI · INDIA  /  v.2026.05</span>
          </div>
        </Container>
      </footer>

      <style>{`
        @media (max-width: 1024px) {
          .kr-row    { grid-template-columns: repeat(6, 1fr) !important; }
          .kr-row > *{ grid-column: span 6 !important; }
          .kr-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .kr-headline { font-size: clamp(24px, 7vw, 44px) !important; }
          .kr-mega     { font-size: clamp(48px, 16vw, 120px) !important; }
        }
      `}</style>
    </div>
  )
}

function GrainOverlay() {
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
      opacity: 0.30, mixBlendMode: 'overlay',
      backgroundImage:
        'url("data:image/svg+xml;utf8,<svg viewBox=%270 0 100 100%27 xmlns=%27http://www.w3.org/2000/svg%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 stitchTiles=%27stitch%27/><feColorMatrix values=%270 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.32 0%27/></filter><rect width=%27100%27 height=%27100%27 filter=%27url(%23n)%27/></svg>")',
    }} />
  )
}
function PurpleHalo() {
  return (
    <div aria-hidden style={{
      position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)',
      width: '120vw', height: '80vh', borderRadius: '50%',
      background: `radial-gradient(60% 60% at 50% 30%, rgba(124, 92, 255, 0.18) 0%, rgba(74, 47, 168, 0.05) 35%, transparent 70%)`,
      pointerEvents: 'none', zIndex: 0,
      filter: 'blur(30px)',
    }} />
  )
}

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="kr-container" style={{
      maxWidth: 1320, margin: '0 auto', padding: '0 32px',
      position: 'relative',
    }}>
      {children}
    </div>
  )
}
function SwissRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="kr-row" style={{
      display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24,
    }}>
      {children}
    </div>
  )
}
function SwissCell({ children, span, align = 'left' }: {
  children?: React.ReactNode; span: number; align?: 'left' | 'right' | 'center'
}) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      display: 'flex', flexDirection: 'column',
      alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
    }}>
      {children}
    </div>
  )
}
function Eyebrow({ num, label }: { num: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontFamily: DISPLAY, fontSize: 'clamp(28px, 2.8vw, 40px)',
        lineHeight: 1, fontWeight: 800, color: C.purple, letterSpacing: '-0.02em',
      }}>
        {num}.
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 11, color: C.textFaint, letterSpacing: 2.2,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ width: 44, height: 1, background: C.purple, marginTop: 8 }} />
    </div>
  )
}
function DropCap({ letter }: { letter: string }) {
  return (
    <span style={{
      float: 'left', fontFamily: DISPLAY, fontWeight: 800,
      fontSize: 72, lineHeight: 0.85, padding: '6px 12px 0 0',
      color: C.purpleSoft, letterSpacing: '-0.04em',
    }}>
      {letter}
    </span>
  )
}
function StatTile({ big, label }: { big: string; label: string }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16,
      padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        fontFamily: DISPLAY, fontSize: 36, fontWeight: 800, color: C.text,
        letterSpacing: '-0.04em', lineHeight: 1,
      }}>
        {big}
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 10, color: C.textFaint, letterSpacing: 1.6,
        textTransform: 'uppercase', marginTop: 6,
      }}>
        {label}
      </div>
    </div>
  )
}
function ShipItem({ n, head, body }: { n: string; head: string; body: string }) {
  return (
    <li style={{
      display: 'grid', gridTemplateColumns: '60px 1fr',
      gap: 18, padding: '14px 0',
      borderTop: `1px solid ${C.line}`,
    }}>
      <span style={{
        fontFamily: MONO, fontSize: 13, color: C.purpleSoft, letterSpacing: 1.4,
        fontWeight: 700,
      }}>
        {n}
      </span>
      <div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: C.text,
          letterSpacing: '-0.01em', marginBottom: 4,
        }}>
          {head}
        </div>
        <div style={{ color: C.textDim, fontSize: 14, lineHeight: 1.55 }}>
          {body}
        </div>
      </div>
    </li>
  )
}

const navBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '7px 12px', borderRadius: 9,
  background: 'transparent', border: `1px solid ${C.line}`,
  color: C.textDim, fontFamily: SANS,
  fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
}
