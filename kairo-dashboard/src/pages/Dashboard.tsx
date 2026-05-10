import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import MobileShell from '../components/MobileShell'
import { useIsMobile } from '../hooks/useViewport'
import ChatWindow from '../components/ChatWindow'
import KairoSolver from './KairoSolver'
import InsightPanel from '../components/InsightPanel'
import Flashcards from './Flashcards'
import StudyPlan from './StudyPlan'
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
import Analytics from './Analytics'
import Gamification from './Gamification'
import Pomodoro from './Pomodoro'
import Announcement from './Announcement'
import SchoolHub from './SchoolHub'
import ParentDashboard from './ParentDashboard'
import MemoryBrain from './MemoryBrain'
import FocusMode from './FocusMode'
import CameraStudy from './CameraStudy'
import MistakeAnalysis from './MistakeAnalysis'
import RevisionSimulator from './RevisionSimulator'
import Notebook from './Notebook'
import AdaptivePath from './AdaptivePath'
import ConceptMap from './ConceptMap'
import VoiceTutor from './VoiceTutor'
import BattleMode from './BattleMode'
import KnowledgeGraph from './KnowledgeGraph'
import TeacherAssistant from './TeacherAssistant'
import ExplainMistake from './ExplainMistake'
import PerformancePredictor from './PerformancePredictor'
import PanicMode from './PanicMode'
import KairoLabs from './KairoLabs'
import { DEFAULT_MODEL } from '../lib/openrouter'

import type { AuthProfile } from './Login'
type Profile = AuthProfile

const PAGE_TITLES: Record<string, string> = {
  doubt:            "Kairo's Solver",
  flashcards:       'Flashcards & SRS',
  'study-plan':     'Study Plan',
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
  analytics:        'Analytics',
  gamification:     'My Progress',
  pomodoro:         'Pomodoro Timer',
  announcement:     'Announcements',
  school:           'School Hub',
  memory:           'AI Memory',
  focus:            'Focus Mode',
  camera:           'Camera Study',
  mistakes:         'Mistake Analysis',
  simulator:        'Revision Simulator',
  notebook:         'AI Notebook',
  adaptive:         'Adaptive Path',
  'concept-map':    'Concept Map',
  voice:            'Voice Tutor',
  battle:           'Battle Mode',
  knowledge:        'Knowledge Graph',
  'teacher-ai':     'AI Teacher Assistant',
  'explain-mistake': 'Explain My Mistake',
  'perf-predictor': 'Performance Predictor',
  panic:            'Exam Panic Mode',
  labs:             'Kairo Labs',
  settings:         'Settings',
}

interface DashboardProps {
  profile?: Profile
  onLogout?: () => void
}

