import { useState, useEffect, useCallback, useRef, memo, lazy, Suspense } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import MobileShell from '../components/MobileShell'
import { useIsMobile } from '../hooks/useViewport'
import { restoreDarkTheme } from '../lib/themeRewriter'
import ChatWindow from '../components/ChatWindow'
import KairoSolver from './KairoSolver'
import Ops from './Ops'
import InsightPanel from '../components/InsightPanel'
import Flashcards from './Flashcards'
import StudyPlan from './StudyPlan'
import ExamPlanner from './ExamPlanner'
import Bridge from './Bridge'
import RevisionReels from './RevisionReels'
import StudyRoom from './StudyRoom'
import StreamGuide from './StreamGuide'
import GoalTracker from './GoalTracker'
import MistakeMuseum from './MistakeMuseum'
import Listen from './Listen'
import ExamHall from './ExamHall'
import TopicArchitect from './TopicArchitect'
import KairoHome from './KairoHome'
import KairoChat from './KairoChat'
import DoubtSolving from './DoubtSolving'
import Practice from './Practice'
import Performance from './Performance'
import Plan from './Plan'
import Notes from './Notes'
import Profile from './Profile'
import Progress from './Progress'
import SpaceFrame from '../components/SpaceFrame'
// Straight from the core module, not through the spaces.ts barrel. Re-exporting
// a value that came from a .js sibling gets elided by the TS transform, and the
// import then throws at module-evaluation time -- before React mounts anything,
// so the whole app renders blank with nothing but a console SyntaxError.
import { resolveSpace, resolveRoute, SPACE_VIEW_EVENT, SPACE_VIEW_CHANGED, SPACE_HOME_VIEW } from '../lib/spaces.core'
import { KEEP_MOUNTED, busyPages } from '../lib/keepMounted'
import BlankGuard from '../components/BlankGuard'
import { refreshSocial } from '../lib/social'
import { startReminderClock } from '../lib/reminder'
import { XPToast } from '../components/GameBar'
import ErrorBoundary from '../components/ErrorBoundary'
import EssayGrader from './EssayGrader'
import ExamPredictor from './ExamPredictor'
import TeachBack from './TeachBack'
import CameraLive from './CameraLive'
import QuestionPaper from './QuestionPaper'
import LessonPlan from './LessonPlan'
import ParentMessage from './ParentMessage'
import FeeReminder from './FeeReminder'
import AdmissionBot from './AdmissionBot'
import Attendance from './Attendance'
import Timetable from './Timetable'
import WritingTools from './WritingTools'
import ConceptTools from './ConceptTools'
import FormulaSheet from './FormulaSheet'
import AdaptiveQuiz from './AdaptiveQuiz'
import Pomodoro from './Pomodoro'
import Announcement from './Announcement'
import SchoolHub from './SchoolHub'
import ParentDashboard from './ParentDashboard'
import FocusMode from './FocusMode'
import CameraStudy from './CameraStudy'
import MistakeAnalysis from './MistakeAnalysis'
import RevisionSimulator from './RevisionSimulator'
import Notebook from './Notebook'
import ConceptMap from './ConceptMap'
import BattleMode from './BattleMode'
import KnowledgeGraph from './KnowledgeGraph'
import League from './League'
import TeacherAssistant from './TeacherAssistant'
import ExplainMistake from './ExplainMistake'
// Lazy: KairoLabs drags in three.js + @react-three (~1.3MB). Only load it
// when a lab is actually opened.
const KairoLabs = lazy(() => import('./KairoLabs'))
import KairoOS from './KairoOS'
import { DEFAULT_MODEL } from '../lib/openrouter'
import { logScreenView } from '../lib/usage'

import type { AuthProfile } from './Login'
import { KEYS, getRaw, setRaw } from '../lib/storage'
type Profile = AuthProfile

// Perf: memoize the page components. Every tab switch re-renders Dashboard; without
// memo, all ~40 mounted pages re-run their render on every tap (the "laggy taps"
// cascade). Props passed to these are stable (setActive, useCallback handlers).
const KairoHomeM         = memo(KairoHome)
const KairoChatM         = memo(KairoChat)
const KairoSolverM       = memo(KairoSolver)
const FlashcardsM        = memo(Flashcards)
const MistakeAnalysisM   = memo(MistakeAnalysis)
const RevisionSimulatorM = memo(RevisionSimulator)
const NotebookM          = memo(Notebook)
const ConceptMapM        = memo(ConceptMap)
const BattleModeM        = memo(BattleMode)
const LeagueM            = memo(League)
const KnowledgeGraphM    = memo(KnowledgeGraph)
const KairoOSM           = memo(KairoOS)

