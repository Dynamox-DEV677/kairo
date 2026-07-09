import { useState, useEffect } from 'react'
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
import TopicArchitect from './TopicArchitect'
import KairoHome from './KairoHome'
import KairoChat from './KairoChat'
import { XPToast } from '../components/GameBar'
import EssayGrader from './EssayGrader'
import ExamPredictor from './ExamPredictor'
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
// Analytics + Gamification (My Progress) removed per spec — folded into Kyno
import Pomodoro from './Pomodoro'
import Announcement from './Announcement'
import SchoolHub from './SchoolHub'
import ParentDashboard from './ParentDashboard'
// MemoryBrain removed per spec — folded into Kyno
import FocusMode from './FocusMode'
import CameraStudy from './CameraStudy'
import MistakeAnalysis from './MistakeAnalysis'
import RevisionSimulator from './RevisionSimulator'
import Notebook from './Notebook'
// AdaptivePath removed — deprecated mobile route
import ConceptMap from './ConceptMap'
// VoiceTutor removed per spec — folded into Kyno Solver
import BattleMode from './BattleMode'
import KnowledgeGraph from './KnowledgeGraph'
import TeacherAssistant from './TeacherAssistant'
import ExplainMistake from './ExplainMistake'
import PerformancePredictor from './PerformancePredictor'
// PanicMode removed per spec — exam scheduling now lives in Kyno Solver
import KairoLabs from './KairoLabs'
import KairoOS from './KairoOS'
import { DEFAULT_MODEL } from '../lib/openrouter'

import type { AuthProfile } from './Login'
type Profile = AuthProfile

const PAGE_TITLES: Record<string, string> = {
  home:             'Home',
  doubt:            "Kyno's Solver",
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
  // analytics + gamification removed — folded into Kyno
  pomodoro:         'Pomodoro Timer',
  announcement:     'Announcements',
  school:           'School Hub',
  // memory removed — folded into Kyno
  focus:            'Focus Mode',
  camera:           'Camera Study',
  mistakes:         'Mistake Analysis',
  simulator:        'Revision Simulator',
  notebook:         'AI Notebook',
  adaptive:         'Adaptive Path',
  'concept-map':    'Concept Map',
  // voice removed — folded into Kyno Solver
  battle:           'Battle Mode',
  knowledge:        'Knowledge Graph',
  'teacher-ai':     'AI Teacher Assistant',
  'explain-mistake': 'Explain My Mistake',
  'perf-predictor': 'Performance Predictor',
  // panic removed — exam scheduling folded into Kyno Solver
  labs:             'Kyno Labs',
  'kairo-os':       'Kyno',
  settings:         'Settings',
}

interface DashboardProps {
  profile?: Profile
  onLogout?: () => void
}

