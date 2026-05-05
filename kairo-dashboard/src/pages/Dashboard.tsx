import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import ChatWindow from '../components/ChatWindow'
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
import { DEFAULT_MODEL } from '../lib/openrouter'

import type { AuthProfile } from './Login'
type Profile = AuthProfile

const PAGE_TITLES: Record<string, string> = {
  doubt:            'Doubt Solver',
  flashcards:       'Flashcards & SRS',
  'study-plan':     'Study Plan',
  essay:            'Essay Grader',
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
  settings:         'Settings',
}

interface DashboardProps {
  profile?: Profile
  onLogout?: () => void
}

export default function Dashboard({ profile, onLogout }: DashboardProps) {
  const [active, setActive]           = useState('doubt')
  const [isDark, setIsDark]           = useState(() => {
    const v = localStorage.getItem('kairo_theme')
    return v === null ? true : v === 'dark'
  })
  const [lastQuestion, setLastQuestion] = useState('')
  const [hasContent, setHasContent]   = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)

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

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: isDark ? '#0a0a0a' : '#f4f4f5',
      color:      isDark ? '#fafafa' : '#18181b',
      fontFamily: "'Lora', 'Georgia', serif",
      transition: 'background 0.25s ease',
    }}>
      <Sidebar
        active={active}
        setActive={setActive}
        isDark={isDark}
        toggleTheme={() => setIsDark(d => !d)}
        profile={profile}
        onLogout={onLogout}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar title={PAGE_TITLES[active] || 'Dashboard'} onModelChange={setSelectedModel} />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>

            {/* Doubt Solver */}
            <div style={pageStyle('doubt')}>
              <ChatWindow
                onNewMessage={handleNewMessage}
                onNavigate={setActive}
                model={selectedModel}
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

          </div>

          {/* Insight panel — only for doubt solver */}
          {active === 'doubt' && (
            <InsightPanel hasContent={hasContent} lastQuestion={lastQuestion} />
          )}
        </div>
      </div>
    </div>
  )
}