const PAGE_TITLES: Record<string, string> = {
  home:             'Home',
  // The old solver id stays registered because Doubt Solving hands "I'm stuck
  // here" to the ONE existing chat by setting it directly. #/doubt from the
  // outside resolves to the space -- see SPACE_ALIASES.
  doubt:            "Kyno's Solver",
  'doubt-solving':  'Doubt Solving',
  'practice':       'Practice',
  'performance':    'Performance',
  'plan':           'Plan',
  'notes':          'Notes',
  'profile':        'Profile',
  'progress':       'Progress',
  ops:              'Ops Dashboard',
  flashcards:       'Flashcards & SRS',
  'study-plan':     'Study Plan',
  'exam-planner':   'Exam Planner',
  'topic-architect':'Topic Architect',
  essay:            'Grader',
  predictor:        'Exam Predictor',
  'question-paper': 'Question Paper',
  'lesson-plan':    'Lesson Plan',
  'parent-message': 'Parent Message',
  'fee-reminder':   'Fee Reminder',
  admission:        'Admission Bot',
  attendance:       'Attendance',
  timetable:        'Timetable',
  writing:          'Writing Tools',
  concept:          'Concept Tools',
  // These three render but were never registered, so #/bridge and friends
  // resolved to nothing and the top bar said "Dashboard". They belong to no
  // space, so the cutover is where they finally get their own route.
  bridge:           'Switched board?',
  stream:           'Which stream?',
  reels:            'Revision Reels',
  formula:          'Formula Sheet',
  quiz:             'Adaptive Quiz',
  pomodoro:         'Pomodoro Timer',
  announcement:     'Announcements',
  school:           'School Hub',
  focus:            'Focus Lock',
  goal:             'My Goal',
  museum:           'Mistake Museum',
  listen:           'Listen',
  'exam-hall':      'Exam Hall',
  camera:           'Camera Study',
  mistakes:         'Mistake Analysis',
  simulator:        'Revision Simulator',
  notebook:         'AI Notebook',
  'concept-map':    'Concept Map',
  battle:           'Battle Mode',
  knowledge:        'Knowledge Graph',
  league:           'League',
  'teacher-ai':     'AI Teacher Assistant',
  'explain-mistake': 'Explain My Mistake',
  'teach-back':     'Teach Back',
  'camera-live':    'Study Mode',
  labs:             'Kyno Labs',
  'kairo-os':       'Kyno',
}

interface DashboardProps {
  profile?: Profile
  onLogout?: () => void
}

/**
 * #/<page-id> ↔ nav state. Only ids the registry knows; junk → null.
 *
 * Since the cutover an old id resolves to the space that absorbed it, so a
 * bookmark to #/flashcards or #/battle still lands somewhere real.
 */