export default function Dashboard({ profile, onLogout }: DashboardProps) {
  // Admins land on School Hub (their control center); everyone else on Kairo's Solver
  const [active, setActive]           = useState(profile?.role === 'admin' ? 'school' : 'doubt')
  const [isDark, setIsDark]           = useState(() => {
    const v = localStorage.getItem('kairo_theme')
    return v === null ? true : v === 'dark'
  })
  const [lastQuestion, setLastQuestion] = useState('')
  const [hasContent, setHasContent]   = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)

  // Expose setActive to other pages (used by Adaptive Path's "jump to feature" buttons)
  useEffect(() => {
    (window as any).__kairoSetActive = setActive
    return () => { delete (window as any).__kairoSetActive }
  }, [])

  // Apply theme to document root + persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    document.body.style.background = isDark ? '#0a0a0a' : '#f4f4f5'
    document.body.style.color      = isDark ? '#fafafa' : '#18181b'
    localStorage.setItem('kairo_theme', isDark ? 'dark' : 'light')
  }, [isDark])

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
      background: isDark ? '#0a0a0a' : '#f4f4f5',
      color:      isDark ? '#fafafa' : '#18181b',
      fontFamily: "'Lora', 'Georgia', serif",
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
          <TopBar title={PAGE_TITLES[active] || 'Dashboard'} onModelChange={setSelectedModel} profile={profile} />
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>

            {/* Kairo's Solver — adaptive AI visual learning engine */}
            <div style={pageStyle('doubt')}>
              <KairoSolver
                model={selectedModel}
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
            </div>

            {/* Flashcards */}
            <div style={pageStyle('flashcards')}><Flashcards /></div>

            {/* Study Plan */}
            <div style={pageStyle('study-plan')}><StudyPlan /></div>

            {/* Essay Grader */}
            <div style={pageStyle('essay')}><EssayGrader /></div>

            {/* Exam Predictor */}
            <div style={pageStyle('predictor')}><ExamPredictor /></div>

            {/* Question Paper */}
            <div style={pageStyle('question-paper')}><QuestionPaper /></div>

            {/* Lesson Plan */}
            <div style={pageStyle('lesson-plan')}><LessonPlan /></div>

            {/* Parent Message */}
            <div style={pageStyle('parent-message')}><ParentMessage /></div>

            {/* Settings */}
            <div style={pageStyle('settings')}><Settings /></div>

            {/* Fee Reminder */}
            <div style={pageStyle('fee-reminder')}><FeeReminder /></div>

            {/* Admission Bot */}
            <div style={pageStyle('admission')}><AdmissionBot /></div>

            {/* Attendance */}
            <div style={pageStyle('attendance')}><Attendance /></div>

            {/* Timetable */}
            <div style={pageStyle('timetable')}><Timetable /></div>

            {/* Writing Tools */}
            <div style={pageStyle('writing')}><WritingTools /></div>

            {/* Concept Tools */}
            <div style={pageStyle('concept')}><ConceptTools /></div>

            {/* Formula Sheet */}
            <div style={pageStyle('formula')}><FormulaSheet /></div>

            {/* Adaptive Quiz */}
            <div style={pageStyle('quiz')}><AdaptiveQuiz /></div>

            {/* Analytics */}
            <div style={pageStyle('analytics')}><Analytics /></div>

            {/* Gamification */}
            <div style={pageStyle('gamification')}><Gamification /></div>

            {/* Pomodoro */}
            <div style={pageStyle('pomodoro')}><Pomodoro /></div>

            {/* Announcement */}
            <div style={pageStyle('announcement')}><Announcement /></div>

            {/* School Hub */}
            <div style={pageStyle('school')}>{profile && <SchoolHub profile={profile} />}</div>

            {/* AI Memory Brain */}
            <div style={pageStyle('memory')}><MemoryBrain /></div>

            {/* Focus Mode */}
            <div style={pageStyle('focus')}><FocusMode /></div>

            {/* Camera Study */}
            <div style={pageStyle('camera')}><CameraStudy /></div>

            {/* Mistake Analysis */}
            <div style={pageStyle('mistakes')}><MistakeAnalysis /></div>

            {/* Revision Simulator */}
            <div style={pageStyle('simulator')}><RevisionSimulator /></div>

            {/* AI Notebook */}
            <div style={pageStyle('notebook')}><Notebook /></div>

            {/* Adaptive Path */}
            <div style={pageStyle('adaptive')}><AdaptivePath /></div>

            {/* Concept Map */}
            <div style={pageStyle('concept-map')}><ConceptMap /></div>

            {/* Voice Tutor */}
            <div style={pageStyle('voice')}><VoiceTutor /></div>

            {/* Battle Mode */}
            <div style={pageStyle('battle')}><BattleMode /></div>

            {/* Knowledge Graph */}
            <div style={pageStyle('knowledge')}><KnowledgeGraph /></div>

            {/* AI Teacher Assistant */}
            <div style={pageStyle('teacher-ai')}><TeacherAssistant /></div>

            {/* Explain My Mistake */}
            <div style={pageStyle('explain-mistake')}><ExplainMistake /></div>

            {/* Performance Predictor */}
            <div style={pageStyle('perf-predictor')}><PerformancePredictor /></div>

            {/* Exam Panic Mode */}
            <div style={pageStyle('panic')}><PanicMode /></div>

            {/* Kairo Labs */}
            <div style={pageStyle('labs')}><KairoLabs /></div>

          </div>

          {/* Insight panel — Kairo's Solver has its own slideshow column,
              so suppress the side panel on the doubt route. */}
          {false && active === 'doubt' && !isMobile && (
            <InsightPanel hasContent={hasContent} lastQuestion={lastQuestion} />
          )}
        </div>
      </div>
    </div>
  )
}
