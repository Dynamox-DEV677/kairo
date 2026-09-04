/**
 * The seven spaces: the whole app, as a list.
 *
 * Since the cutover this is the navigation. The drawer, the desktop sidebar
 * and the bottom bar all read it, and SPACE_ALIASES sends every old route to
 * the space that absorbed it, so a bookmark, a deep link or an old button
 * still lands somewhere real.
 *
 * The ids, labels and redirects live in spaces.core.js (pure, so the test
 * runner can import them); this file only adds the icons.
 */
import type { LucideIcon } from 'lucide-react'
import { MessageSquare, Target, TrendingUp, Calendar, BookOpen, User, Trophy } from 'lucide-react'
import { SPACE_META } from './spaces.core'
import type { SpaceMeta } from './spaces.core'

// Values live in spaces.core.js and are imported FROM THERE by their users.
// This file adds icons and nothing else: re-exporting a value through a barrel
// is how the app ended up blank once, because the TS transform elided it and
// the import threw before React could mount.
export type { SpaceMeta }

export interface Space extends SpaceMeta { icon: LucideIcon }

const ICONS: Record<string, LucideIcon> = {
  'doubt-solving': MessageSquare,
  practice: Target,
  performance: TrendingUp,
  plan: Calendar,
  notes: BookOpen,
  progress: Trophy,
  profile: User,
}

export const SPACES: Space[] = SPACE_META.map(s => ({ ...s, icon: ICONS[s.id] || Target }))
