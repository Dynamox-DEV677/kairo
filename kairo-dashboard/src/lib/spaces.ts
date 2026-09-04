/**
 * The seven-spaces redesign as a list: what is finished, where it lives, what
 * to call it. Read by the desktop sidebar of the new screens, the /new index
 * page and nothing else. Two spaces are still to come; the cutover commit is
 * the one that points the drawer at this list.
 */
import type { LucideIcon } from 'lucide-react'
import { MessageSquare, Target, TrendingUp, Calendar, BookOpen, User, Trophy } from 'lucide-react'

export interface Space { id: string; label: string; sub: string; icon: LucideIcon }

export const SPACES: Space[] = [
  { id: 'doubt-solving', label: 'Doubt Solving', sub: 'ask a question, get stepped answers',           icon: MessageSquare },
  { id: 'practice',      label: 'Practice',      sub: 'timed sessions, flashcards, written grading',  icon: Target },
  { id: 'performance',   label: 'Performance',   sub: 'your repeating mistakes',                      icon: TrendingUp },
  { id: 'plan',          label: 'Plan',          sub: 'exam countdown and syllabus coverage',         icon: Calendar },
  { id: 'notes',         label: 'Notes',         sub: 'one library, nothing kept without a return date', icon: BookOpen },
  { id: 'progress',      label: 'Progress',      sub: 'what you know, and the people studying beside you', icon: Trophy },
  { id: 'profile',       label: 'Profile',       sub: 'your username, your studies, who can see you',   icon: User },
]

export const SPACE_IDS: ReadonlySet<string> = new Set(SPACES.map(s => s.id))