export default function Dashboard({ profile, onLogout }: DashboardProps) {
  // Admins land on School Hub (their control center); everyone else on Kyno's Solver
  const [active, setActive]           = useState(profile?.role === 'admin' ? 'school' : 'home')
  // Lazy page mounting: a page renders only after its FIRST visit, then stays
  // mounted (state survives tab switches). Mounting all ~35 pages at boot made
  // every page fetch + animate simultaneously — the whole app felt slow.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([profile?.role === 'admin' ? 'school' : 'home']))
  useEffect(() => {
    setVisited(prev => (prev.has(active) ? prev : new Set(prev).add(active)))
  }, [active])
  const mounted = (id: string) => visited.has(id)
  // Solver surface: companion chat (default) vs the classic visual Solver.
  const [solverUi, setSolverUi] = useState<'chat' | 'classic'>(() => {
    try { return (localStorage.getItem('kairo:solver-ui') as 'chat' | 'classic') || 'chat' } catch { return 'chat' }
  })
  // Light mode is disabled — Kyno is dark-only. Keeping the state shape
  // so the rest of the file's `isDark ? darkColor : lightColor` ternaries
  // still resolve correctly; we just freeze it to true and never flip it.
  const [isDark]                       = useState(true)
  const setIsDark = (_: boolean | ((d: boolean) => boolean)) => { /* noop */ }
  const [lastQuestion, setLastQuestion] = useState('')
  const [hasContent, setHasContent]   = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  // Locked while a Kyno's Solver answer is on screen — context belongs to
  // the model that produced it. Cleared on "new chat" (next ask() call).
  const [solverActive, setSolverActive] = useState(false)

  // Expose setActive to other pages (used by Adaptive Path's "jump to feature" buttons)
  useEffect(() => {
    (window as any).__kairoSetActive = setActive
    return () => { delete (window as any).__kairoSetActive }
  }, [])

  // Force dark mode + wipe any stale "light" preference. The light-mode
  // rewriter is intentionally NOT called.
  // Also opt INTO the body-overflow lock for the dashboard's mobile mode.
  // Landing / Login do NOT add this class, so they get normal body scroll
  // and Framer Motion's useScroll keeps working there.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('kairo-app')
    document.body.style.background = '#050505'
    document.body.style.color      = '#fafafa'
    try {
      localStorage.setItem('kairo_theme', 'dark')
      restoreDarkTheme()
    } catch { /* ignore */ }
    return () => {
      document.documentElement.classList.remove('kairo-app')
    }
  }, [])

  // Parent users get a completely separate portal — no sidebar, no AI tools
  if (profile?.role === 'parent') {
    return <ParentDashboard profile={profile} onLogout={onLogout} />
  }

  function handleNewMessage(q: string) {
    setLastQuestion(q)
    setHasContent(true)
  }

  const pageStyle = (id: string) => ({
    position: 'absolute' as const,
    inset: 0,
    display: active === id ? 'flex' : 'none',
    flexDirection: 'column' as const,
  })

  const isMobile = useIsMobile()

  return (
    <div className={isMobile ? 'kairo-mobile' : 'kairo-desktop'} style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100vh',
      overflow: 'hidden',
      background: isDark ? '#050505' : '#f4f4f5',
      color:      isDark ? '#fafafa' : '#18181b',
      fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      transition: 'background 0.25s ease',
    }}>
      {!isMobile && (
        <Sidebar
          active={active}
          setActive={setActive}
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
            setActive={setActive}
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

            {/* Floating "+XP" toasts — app-wide */}
            <XPToast />

            {/* Home — the AI Student OS command center */}
            <div style={pageStyle('home')}>{mounted('home') && <KairoHome onNavigate={setActive} />}</div>

            {/* Kyno's Solver — companion CHAT by default; classic visual
                Solver one toggle away. Preference persists per device. */}
            <div style={pageStyle('doubt')}>
              {mounted('doubt') && (
              <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {/* Chat ↔ Classic toggle */}
                <button
                  onClick={() => {
                    const next = solverUi === 'chat' ? 'classic' : 'chat'
                    setSolverUi(next)
                    try { localStorage.setItem('kairo:solver-ui', next) } catch {}
                  }}
                  style={{
                    position: 'absolute', top: isMobile ? 8 : 10, right: isMobile ? 10 : 14, zIndex: 20,
                    padding: isMobile ? '5px 11px' : '6px 14px', borderRadius: 999, cursor: 'pointer',
                    background: 'rgba(13,16,25,0.85)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(102,217,255,0.28)',
                    color: '#66D9FF', fontSize: isMobile ? 10 : 11, fontWeight: 700,
                    letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'inherit',
                  }}
                >
                  {solverUi === 'chat'
                    ? (isMobile ? '◈ Visual' : '◈ Visual mode')
                    : (isMobile ? '💬 Chat' : '💬 Chat mode')}
                </button>

                {solverUi === 'chat' ? (
                  <KairoChat />
                ) : (
                  <KairoSolver
                    model={selectedModel}
                    onActiveChange={setSolverActive}
                    onNavigate={(target) => {
                      // "labs:gravity" -> jump to labs page + dispatch event so the
                      // KairoLabs page knows which lab to open.
                      if (target.startsWith('labs:')) {
                        const lab = target.slice('labs:'.length)
                        setActive('labs')
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('kairo:open-lab', { detail: { id: lab } }))
                        }, 100)
                      } else {
                        setActive(target)
                      }
                    }}
                  />
                )}
              </div>
              )}
            </div>

            {/* Flashcards */}
            <div style={pageStyle('flashcards')}>{mounted('flashcards') && <Flashcards />}</div>

            {/* Study Plan */}
            <div style={pageStyle('study-plan')}>{mounted('study-plan') && <StudyPlan />}</div>

            {/* Exam Planner */}
            <div style={pageStyle('exam-planner')}>{mounted('exam-planner') && <ExamPlanner />}</div>

            {/* Topic Architect */}
            <div style={pageStyle('topic-architect')}>{mounted('topic-architect') && <TopicArchitect />}</div>

            {/* Essay Grader */}
            <div style={pageStyle('essay')}>{mounted('essay') && <EssayGrader />}</div>

            {/* Exam Predictor */}
            <div style={pageStyle('predictor')}>{mounted('predictor') && <ExamPredictor />}</div>

            {/* Question Paper */}
            <div style={pageStyle('question-paper')}>{mounted('question-paper') && <QuestionPaper />}</div>

            {/* Lesson Plan */}
            <div style={pageStyle('lesson-plan')}>{mounted('lesson-plan') && <LessonPlan />}</div>

            {/* Parent Message */}
            <div style={pageStyle('parent-message')}>{mounted('parent-message') && <ParentMessage />}</div>

            {/* Settings */}
            <div style={pageStyle('settings')}>{mounted('settings') && <Settings />}</div>

            {/* Fee Reminder */}
            <div style={pageStyle('fee-reminder')}>{mounted('fee-reminder') && <FeeReminder />}</div>

            {/* Admission Bot */}
            <div style={pageStyle('admission')}>{mounted('admission') && <AdmissionBot />}</div>

            {/* Attendance */}
            <div style={pageStyle('attendance')}>{mounted('attendance') && <Attendance />}</div>

            {/* Timetable */}
            <div style={pageStyle('timetable')}>{mounted('timetable') && <Timetable />}</div>

            {/* Writing Tools */}
            <div style={pageStyle('writing')}>{mounted('writing') && <WritingTools />}</div>

            {/* Concept Tools */}
            <div style={pageStyle('concept')}>{mounted('concept') && <ConceptTools />}</div>

            {/* Formula Sheet */}
            <div style={pageStyle('formula')}>{mounted('formula') && <FormulaSheet />}</div>

            {/* Adaptive Quiz */}
            <div style={pageStyle('quiz')}>{mounted('quiz') && <AdaptiveQuiz />}</div>

            {/* NOTE: 5 pages removed per spec — Analytics, Gamification (My
                Progress), MemoryBrain (AI Memory), VoiceTutor, PanicMode.
                Their functionality now lives inside Kyno / Kyno Solver. */}

            {/* Pomodoro */}
            <div style={pageStyle('pomodoro')}>{mounted('pomodoro') && <Pomodoro />}</div>

            {/* Announcement */}
            <div style={pageStyle('announcement')}>{mounted('announcement') && <Announcement />}</div>

            {/* School Hub */}
            <div style={pageStyle('school')}>{mounted('school') && profile && <SchoolHub profile={profile} />}</div>

            {/* Focus Mode */}
            <div style={pageStyle('focus')}>{mounted('focus') && <FocusMode />}</div>

            {/* Camera Study */}
            <div style={pageStyle('camera')}>{mounted('camera') && <CameraStudy />}</div>

            {/* Mistake Analysis */}
            <div style={pageStyle('mistakes')}>{mounted('mistakes') && <MistakeAnalysis />}</div>

            {/* Revision Simulator */}
            <div style={pageStyle('simulator')}>{mounted('simulator') && <RevisionSimulator />}</div>

            {/* AI Notebook */}
            <div style={pageStyle('notebook')}>{mounted('notebook') && <Notebook />}</div>

            {/* Concept Map */}
            <div style={pageStyle('concept-map')}>{mounted('concept-map') && <ConceptMap />}</div>

            {/* Battle Mode */}
            <div style={pageStyle('battle')}>{mounted('battle') && <BattleMode />}</div>

            {/* Knowledge Graph */}
            <div style={pageStyle('knowledge')}>{mounted('knowledge') && <KnowledgeGraph />}</div>

            {/* Ops Dashboard — live status, public JSON at /api/ops/status */}
            <div style={pageStyle('ops')}>{mounted('ops') && <Ops />}</div>

            {/* AI Teacher Assistant */}
            <div style={pageStyle('teacher-ai')}>{mounted('teacher-ai') && <TeacherAssistant />}</div>

            {/* Explain My Mistake */}
            <div style={pageStyle('explain-mistake')}>{mounted('explain-mistake') && <ExplainMistake />}</div>

            {/* Performance Predictor */}
            <div style={pageStyle('perf-predictor')}>{mounted('perf-predictor') && <PerformancePredictor />}</div>

            {/* Kyno Labs */}
            <div style={pageStyle('labs')}>{mounted('labs') && <KairoLabs />}</div>

            {/* Kyno — AI Academic Twin */}
            <div style={pageStyle('kairo-os')}>{mounted('kairo-os') && <KairoOS />}</div>

          </div>

          {/* Insight panel — Kyno's Solver has its own slideshow column,
              so suppress the side panel on the doubt route. */}
          {false && active === 'doubt' && !isMobile && (
            <InsightPanel hasContent={hasContent} lastQuestion={lastQuestion} />
          )}
        </div>
      </div>
    </div>
  )
}
