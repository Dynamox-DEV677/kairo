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
import { XPToast } from '../components/GameBar'
import ErrorBoundary from '../components/ErrorBoundary'
import EssayGrader from './EssayGrader'
import ExamPredictor from './ExamPredictor'
import TeachBack from './TeachBack'
import CameraLive from './CameraLive'
import QuestionPaper from './QuestionPaper'
import LessonPlan from './LessonPlan'
import ParentMessage from './ParentMessage'
import Settings from './Settings'
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
  doubt:            "Kyno's Solver",
  // Seven-spaces redesign, pre-cutover. Lives BESIDE the old routes, reachable
  // only by typing #/doubt-solving -- the drawer still points everything at the
  // old screens on purpose. The cutover commit renames this to 'doubt' and adds
  // the redirects; until then nothing a student can click reaches it.
  'doubt-solving':  'Doubt Solving',
  'practice':       'Practice',
  'performance':    'Performance',
  'plan':           'Plan',
  'notes':          'Notes',
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
  settings:         'Settings',
}

interface DashboardProps {
  profile?: Profile
  onLogout?: () => void
}

/** #/<page-id> ↔ nav state. Only ids the registry knows; junk → null. */
function pageFromHash(): string | null {
  const m = window.location.hash.match(/^#\/([a-z0-9-]+)$/i)
  const id = m?.[1]
  return id && PAGE_TITLES[id] ? id : null
}

export default function Dashboard({ profile, onLogout }: DashboardProps) {
  // Audit task 9 — real URLs without a rewrite. The stay-mounted page
  // architecture is deliberate (remounting wiped Study Room state once), so
  // the router is a thin hash layer over the existing `active` state:
  // #/goal deep-links, back/forward work, refresh restores the screen.
  const [active, setActive] = useState(
    () => pageFromHash() || (profile?.role === 'admin' ? 'school' : 'home'),
  )
  const activeRef = useRef(active)
  activeRef.current = active

  // state → URL + screen-view log (pushState does not re-fire hashchange,
  // so there is no loop).
  useEffect(() => {
    const want = `#/${active}`
    if (window.location.hash !== want) {
      try { window.history.pushState(null, '', want) } catch {}
    }
    try { logScreenView(active) } catch {}
  }, [active])

  // URL → state: browser back/forward and pasted deep links.
  useEffect(() => {
    const onHash = () => {
      const id = pageFromHash()
      if (id && id !== activeRef.current) setActive(id)
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
  const [visited, setVisited] = useState<Set<string>>(
    // seeded from the hash too, so a deep link paints on the FIRST render
    () => new Set([pageFromHash() || (profile?.role === 'admin' ? 'school' : 'home')]),
  )
  useEffect(() => {
    setVisited(prev => (prev.has(active) ? prev : new Set(prev).add(active)))
  }, [active])
  const mounted = (id: string) => visited.has(id)
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
  const navigate = useCallback((id: string) => {
    const HELP = new Set(['doubt', 'doubt-solving', 'solver-classic', 'camera', 'camera-study'])
    if ((window as any).__kynoExamLock && HELP.has(id)) return
    setActive(id)
  }, [])

  useEffect(() => {
    (window as any).__kairoSetActive = navigate
    return () => { delete (window as any).__kairoSetActive }
  }, [navigate])

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

            <div className={pageClass} style={pageStyle('home')}>{mounted('home') && <KairoHomeM onNavigate={setActive} />}</div>

            <div className={pageClass} style={pageStyle('doubt')}>
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

            <div className={pageClass} style={pageStyle('doubt-solving')}>
              {mounted('doubt-solving') && (
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
              )}
            </div>

            <div className={pageClass} style={pageStyle('practice')}>
              {mounted('practice') && (
                <Practice onOpenDoubt={(seed: string) => {
                  navigate('doubt-solving')
                  setTimeout(() => window.dispatchEvent(new CustomEvent('kyno:doubt-seed', { detail: { seed } })), 60)
                }} />
              )}
            </div>

            <div className={pageClass} style={pageStyle('performance')}>
              {mounted('performance') && (
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
              )}
            </div>

            <div className={pageClass} style={pageStyle('plan')}>
              {mounted('plan') && (
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
              )}
            </div>

            <div className={pageClass} style={pageStyle('notes')}>
              {mounted('notes') && (
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
              )}
            </div>

            <div className={pageClass} style={pageStyle('flashcards')}>{mounted('flashcards') && <FlashcardsM />}</div>

            <div className={pageClass} style={pageStyle('study-plan')}>{mounted('study-plan') && <StudyPlan />}</div>

            <div className={pageClass} style={pageStyle('exam-planner')}>{mounted('exam-planner') && <ExamPlanner />}</div>

            <div className={pageClass} style={pageStyle('bridge')}>{mounted('bridge') && <Bridge />}</div>

            <div className={pageClass} style={pageStyle('reels')}>{mounted('reels') && <RevisionReels />}</div>

            <div className={pageClass} style={pageStyle('rooms')}>{mounted('rooms') && <StudyRoom />}</div>

            <div className={pageClass} style={pageStyle('stream')}>{mounted('stream') && <StreamGuide />}</div>

            <div className={pageClass} style={pageStyle('goal')}>{mounted('goal') && <GoalTracker />}</div>

            <div className={pageClass} style={pageStyle('museum')}>{mounted('museum') && <MistakeMuseum />}</div>

            <div className={pageClass} style={pageStyle('listen')}>{mounted('listen') && <Listen />}</div>

            <div className={pageClass} style={pageStyle('exam-hall')}>{mounted('exam-hall') && <ExamHall />}</div>

            <div className={pageClass} style={pageStyle('topic-architect')}>{mounted('topic-architect') && <TopicArchitect />}</div>

            <div className={pageClass} style={pageStyle('essay')}>{mounted('essay') && <EssayGrader />}</div>

            <div className={pageClass} style={pageStyle('predictor')}>{mounted('predictor') && <ExamPredictor />}</div>

            <div className={pageClass} style={pageStyle('question-paper')}>{mounted('question-paper') && <QuestionPaper />}</div>

            <div className={pageClass} style={pageStyle('lesson-plan')}>{mounted('lesson-plan') && <LessonPlan />}</div>

            <div className={pageClass} style={pageStyle('parent-message')}>{mounted('parent-message') && <ParentMessage />}</div>

            <div className={pageClass} style={pageStyle('settings')}>{mounted('settings') && <Settings />}</div>

            <div className={pageClass} style={pageStyle('fee-reminder')}>{mounted('fee-reminder') && <FeeReminder />}</div>

            <div className={pageClass} style={pageStyle('admission')}>{mounted('admission') && <AdmissionBot />}</div>

            <div className={pageClass} style={pageStyle('attendance')}>{mounted('attendance') && <Attendance />}</div>

            <div className={pageClass} style={pageStyle('timetable')}>{mounted('timetable') && <Timetable />}</div>

            <div className={pageClass} style={pageStyle('writing')}>{mounted('writing') && <WritingTools />}</div>

            <div className={pageClass} style={pageStyle('concept')}>{mounted('concept') && <ConceptTools />}</div>

            <div className={pageClass} style={pageStyle('formula')}>{mounted('formula') && <FormulaSheet />}</div>

            <div className={pageClass} style={pageStyle('quiz')}>{mounted('quiz') && <AdaptiveQuiz />}</div>

            <div className={pageClass} style={pageStyle('pomodoro')}>{mounted('pomodoro') && <Pomodoro />}</div>

            <div className={pageClass} style={pageStyle('announcement')}>{mounted('announcement') && <Announcement />}</div>

            <div className={pageClass} style={pageStyle('school')}>{mounted('school') && profile && <SchoolHub profile={profile} />}</div>

            <div className={pageClass} style={pageStyle('focus')}>{mounted('focus') && <FocusMode />}</div>

            <div className={pageClass} style={pageStyle('camera')}>{mounted('camera') && <CameraStudy />}</div>

            <div className={pageClass} style={pageStyle('mistakes')}>{mounted('mistakes') && <MistakeAnalysisM />}</div>

            <div className={pageClass} style={pageStyle('simulator')}>{mounted('simulator') && <RevisionSimulatorM />}</div>

            <div className={pageClass} style={pageStyle('notebook')}>{mounted('notebook') && <NotebookM />}</div>

            <div className={pageClass} style={pageStyle('concept-map')}>{mounted('concept-map') && <ConceptMapM />}</div>

            <div className={pageClass} style={pageStyle('battle')}>{mounted('battle') && <BattleModeM />}</div>

            <div className={pageClass} style={pageStyle('league')}>{mounted('league') && <LeagueM />}</div>

            <div className={pageClass} style={pageStyle('knowledge')}>{mounted('knowledge') && <KnowledgeGraphM />}</div>

            <div className={pageClass} style={pageStyle('ops')}>{mounted('ops') && <Ops />}</div>

            <div className={pageClass} style={pageStyle('teacher-ai')}>{mounted('teacher-ai') && <TeacherAssistant />}</div>

            <div className={pageClass} style={pageStyle('explain-mistake')}>{mounted('explain-mistake') && <ExplainMistake />}</div>

            <div className={pageClass} style={pageStyle('teach-back')}>{mounted('teach-back') && <TeachBack />}</div>

            {/* Rendered ONLY while active — unmounting is what releases the camera + torch. */}
            {active === 'camera-live' && <CameraLive onExit={() => setActive('kairo-os')} />}

            <div className={pageClass} style={pageStyle('labs')}>{mounted('labs') && (
              <Suspense fallback={<div style={{ padding: 28, color: '#9CA3AF', fontSize: 13 }}>Loading labs…</div>}>
                <KairoLabs active={active === 'labs'} />
              </Suspense>
            )}</div>

            <div className={pageClass} style={pageStyle('kairo-os')}>{mounted('kairo-os') && <KairoOSM />}</div>

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
