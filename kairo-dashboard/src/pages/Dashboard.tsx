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
import ErrorBoundary from '../components/ErrorBoundary'
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
import PerformancePredictor from './PerformancePredictor'
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
  pomodoro:         'Pomodoro Timer',
  announcement:     'Announcements',
  school:           'School Hub',
  focus:            'Focus Mode',
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
  'perf-predictor': 'Performance Predictor',
  labs:             'Kyno Labs',
  'kairo-os':       'Kyno',
  settings:         'Settings',
}

interface DashboardProps {
  profile?: Profile
  onLogout?: () => void
}

export default function Dashboard({ profile, onLogout }: DashboardProps) {
  const [active, setActive]           = useState(profile?.role === 'admin' ? 'school' : 'home')
  const [visited, setVisited] = useState<Set<string>>(() => new Set([profile?.role === 'admin' ? 'school' : 'home']))
  useEffect(() => {
    setVisited(prev => (prev.has(active) ? prev : new Set(prev).add(active)))
  }, [active])
  const mounted = (id: string) => visited.has(id)
  const [solverUi, setSolverUi] = useState<'chat' | 'classic'>(() => {
    try { return (localStorage.getItem('kairo:solver-ui') as 'chat' | 'classic') || 'chat' } catch { return 'chat' }
  })
  const [isDark]                       = useState(true)
  const setIsDark = (_: boolean | ((d: boolean) => boolean)) => {  }
  const [lastQuestion, setLastQuestion] = useState('')
  const [hasContent, setHasContent]   = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [solverActive, setSolverActive] = useState(false)

  useEffect(() => {
    (window as any).__kairoSetActive = setActive
    return () => { delete (window as any).__kairoSetActive }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('kairo-app')
    document.body.style.background = '#0A0D16'
    document.body.style.color      = '#fafafa'
    try {
      localStorage.setItem('kairo_theme', 'dark')
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
      background: isDark ? '#0A0D16' : '#f4f4f5',
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

            <XPToast />

            <ErrorBoundary>

            <div style={pageStyle('home')}>{mounted('home') && <KairoHome onNavigate={setActive} />}</div>

            <div style={pageStyle('doubt')}>
              {mounted('doubt') && (
              <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
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
                    border: '1px solid rgba(165,180,252,0.28)',
                    color: '#A5B4FC', fontSize: isMobile ? 10 : 11, fontWeight: 700,
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

            <div style={pageStyle('flashcards')}>{mounted('flashcards') && <Flashcards />}</div>

            <div style={pageStyle('study-plan')}>{mounted('study-plan') && <StudyPlan />}</div>

            <div style={pageStyle('exam-planner')}>{mounted('exam-planner') && <ExamPlanner />}</div>

            <div style={pageStyle('topic-architect')}>{mounted('topic-architect') && <TopicArchitect />}</div>

            <div style={pageStyle('essay')}>{mounted('essay') && <EssayGrader />}</div>

            <div style={pageStyle('predictor')}>{mounted('predictor') && <ExamPredictor />}</div>

            <div style={pageStyle('question-paper')}>{mounted('question-paper') && <QuestionPaper />}</div>

            <div style={pageStyle('lesson-plan')}>{mounted('lesson-plan') && <LessonPlan />}</div>

            <div style={pageStyle('parent-message')}>{mounted('parent-message') && <ParentMessage />}</div>

            <div style={pageStyle('settings')}>{mounted('settings') && <Settings />}</div>

            <div style={pageStyle('fee-reminder')}>{mounted('fee-reminder') && <FeeReminder />}</div>

            <div style={pageStyle('admission')}>{mounted('admission') && <AdmissionBot />}</div>

            <div style={pageStyle('attendance')}>{mounted('attendance') && <Attendance />}</div>

            <div style={pageStyle('timetable')}>{mounted('timetable') && <Timetable />}</div>

            <div style={pageStyle('writing')}>{mounted('writing') && <WritingTools />}</div>

            <div style={pageStyle('concept')}>{mounted('concept') && <ConceptTools />}</div>

            <div style={pageStyle('formula')}>{mounted('formula') && <FormulaSheet />}</div>

            <div style={pageStyle('quiz')}>{mounted('quiz') && <AdaptiveQuiz />}</div>

            <div style={pageStyle('pomodoro')}>{mounted('pomodoro') && <Pomodoro />}</div>

            <div style={pageStyle('announcement')}>{mounted('announcement') && <Announcement />}</div>

            <div style={pageStyle('school')}>{mounted('school') && profile && <SchoolHub profile={profile} />}</div>

            <div style={pageStyle('focus')}>{mounted('focus') && <FocusMode />}</div>

            <div style={pageStyle('camera')}>{mounted('camera') && <CameraStudy />}</div>

            <div style={pageStyle('mistakes')}>{mounted('mistakes') && <MistakeAnalysis />}</div>

            <div style={pageStyle('simulator')}>{mounted('simulator') && <RevisionSimulator />}</div>

            <div style={pageStyle('notebook')}>{mounted('notebook') && <Notebook />}</div>

            <div style={pageStyle('concept-map')}>{mounted('concept-map') && <ConceptMap />}</div>

            <div style={pageStyle('battle')}>{mounted('battle') && <BattleMode />}</div>

            <div style={pageStyle('league')}>{mounted('league') && <League />}</div>

            <div style={pageStyle('knowledge')}>{mounted('knowledge') && <KnowledgeGraph />}</div>

            <div style={pageStyle('ops')}>{mounted('ops') && <Ops />}</div>

            <div style={pageStyle('teacher-ai')}>{mounted('teacher-ai') && <TeacherAssistant />}</div>

            <div style={pageStyle('explain-mistake')}>{mounted('explain-mistake') && <ExplainMistake />}</div>

            <div style={pageStyle('perf-predictor')}>{mounted('perf-predictor') && <PerformancePredictor />}</div>

            <div style={pageStyle('labs')}>{mounted('labs') && <KairoLabs />}</div>

            <div style={pageStyle('kairo-os')}>{mounted('kairo-os') && <KairoOS />}</div>

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