function routeFromHash(role?: string): { space: string; view: string | null } | null {
  // TWO SEGMENTS. Every sub-screen is a real address now: #/notes/formulas,
  // #/progress/battle, #/plan/focus. Before this only space roots were routes,
  // so a deep link did nothing, a refresh lost your place, and browser back
  // jumped out of the space instead of one screen up.
  const m = window.location.hash.match(/^#\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/i)
  const raw = m?.[1]
  if (!raw) return null
  const { space, view } = resolveRoute(raw, role)
  // An explicit second segment wins over whatever the alias suggested.
  return PAGE_TITLES[space] ? { space, view: m?.[2] || view } : null
}

function pageFromHash(role?: string): string | null {
  return routeFromHash(role)?.space ?? null
}

/**
 * Tell a space which of its screens to open.
 *
 * #/formula must land on the formula sheet, not the Notes index -- a redirect
 * that only names the space makes the student go and find the thing again.
 * The space owns its own view state, so the route asks rather than sets, and
 * a space is free to decline (Plan will not open a focus timer that is not
 * running).
 */
function announceView(space: string, view: string | null) {
  if (!view) return
  setTimeout(() => {
    try { window.dispatchEvent(new CustomEvent(SPACE_VIEW_EVENT, { detail: { space, view } })) } catch { /* ssr */ }
  }, 60)
}

export default function Dashboard({ profile, onLogout }: DashboardProps) {
  // Audit task 9 — real URLs without a rewrite. The stay-mounted page
  // architecture is deliberate (remounting wiped Study Room state once), so
  // the router is a thin hash layer over the existing `active` state:
  // #/goal deep-links, back/forward work, refresh restores the screen.
  const [active, setActive] = useState(
    () => pageFromHash(profile?.role) || (profile?.role === 'admin' ? 'school' : 'home'),
  )
  const activeRef = useRef(active)
  activeRef.current = active

  /**
   * The screen a space is showing, so the URL can say so.
   *
   * Reset whenever the space changes: arriving at Notes shows its library, and
   * the address must not still claim the formula sheet.
   */
  const [activeView, setActiveView] = useState<string | null>(() => routeFromHash(profile?.role)?.view ?? null)
  useEffect(() => {
    const onViewChanged = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (!d || d.space !== activeRef.current) return
      setActiveView(d.view ?? null)
    }
    window.addEventListener(SPACE_VIEW_CHANGED, onViewChanged)
    return () => window.removeEventListener(SPACE_VIEW_CHANGED, onViewChanged)
  }, [])

  // state → URL + screen-view log (pushState does not re-fire hashchange,
  // so there is no loop).
  useEffect(() => {
    const want = activeView ? `#/${active}/${activeView}` : `#/${active}`
    if (window.location.hash !== want) {
      try { window.history.pushState(null, '', want) } catch {}
    }
    try { logScreenView(active) } catch {}
  }, [active, activeView])

  // URL → state: browser back/forward and pasted deep links.
  useEffect(() => {
    const onHash = () => {
      const r = routeFromHash(role)
      if (!r) return
      if (r.space !== activeRef.current) setActive(r.space)
      setActiveView(r.view ?? null)
      // back to a space root must return the space to ITS root, not leave the
      // last sub-screen showing under a bare address
      announceView(r.space, r.view || SPACE_HOME_VIEW[r.space] || null)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  // Home and Kyno OS are deliberately two separate screens.
  //
  // They were briefly merged because they showed DIFFERENT numbers for the same
  // things — streak, XP, weak topics — and a student could not tell which was
  // real. That was the actual bug, and it is fixed: both now read the same
  // selectors (selectors.core.js), so they cannot disagree. Two views of one
  // truth is a design choice; two truths was not.
  /**
   * Pages stay mounted and hide with display:none, because remounting once
   * wiped a live Study Room. But nothing ever evicted them, so a student who
   * walked the app left all 27 screens in the DOM at once -- measured at
   * 233,000 characters of root HTML, and still growing. That is a leak, and
   * it makes every later render slower.
   *
   * So: a most-recently-used window instead of a set that only grows. The
   * current page plus the last few stay mounted, which keeps going back
   * instant, and the rest are dropped.
   *
   * A page in the middle of something the student would hate to lose -- a
   * running session, a focus timer, a live battle, the camera -- pins itself
   * with keepPageMounted() and is never evicted while it is busy.
   */
  const [visited, setVisited] = useState<string[]>(
    // seeded from the hash too, so a deep link paints on the FIRST render
    () => [pageFromHash(profile?.role) || (profile?.role === 'admin' ? 'school' : 'home')],
  )
  useEffect(() => {
    setVisited(prev => {
      const busy = busyPages()
      const mru = [active, ...prev.filter(p => p !== active)]
      return mru.filter((p, i) => i < KEEP_MOUNTED || busy.has(p))
    })
  }, [active])
  const mounted = (id: string) => visited.includes(id)
  const [solverUi, setSolverUi] = useState<'chat' | 'classic'>(() => {
    try { return (getRaw(KEYS.solverUi) as 'chat' | 'classic') || 'chat' } catch { return 'chat' }
  })
  const [isDark]                       = useState(true)
  const setIsDark = (_: boolean | ((d: boolean) => boolean)) => {  }
  const [lastQuestion, setLastQuestion] = useState('')
  const [hasContent, setHasContent]   = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [solverActive, setSolverActive] = useState(false)

  // A mock is only worth anything because no help exists. While one is
  // running, the solver and Doubt Solving are unreachable -- not hidden,
  // unreachable -- from the drawer, from Home cards, from deep links, from
  // every setActive() in the app. One navigate() for all of them.
  const role = profile?.role
  const navigate = useCallback((raw: string) => {
    // Old ids resolve to the space that absorbed them, so every button in the
    // app that still says 'flashcards' or 'battle' lands in the right place --
    // and on the right SCREEN inside it, not the space's index.
    const { space, view } = resolveRoute(raw, role)
    const HELP = new Set(['doubt', 'doubt-solving', 'solver-classic', 'camera', 'camera-study'])
    if ((window as any).__kynoExamLock && (HELP.has(space) || HELP.has(raw))) return
    setActive(space)
    setActiveView(view ?? null)
    announceView(space, view)
  }, [role])

  /**
   * A deep link pasted into the address bar, or opened from a bookmark.
   *
   * Read during the FIRST RENDER, not in an effect: the effect that mirrors
   * `active` back into the URL runs first and rewrites #/simulator to
   * #/practice, so by the time an effect looked at the hash the view was
   * already gone and the student landed on the space's index.
   */
  const openOnView = useRef<{ space: string; view: string } | null>(
    (() => { const r = routeFromHash(profile?.role); return r?.view ? { space: r.space, view: r.view } : null })(),
  )
  useEffect(() => {
    const want = openOnView.current
    if (!want) return
    openOnView.current = null
    // a touch longer than a normal navigation: the space is mounting in this
    // same commit and its listener has to exist before the event fires
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent(SPACE_VIEW_EVENT, { detail: want })) } catch { /* ssr */ }
    }, 200)
  }, [])

  useEffect(() => {
    (window as any).__kairoSetActive = navigate
    return () => { delete (window as any).__kairoSetActive }
  }, [navigate])

  // The username is the only identity other students see; fetch it once so
  // every social surface (old Study Room included) has it synchronously.
  useEffect(() => { refreshSocial().catch(() => {  }) }, [])
  // The daily reminder fires while the app is open; a website cannot ping a closed phone.
  useEffect(() => startReminderClock(), [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('kairo-app')
    document.body.style.background = '#0A0D16'
    document.body.style.color      = '#fafafa'
    try {
      setRaw(KEYS.theme, 'dark')
      restoreDarkTheme()
    } catch {  }
    return () => {
      document.documentElement.classList.remove('kairo-app')
    }
  }, [])

  if (profile?.role === 'parent') {
    return <ParentDashboard profile={profile} onLogout={onLogout} />
  }

  function handleNewMessage(q: string) {
    setLastQuestion(q)
    setHasContent(true)
  }

  // Stable so <KairoSolverM> stays memoized (an inline arrow would break memo).
  const handleSolverNavigate = useCallback((target: string) => {
    if (target.startsWith('labs:')) {
      const lab = target.slice('labs:'.length)
      setActive('labs')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('kairo:open-lab', { detail: { id: lab } }))
      }, 100)
    } else {
      setActive(target)
    }
  }, [])

  const isMobile = useIsMobile()

  /**
   * Every page gets its bottom clear of the floating nav.
   *
   * The nav is position:fixed, so it sits over whatever is beneath it — it was
   * covering the Motivation card on Home, the difficulty buttons on Adaptive
   * Quiz, and the note list in AI Notebook. 48 pages own their own scroll
   * container, so padding them individually would mean 48 edits and a 49th
   * page shipping broken. This is the one wrapper they all sit inside.
   *
   * Padding rather than margin: the pages scroll internally, and margin here
   * would leave the scrollbar running under the nav.
   */
  /**
   * A hidden page must be INERT, not merely invisible.
   *
   * display:none hides pixels; it does not stop a hidden screen existing. The
   * Notes page was still exposing "Start 15 minutes" and Doubt its suggestion
   * cards, so a screen reader read the buttons of screens nobody was on, and
   * a stray focus could press them. `inert` removes the subtree from the
   * accessibility tree, from the tab order, and from hit-testing.
   */
  const pageProps = (id: string) => ({
    className: pageClass,
    style: pageStyle(id),
    ...(active === id ? null : { inert: true as any }),
    'aria-hidden': active === id ? undefined : true,
  })

  const pageStyle = (id: string) => ({
    position: 'absolute' as const,
    inset: 0,
    display: active === id ? 'flex' : 'none',
    flexDirection: 'column' as const,
    ...(isMobile ? { paddingBottom: 'var(--kyno-nav-clearance)' } : null),
  })

  /** `.kyno-page` is what the desktop max-width rule in index.css hangs off. */
  const pageClass = 'kyno-page'

  return (
    <div className={isMobile ? 'kairo-mobile' : 'kairo-desktop'} style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      // dvh shrinks when the Android keyboard opens; vh does not, which pushed
      // the chat composer and bottom nav underneath it.
      height: '100dvh',
      overflow: 'hidden',
      background: isDark ? '#0A0D16' : '#f4f4f5',
      color:      isDark ? '#fafafa' : '#18181b',
      fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      transition: 'background 0.25s ease',
    }}>
      {!isMobile && (
        <Sidebar
          active={active}
          setActive={navigate}
          isDark={isDark}
          toggleTheme={() => setIsDark(d => !d)}
          profile={profile}
          onLogout={onLogout}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {isMobile ? (
          <MobileShell
            active={active}
            setActive={navigate}
            pageTitle={PAGE_TITLES[active] || 'Dashboard'}
            isDark={isDark}
            toggleTheme={() => setIsDark(d => !d)}
            profile={profile}
            onLogout={onLogout}
          />
        ) : (
          <TopBar
            title={PAGE_TITLES[active] || 'Dashboard'}
            onModelChange={setSelectedModel}
            profile={profile}
            modelLocked={active === 'doubt' && solverActive}
            modelLockReason="Model locked — this chat's answer was generated with the current model. Start a new question to switch."
          />
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>

            <XPToast />

            {/* resetKey (NOT key): the boundary clears a stale error when the
                page changes, but the pages stay mounted across navigation. A
                `key={active}` here remounted the whole subtree on every tab
                switch, which wiped live state like the Study Room's channel. */}
            <ErrorBoundary resetKey={active}>

            <div {...pageProps('home')}>{mounted('home') && <KairoHomeM onNavigate={setActive} />}</div>

            <div {...pageProps('doubt')}>
              {mounted('doubt') && (
              <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <button className="kyno-ghost"
                  onClick={() => {
                    const next = solverUi === 'chat' ? 'classic' : 'chat'
                    setSolverUi(next)
                    try { setRaw(KEYS.solverUi, next) } catch {}
                  }}
                  style={{
                    position: 'absolute', top: isMobile ? 8 : 10, zIndex: 20,
                    right: isMobile ? 'max(12px, env(safe-area-inset-right))' : 16,
                    padding: isMobile ? '6px 12px' : '6px 14px', borderRadius: 999, cursor: 'pointer',
                    background: 'rgba(13,16,25,0.9)',

                    border: '1px solid rgba(124, 92, 255,0.4)',
                    color: 'var(--c-purple-lite)', fontSize: isMobile ? 10 : 11, fontWeight: 700,
                    letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'inherit',
                    whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 24px)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                  }}
                >
                  {solverUi === 'chat'
                    ? (isMobile ? '◈ Visual' : '◈ Visual mode')
                    : (isMobile ? '💬 Chat' : '💬 Chat mode')}
                </button>

                {solverUi === 'chat' ? (
                  <KairoChatM />
                ) : (
                  <KairoSolverM
                    model={selectedModel}
                    onActiveChange={setSolverActive}
                    onNavigate={handleSolverNavigate}
                  />
                )}
              </div>
              )}
            </div>

            {/* Seven-spaces redesign, pre-cutover. Each space renders inside
                SpaceFrame: phone edge-to-edge, tablet a centred 480px column,
                desktop a 240px sidebar of the finished spaces. NEW SCREENS
                ONLY -- nothing above or below this block is wrapped. */}
            <div {...pageProps('doubt-solving')}>
              {mounted('doubt-solving') && (
                <BlankGuard id="doubt-solving" active={active === 'doubt-solving'}>
                <SpaceFrame active="doubt-solving" onNavigate={navigate} visible={active === 'doubt-solving'}>
                <DoubtSolving
                  profile={profile}
                  onOpenChat={(seed: string) => {
                    // Reuse the ONE existing chat instead of mounting a second
                    // KairoChat: both instances would listen for
                    // kairo:load-chat and both would write the chat id.
                    setActive('doubt')
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('kairo:load-chat', {
                        detail: { id: 'new', seed },
                      }))
                    }, 60)
                  }}
                />
                </SpaceFrame>
                </BlankGuard>
              )}
            </div>

            <div {...pageProps('practice')}>
              {mounted('practice') && (
                <BlankGuard id="practice" active={active === 'practice'}>
                <SpaceFrame active="practice" onNavigate={navigate} visible={active === 'practice'}>
                <Practice onOpenDoubt={(seed: string) => {
                  navigate('doubt-solving')
                  setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:doubt-seed', { detail: { seed } })), 60)
                }} />
                </SpaceFrame>
                </BlankGuard>
              )}
            </div>

            <div {...pageProps('performance')}>
              {mounted('performance') && (
                <BlankGuard id="performance" active={active === 'performance'}>
                <SpaceFrame active="performance" onNavigate={navigate} visible={active === 'performance'}>
                <Performance
                  onOpenDoubt={(seed: string) => {
                    navigate('doubt-solving')
                    setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:doubt-seed', { detail: { seed } })), 60)
                  }}
                  onDrill={(filter) => {
                    // Practice listens and builds the session around these
                    // signatures/topics instead of its default target.
                    navigate('practice')
                    setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:practice-filter', { detail: filter })), 60)
                  }}
                />
                </SpaceFrame>
                </BlankGuard>
              )}
            </div>

            <div {...pageProps('plan')}>
              {mounted('plan') && (
                <BlankGuard id="plan" active={active === 'plan'}>
                <SpaceFrame active="plan" onNavigate={navigate} visible={active === 'plan'}>
                <Plan
                  onOpenDoubt={(seed: string) => {
                    navigate('doubt-solving')
                    setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:doubt-seed', { detail: { seed } })), 60)
                  }}
                  onPractice={(filter) => {
                    navigate('practice')
                    setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:practice-filter', { detail: filter })), 60)
                  }}
                />
                </SpaceFrame>
                </BlankGuard>
              )}
            </div>

            <div {...pageProps('notes')}>
              {mounted('notes') && (
                <BlankGuard id="notes" active={active === 'notes'}>
                <SpaceFrame active="notes" onNavigate={navigate} visible={active === 'notes'}>
                <Notes
                  onOpenDoubt={(seed: string) => {
                    navigate('doubt-solving')
                    setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:doubt-seed', { detail: { seed } })), 60)
                  }}
                  onPractice={(filter) => {
                    navigate('practice')
                    setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:practice-filter', { detail: filter })), 60)
                  }}
                />
                </SpaceFrame>
                </BlankGuard>
              )}
            </div>

            <div {...pageProps('progress')}>
              {mounted('progress') && (
                <BlankGuard id="progress" active={active === 'progress'}>
                <SpaceFrame active="progress" onNavigate={navigate} visible={active === 'progress'}>
                  <Progress
                    onPractice={(filter) => {
                      navigate('practice')
                      setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:practice-filter', { detail: filter })), 60)
                    }}
                    onOpenProfile={() => navigate('profile')}
                  />
                </SpaceFrame>
                </BlankGuard>
              )}
            </div>

            <div {...pageProps('profile')}>
              {mounted('profile') && (
                <BlankGuard id="profile" active={active === 'profile'}>
                <SpaceFrame active="profile" onNavigate={navigate} visible={active === 'profile'}>
                  <Profile onLogout={onLogout} />
                </SpaceFrame>
                </BlankGuard>
              )}
            </div>


            <div {...pageProps('flashcards')}>{mounted('flashcards') && <FlashcardsM />}</div>

            <div {...pageProps('study-plan')}>{mounted('study-plan') && <StudyPlan />}</div>

            <div {...pageProps('exam-planner')}>{mounted('exam-planner') && <ExamPlanner />}</div>

            <div {...pageProps('bridge')}>{mounted('bridge') && <Bridge />}</div>

            <div {...pageProps('reels')}>{mounted('reels') && <RevisionReels />}</div>

            <div {...pageProps('rooms')}>{mounted('rooms') && <StudyRoom />}</div>

            <div {...pageProps('stream')}>{mounted('stream') && <StreamGuide />}</div>

            <div {...pageProps('goal')}>{mounted('goal') && <GoalTracker />}</div>

            <div {...pageProps('museum')}>{mounted('museum') && <MistakeMuseum />}</div>

            <div {...pageProps('listen')}>{mounted('listen') && <Listen />}</div>

            <div {...pageProps('exam-hall')}>{mounted('exam-hall') && <ExamHall />}</div>

            <div {...pageProps('topic-architect')}>{mounted('topic-architect') && <TopicArchitect />}</div>

            <div {...pageProps('essay')}>{mounted('essay') && <EssayGrader />}</div>

            <div {...pageProps('predictor')}>{mounted('predictor') && <ExamPredictor />}</div>

            <div {...pageProps('question-paper')}>{mounted('question-paper') && <QuestionPaper />}</div>

            <div {...pageProps('lesson-plan')}>{mounted('lesson-plan') && <LessonPlan />}</div>

            <div {...pageProps('parent-message')}>{mounted('parent-message') && <ParentMessage />}</div>


            <div {...pageProps('fee-reminder')}>{mounted('fee-reminder') && <FeeReminder />}</div>

            <div {...pageProps('admission')}>{mounted('admission') && <AdmissionBot />}</div>

            <div {...pageProps('attendance')}>{mounted('attendance') && <Attendance />}</div>

            <div {...pageProps('timetable')}>{mounted('timetable') && <Timetable />}</div>

            <div {...pageProps('writing')}>{mounted('writing') && <WritingTools />}</div>

            <div {...pageProps('concept')}>{mounted('concept') && <ConceptTools />}</div>

            <div {...pageProps('formula')}>{mounted('formula') && <FormulaSheet />}</div>

            <div {...pageProps('quiz')}>{mounted('quiz') && <AdaptiveQuiz />}</div>

            <div {...pageProps('pomodoro')}>{mounted('pomodoro') && <Pomodoro />}</div>

            <div {...pageProps('announcement')}>{mounted('announcement') && <Announcement />}</div>

            <div {...pageProps('school')}>{mounted('school') && profile && <SchoolHub profile={profile} />}</div>

            <div {...pageProps('focus')}>{mounted('focus') && <FocusMode />}</div>

            <div {...pageProps('camera')}>{mounted('camera') && <CameraStudy />}</div>

            <div {...pageProps('mistakes')}>{mounted('mistakes') && <MistakeAnalysisM />}</div>

            <div {...pageProps('simulator')}>{mounted('simulator') && <RevisionSimulatorM />}</div>

            <div {...pageProps('notebook')}>{mounted('notebook') && <NotebookM />}</div>

            <div {...pageProps('concept-map')}>{mounted('concept-map') && <ConceptMapM />}</div>

            <div {...pageProps('battle')}>{mounted('battle') && <BattleModeM />}</div>

            <div {...pageProps('league')}>{mounted('league') && <LeagueM />}</div>

            <div {...pageProps('knowledge')}>{mounted('knowledge') && <KnowledgeGraphM />}</div>

            <div {...pageProps('ops')}>{mounted('ops') && <Ops />}</div>

            <div {...pageProps('teacher-ai')}>{mounted('teacher-ai') && <TeacherAssistant />}</div>

            <div {...pageProps('explain-mistake')}>{mounted('explain-mistake') && <ExplainMistake />}</div>

            <div {...pageProps('teach-back')}>{mounted('teach-back') && <TeachBack />}</div>

            {/* Rendered ONLY while active — unmounting is what releases the camera + torch. */}
            {active === 'camera-live' && <CameraLive onExit={() => setActive('kairo-os')} />}

            <div {...pageProps('labs')}>{mounted('labs') && (
              <Suspense fallback={<div style={{ padding: 28, color: '#9CA3AF', fontSize: 13 }}>Loading labs…</div>}>
                <KairoLabs active={active === 'labs'} />
              </Suspense>
            )}</div>

            <div {...pageProps('kairo-os')}>{mounted('kairo-os') && <KairoOSM />}</div>

            </ErrorBoundary>

          </div>

          {false && active === 'doubt' && !isMobile && (
            <InsightPanel hasContent={hasContent} lastQuestion={lastQuestion} />
          )}
        </div>
      </div>
    </div>
  )
}
