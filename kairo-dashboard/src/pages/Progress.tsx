/**
 * Progress -- space 6. Battle Mode, League, Knowledge Graph, Concept Map,
 * Memory Graph and Study Room become one space.
 *
 * Two structural decisions from the brief:
 *   1. The three graphs are ONE map with two lenses (what I know / what is
 *      fading). Nodes are chapters, radius is marks, fill is mastery on one
 *      ramp, edges are prerequisites. The fading lens is the scheduler's own
 *      due dates. Nothing here is a hairball: twelve nodes at most.
 *   2. This screen shows one minor's identity to another minor. Username
 *      only. No chat, no photos, no profile pages, no follows. Every social
 *      surface has an off switch in Profile; rooms default OFF. A long-press
 *      on any username reports and blocks, silently.
 *
 * XP, level, streak and the map are stored rows and work offline. Battle,
 * League and Study Room need the network by definition and say so honestly
 * -- disabled tiles, never a spinner that hangs.
 *
 * No AI anywhere in this file. If a model call ever appears here, that is a bug.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Check, Loader2, Zap, Users, Trophy, Compass, Flame, WifiOff } from 'lucide-react'
import { T, FONT, MONO, ICON, CALLOUT } from '../lib/spaceTokens'
import { useSpaceLayout } from '../components/SpaceFrame'
import { SPACE_VIEW_EVENT } from '../lib/spaces.core'
import { keepPageMounted } from '../lib/keepMounted'
import { confirmDialog } from '../components/ConfirmModal'
import { loadState, getDashboard, getProfile, listFlashcards } from '../lib/twin'
import { graphForProfile } from '../lib/syllabusFor'
import { nodeStates } from '../lib/syllabusGraph.core'
import type { Graph, GraphNode, NodeState } from '../lib/syllabusGraph.core'
import { selectStreakDetail } from '../lib/selectors.core'
import { loadGame, levelFromXP, XP_RULES, XP_NOT_FOR, provideWeekMinutes, pushLeagueNow } from '../lib/game'
import {
  chapterGroups, layoutGroup, edgesFor, paintFor, mapIsEmpty, fadingByChapter, fadingCallout, weekMinutes, weekStart,
  leagueSections, timeLeftLabel, roomMinutes, numberWord, RAMP, FADE, EDGE, MIN_GROUP,
} from '../lib/progress.core'
import type { ChapterGroup } from '../lib/progress.core'
import { SUBJECTS, ROUND, masteryBand, buildBank, pickQuestions, scoreAnswer, outcome, subjectOfChapter } from '../lib/arena.core'
import type { BankQuestion } from '../lib/arena.core'
import { queueForBattle, leaveQueue, fetchMatch, sendAnswer, refreshArenaStats, cachedArenaStats, type MatchView, type ArenaStats } from '../lib/arena'
import { joinRoom, watchLobby, roomsAvailable, type RoomMember, type RoomHandle } from '../lib/rooms'
import { getSocialCached, refreshSocial, reportUser, locallyBlocked, SOCIAL_EVENT, type SocialProfile } from '../lib/social'
import { tileHue, tileLetter } from '../lib/username.core'
import { parseHistory } from '../lib/focus.core'
import { readTimeStore } from '../lib/timeTracker'
import { getJSON, setJSON, getRaw } from '../lib/storage'
import { api } from '../lib/api'
import SHEET from '../data/formulas.cbse10.json'

type Style = React.CSSProperties
type View = { name: 'home' } | { name: 'map' } | { name: 'league' } | { name: 'battle' } | { name: 'room' }

const VERSUS = '#101018'
const LEAGUE_CACHE = 'kyno:league:group'

/* ── shared bits ─────────────────────────────────────────────────────────── */

function Eyebrow({ children, color = T.accent }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color, textTransform: 'uppercase' }}>{children}</div>
}
function Card({ children, style, onClick }: { children: React.ReactNode; style?: Style; onClick?: () => void }) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </div>
  )
}
function Primary({ children, onClick, style, disabled }: { children: React.ReactNode; onClick?: () => void; style?: Style; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 52, borderRadius: 14, border: 'none', background: disabled ? T.raised : T.accent, color: disabled ? T.faint : '#fff',
      fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style,
    }}>{children}</button>
  )
}
function Secondary({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: Style }) {
  return (
    <button onClick={onClick} style={{
      height: 52, padding: '0 16px', borderRadius: 14, background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text2,
      fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style,
    }}>{children}</button>
  )
}
function Back({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: T.muted, fontFamily: FONT, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, minHeight: 44 }}>
      <ArrowLeft size={17} {...ICON} /> {label}
    </button>
  )
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 36, padding: '0 12px', borderRadius: 100, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
      background: on ? T.accentSurface : T.raised, border: `1px solid ${on ? T.accent : T.borderCtl}`, color: on ? T.accentPale : T.muted,
    }}>{children}</button>
  )
}

/** The avatar IS the username: a letter on a hue derived from it. No uploads, ever. */
function Tile({ username, size = 32 }: { username: string; size?: number }) {
  return (
    <div aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: tileHue(username), display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.42), fontWeight: 700, color: T.text, flexShrink: 0 }}>
      {tileLetter(username)}
    </div>
  )
}

/**
 * Long-press on a username reports the account and removes it from this
 * student's pool for good. No tap target, no menu, nowhere to go -- a
 * username is not a link.
 */
function LongPress({ onLongPress, children, style }: { onLongPress: () => void; children: React.ReactNode; style?: Style }) {
  const timer = useRef<number | null>(null)
  const start = () => { cancel(); timer.current = window.setTimeout(() => { timer.current = null; onLongPress() }, 600) }
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  return (
    <div onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onContextMenu={e => { e.preventDefault(); cancel(); onLongPress() }}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', ...style } as Style}>
      {children}
    </div>
  )
}

async function reportFlow(username: string, context: 'league' | 'battle' | 'room', after: () => void) {
  const ok = await confirmDialog({
    title: `Report ${username}?`,
    body: 'They will not be told. They disappear from your leagues, battles and study rooms for good — there is nothing else to do, because there is no interaction to stop.',
    confirmLabel: 'Report and block', cancelLabel: 'Cancel', tone: 'danger',
  })
  if (!ok) return
  await reportUser(username, context)
  after()
}

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}

/* ── the model: everything computed from stored rows ─────────────────────── */

function useModel(tick: number) {
  return useMemo(() => {
    const profile = (() => { try { return getProfile() } catch { return null } })()
    const graph: Graph | null = (() => { try { return graphForProfile(profile as any) } catch { return null } })()
    const st = (() => { try { return loadState() } catch { return { events: [], mastery: [] } as any } })()
    const states: Map<string, NodeState> | null = graph ? nodeStates(graph, { events: st.events, mastery: (() => { try { return getDashboard().mastery } catch { return [] } })() }) : null
    const game = loadGame()
    const level = levelFromXP(game.totalXP)
    const streak = (() => { try { return selectStreakDetail(st.events as any).streak } catch { return game.streak || 0 } })()
    const cards = (() => { try { return listFlashcards() } catch { return [] } })()
    const fading = fadingByChapter(graph, cards as any)
    const groups = graph ? chapterGroups(graph) : []
    const minutes = (() => {
      try { return weekMinutes({ focusHistory: parseHistory(JSON.parse(getRaw('kyno:focus:history') || '[]')) as any, timeStore: readTimeStore() }) } catch { return 0 }
    })()
    return { graph, states, game, level, streak, fading, groups, minutes }
  }, [tick])   // eslint-disable-line react-hooks/exhaustive-deps
}

/** Mastery band for a subject: the average over its chapters. */
function bandFor(graph: Graph | null, states: Map<string, NodeState> | null, subject: string) {
  if (!graph || !states) return 2
  const ms = graph.chapters.filter(c => subjectOfChapter(c.id) === subject).map(c => states.get(c.id)?.mastery || 0)
  return ms.length ? masteryBand(ms.reduce((a, b) => a + b, 0) / ms.length) : 2
}

const short = (name: string) => { const w = name.replace(/ and /g, ' & ').split(' '); let s = w[0]; for (const x of w.slice(1)) { if ((s + ' ' + x).length > 15) return s + '…'; s += ' ' + x } return s }

/* ── the constellation ───────────────────────────────────────────────────── */

function Constellation({ group, states, fading, lens, onTap, compact }: {
  group: ChapterGroup; states: Map<string, NodeState> | null; fading: Map<string, number>; lens: 'know' | 'fade'
  onTap?: (c: GraphNode) => void; compact?: boolean
}) {
  const chapters = compact ? [...group.chapters].sort((a, b) => (b.typical_marks || 0) - (a.typical_marks || 0)).slice(0, 8) : group.chapters
  const layout = useMemo(() => layoutGroup(chapters, compact ? { w: 320, h: 170 } : { w: 320, h: 260 }), [chapters, compact])
  const edges = useMemo(() => edgesFor(chapters), [chapters])
  const pos = new Map(layout.nodes.map(n => [n.id, n]))
  return (
    <svg viewBox={`0 0 ${layout.w} ${layout.h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${group.label} map`}>
      {edges.map(e => { const a = pos.get(e.from), b = pos.get(e.to); return a && b ? <line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lens === 'fade' ? FADE.edge : EDGE} strokeWidth={1.5} /> : null })}
      {layout.nodes.map(n => {
        const c = chapters.find(ch => ch.id === n.id)!
        const p = paintFor(states?.get(n.id))
        const days = fading.get(n.id)
        const isFading = lens === 'fade' && days != null && p.key !== 'untouched'
        const fill = lens === 'fade' ? (isFading ? FADE.fill : FADE.dimFill) : p.fill
        const stroke = lens === 'fade' ? (isFading ? FADE.ring : FADE.dimStroke) : p.stroke
        return (
          <g key={n.id} onClick={onTap ? () => onTap(c) : undefined} style={{ cursor: onTap ? 'pointer' : 'default' }}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={fill} stroke={stroke || 'none'} strokeWidth={isFading ? 2.5 : stroke ? 1.5 : 0} />
            {isFading && <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={days === 0 ? 9 : 11} fontWeight={700} fill={FADE.ring} fontFamily={FONT}>{days === 0 ? 'today' : `${days}d`}</text>}
            {!compact && <text x={n.x} y={n.y + n.r + 11} textAnchor="middle" fontSize={8.5} fill={lens === 'fade' && !isFading ? T.fainter : T.muted} fontFamily={FONT}>{short(c.name)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function Legend() {
  const items: Array<[string, string, string | null]> = [['solid', RAMP.solid, null], ['shaky', RAMP.shaky, null], ['untouched', RAMP.untouched, RAMP.untouchedStroke]]
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
      {items.map(([label, fill, stroke]) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.dim }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: fill, border: stroke ? `1px solid ${stroke}` : 'none' }} />{label}
        </span>
      ))}
    </div>
  )
}

/* ── the page ─────────────────────────────────────────────────────────────── */

export default function Progress({ onPractice, onOpenProfile }: {
  onPractice?: (filter: { topics?: string[] }) => void
  onOpenProfile?: () => void
}) {
  const [view, setView] = useState<View>({ name: 'home' })
  const [tick, setTick] = useState(0)
  const model = useModel(tick)
  const online = useOnline()
  const layout = useSpaceLayout()
  const [social, setSocial] = useState<SocialProfile | null>(() => getSocialCached())
  const [league, setLeague] = useState<any>(() => getJSON(LEAGUE_CACHE))
  const [arena, setArena] = useState<ArenaStats | null>(() => cachedArenaStats())
  const [lobby, setLobby] = useState<number | null>(null)

  useEffect(() => {
    const bump = () => setTick(t => t + 1)
    window.addEventListener('kairo:xp', bump); window.addEventListener('kyno:focus-banked', bump)
    const onSocial = (e: Event) => setSocial((e as CustomEvent).detail)
    window.addEventListener(SOCIAL_EVENT, onSocial)
    refreshSocial().then(p => { if (p) setSocial(p) })
    return () => { window.removeEventListener('kairo:xp', bump); window.removeEventListener('kyno:focus-banked', bump); window.removeEventListener(SOCIAL_EVENT, onSocial) }
  }, [])

  // The league groups on effort: report this week's minutes, then ask for the group.
  useEffect(() => {
    provideWeekMinutes(() => model.minutes)
    pushLeagueNow()
  }, [model.minutes])
  const loadLeague = useCallback(async () => {
    if (!online) return
    try {
      const week = new Date(weekStart()).toISOString().slice(0, 10)
      const g = await api(`/league/group?week=${week}`)
      setLeague(g); try { setJSON(LEAGUE_CACHE, { ...g, fetchedAt: Date.now() }) } catch { /* storage blocked */ }
    } catch { /* keep the cached copy */ }
  }, [online])
  useEffect(() => { const t = setTimeout(loadLeague, 1800); return () => clearTimeout(t) }, [loadLeague])   // after the minutes push lands
  useEffect(() => { if (online) refreshArenaStats().then(s => { if (s) setArena(s) }) }, [online])
  useEffect(() => watchLobby(setLobby), [])
  // #/battle, #/league, #/study-room and #/concept-map open their own screen.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.space !== 'progress') return
      if (['map', 'league', 'battle', 'room', 'home'].includes(d.view)) setView({ name: d.view })
    }
    window.addEventListener(SPACE_VIEW_EVENT, on)
    return () => window.removeEventListener(SPACE_VIEW_EVENT, on)
  }, [])

  useEffect(() => { layout.setWide(view.name === 'map' && layout.areaWidth >= 760) }, [view.name, layout.areaWidth]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => layout.setWide(false), []) // eslint-disable-line react-hooks/exhaustive-deps
  // A live battle or a study room is real-time: losing it means losing the round.
  useEffect(() => (view.name === 'battle' || view.name === 'room' ? keepPageMounted('progress') : undefined), [view.name])

  const shell: Style = { position: 'absolute', inset: 0, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
  const scroll: Style = { flex: 1, overflowY: 'auto', padding: '18px 14px 24px' }
  const footer: Style = { padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt }

  const rank = league && !league.offline && !league.off && !league.small && Array.isArray(league.rows) ? league.rows.findIndex((r: any) => r.you) + 1 : 0
  const empty = mapIsEmpty(model.states)
  const previewGroup = useMemo(() => {
    if (!model.states) return model.groups[0] || null
    return model.groups.find(g => g.chapters.some(c => (model.states!.get(c.id)?.state || 'UNTOUCHED') !== 'UNTOUCHED')) || model.groups[0] || null
  }, [model.groups, model.states])
  const roomsOn = social?.join_rooms === true
  const battlesOn = social?.allow_battles !== false

  /* ── screen 1: /progress ───────────────────────────────────────────────── */
  if (view.name === 'home') {
    const { level } = model
    const c = 2 * Math.PI * 27
    const pct = level.need ? level.into / level.need : 0
    return (
      <div style={shell}>
        <div style={scroll}>
          <Eyebrow>Progress</Eyebrow>
          <h1 style={{ fontSize: 25, fontWeight: 700, margin: '8px 0 0', letterSpacing: -0.3 }}>What you know</h1>

          <Card style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
                <svg width={62} height={62} viewBox="0 0 62 62" aria-hidden>
                  <circle cx={31} cy={31} r={27} fill="none" stroke={T.divider} strokeWidth={6} />
                  <circle cx={31} cy={31} r={27} fill="none" stroke={T.accent} strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 31 31)" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{level.level}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600 }}>{level.into} / {level.need} XP</div>
                <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginTop: 3 }}>Earned for cards you kept and mistakes you fixed — not for opening the app</div>
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
              <Eyebrow color={T.faint}>How XP is scored</Eyebrow>
              <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                {XP_RULES.map(r => (
                  <div key={r.action} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.text2 }}>
                    <span>{r.line}</span><span style={{ fontFamily: MONO, color: T.accentPale }}>+{r.xp}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>{XP_NOT_FOR}</div>
            </div>
          </Card>

          <Card style={{ marginTop: 12 }} onClick={() => setView({ name: 'map' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Eyebrow color={T.muted}>Your map{previewGroup ? ` · ${previewGroup.label}` : ''}</Eyebrow>
              <ChevronRight size={16} color={T.faint} {...ICON} />
            </div>
            {empty || !previewGroup ? (
              <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 10 }}>Answer some questions and your map fills in.</div>
            ) : (
              <>
                <div style={{ marginTop: 8 }}><Constellation group={previewGroup} states={model.states} fading={model.fading} lens="know" compact /></div>
                <Legend />
              </>
            )}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
            {([
              ['Day streak', model.streak > 0 ? String(model.streak) : '—', <Flame key="f" size={15} color={T.warning} {...ICON} />],
              ['League', rank > 0 ? `#${rank}` : '—', <Trophy key="t" size={15} color={T.accentPale} {...ICON} />],
              ['Battles won', arena ? String(arena.won) : '—', <Zap key="z" size={15} color={T.info} {...ICON} />],
            ] as Array<[string, string, React.ReactNode]>).map(([label, value, icon]) => (
              <Card key={label} style={{ padding: 12 }}>
                {icon}
                <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, marginTop: 8, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11.5, color: T.dim, marginTop: 4 }}>{label}</div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <Card onClick={online && battlesOn ? () => setView({ name: 'battle' }) : undefined} style={{ opacity: online && battlesOn ? 1 : 0.6 }}>
              <Zap size={18} color={T.accentPale} {...ICON} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>Battle</div>
              <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{!online ? 'needs a connection' : !battlesOn ? 'off in Profile' : '1v1, 60 seconds'}</div>
            </Card>
            <Card onClick={online && roomsOn ? () => setView({ name: 'room' }) : roomsOn ? undefined : onOpenProfile} style={{ opacity: online ? 1 : 0.6 }}>
              <Users size={18} color={T.accentPale} {...ICON} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>Study room</div>
              <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{!online ? 'needs a connection' : !roomsOn ? 'off in Profile — tap to turn on' : lobby == null ? 'quiet co-presence' : lobby === 0 ? 'nobody in yet' : `${lobby} ${lobby === 1 ? 'person' : 'people'} in now`}</div>
            </Card>
          </div>
          {league && !league.offline && !league.off && !league.small && (
            <Card style={{ marginTop: 10 }} onClick={() => setView({ name: 'league' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Trophy size={18} color={T.accentPale} {...ICON} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>Your league</div><div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Group of {league.size} · {timeLeftLabel()}</div></div>
                <ChevronRight size={16} color={T.faint} {...ICON} />
              </div>
            </Card>
          )}
        </div>
        <div style={footer}><Primary onClick={() => setView({ name: 'map' })}><Compass size={18} {...ICON} /> Open the full map</Primary></div>
      </div>
    )
  }

  if (view.name === 'map') return <MapScreen model={model} shell={shell} scroll={scroll} footer={footer} wide={layout.wide} onBack={() => setView({ name: 'home' })} onPractice={onPractice} />
  if (view.name === 'league') return <LeagueScreen league={league} online={online} shell={shell} scroll={scroll} onBack={() => setView({ name: 'home' })} onOpenProfile={onOpenProfile} onReload={loadLeague} />
  if (view.name === 'battle') return <BattleScreen model={model} social={social} online={online} shell={shell} onBack={() => setView({ name: 'home' })} onOpenProfile={onOpenProfile} onDone={() => { refreshArenaStats().then(s => { if (s) setArena(s) }) }} />
  return <RoomScreen model={model} social={social} online={online} shell={shell} scroll={scroll} footer={footer} onBack={() => setView({ name: 'home' })} onOpenProfile={onOpenProfile} />
}

/* ── screen 2: the map, two lenses ───────────────────────────────────────── */

function MapScreen({ model, shell, scroll, footer, wide, onBack, onPractice }: {
  model: ReturnType<typeof useModel>; shell: Style; scroll: Style; footer: Style; wide: boolean
  onBack: () => void; onPractice?: (f: { topics?: string[] }) => void
}) {
  const { groups, states, fading, graph } = model
  const [gid, setGid] = useState<string>(() => groups[0]?.id || '')
  const [lens, setLens] = useState<'know' | 'fade'>('know')
  const [picked, setPicked] = useState<GraphNode | null>(null)
  const group = groups.find(g => g.id === gid) || groups[0] || null
  const empty = mapIsEmpty(states)
  const fadingHere = group ? group.chapters.filter(c => fading.has(c.id) && (states?.get(c.id)?.state || 'UNTOUCHED') !== 'UNTOUCHED') : []
  const callout = fadingCallout(fadingHere.length)

  return (
    <div style={shell}>
      <div style={scroll}>
        <Back onClick={onBack} />
        <div style={{ marginTop: 6 }}><Eyebrow>Your map</Eyebrow></div>
        {!graph ? (
          <Card style={{ marginTop: 12 }}><div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>No verified syllabus for your board and class yet, so there is no map to draw. Kyno will not invent one.</div></Card>
        ) : empty ? (
          <Card style={{ marginTop: 12 }}><div style={{ fontSize: 15, fontWeight: 600 }}>Answer some questions and your map fills in.</div><div style={{ fontSize: 13, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>Every chapter you touch lights up here — solid, shaky, or fading.</div></Card>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {groups.map(g => <Chip key={g.id} on={g.id === group?.id} onClick={() => { setGid(g.id); setPicked(null) }}>{g.label}</Chip>)}
            </div>
            <div role="tablist" style={{ display: 'flex', marginTop: 12, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 3 }}>
              {(['know', 'fade'] as const).map(l => (
                <button key={l} role="tab" aria-selected={lens === l} onClick={() => setLens(l)} style={{
                  flex: 1, height: 38, borderRadius: 9, border: 'none', fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: lens === l ? T.accentSurface : 'transparent', color: lens === l ? T.accentPale : T.muted,
                }}>{l === 'know' ? 'What I know' : 'What is fading'}</button>
              ))}
            </div>
            {lens === 'fade' && (
              callout ? (
                <div style={{ marginTop: 12, padding: 14, borderRadius: 16, ...CALLOUT.amber }}>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{callout.headline}</div>
                  <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.55, marginTop: 6 }}>{callout.body}</div>
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 13, color: T.dim, lineHeight: 1.5 }}>Nothing in {group?.label} slips below usable this week.</div>
              )
            )}
            {group && (
              <div style={wide ? { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 14, alignItems: 'start' } : { marginTop: 14 }}>
                <Card style={{ padding: 10 }}>
                  <Constellation group={group} states={states} fading={fading} lens={lens} onTap={setPicked} />
                  {lens === 'know' && <div style={{ padding: '0 6px 4px' }}><Legend /></div>}
                </Card>
                <div>
                  {picked ? (() => {
                    const st = states?.get(picked.id)
                    const p = paintFor(st)
                    const days = fading.get(picked.id)
                    return (
                      <Card style={{ marginTop: wide ? 0 : 12 }}>
                        <Eyebrow color={T.muted}>Chapter</Eyebrow>
                        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{picked.name}</div>
                        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 13, color: T.text2 }}>
                          <span><b style={{ fontFamily: MONO, color: T.text }}>{Math.round((st?.mastery || 0) * 100)}%</b> mastery</span>
                          <span><b style={{ fontFamily: MONO, color: T.text }}>{picked.typical_marks || 0}</b> marks</span>
                          <span style={{ color: p.key === 'solid' ? T.accentLite : p.key === 'shaky' ? T.muted : T.faint }}>{p.key}</span>
                        </div>
                        {days != null && p.key !== 'untouched' && <div style={{ fontSize: 12.5, color: T.warning, marginTop: 8 }}>{days === 0 ? 'Due for review today' : `Slips below usable in ${days} day${days === 1 ? '' : 's'}`}</div>}
                        <Primary style={{ marginTop: 12, height: 46 }} onClick={() => onPractice?.({ topics: [picked.name] })}>Practise this <ChevronRight size={18} {...ICON} /></Primary>
                      </Card>
                    )
                  })() : wide ? <div style={{ fontSize: 13, color: T.faint, padding: 12 }}>Tap a chapter to see its mastery, marks and a practice action.</div> : null}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {lens === 'fade' && callout && fadingHere.length > 0 && (
        <div style={footer}><Primary onClick={() => onPractice?.({ topics: fadingHere.map(c => c.name) })}>{callout.action} <ChevronRight size={18} {...ICON} /></Primary></div>
      )}
    </div>
  )
}

/* ── screen 4: the league ────────────────────────────────────────────────── */

function LeagueScreen({ league, online, shell, scroll, onBack, onOpenProfile, onReload }: {
  league: any; online: boolean; shell: Style; scroll: Style; onBack: () => void; onOpenProfile?: () => void; onReload: () => void
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => locallyBlocked())
  useEffect(() => { onReload() }, [onReload])
  const rows = (league?.rows || []).filter((r: any) => !hidden.has(r.username))
  const { movingUp, stayingPut } = leagueSections(rows)
  const Row = ({ r, dim }: { r: any; dim?: boolean }) => (
    <LongPress onLongPress={() => { if (!r.you) reportFlow(r.username, 'league', () => setHidden(h => new Set([...h, r.username]))) }} style={{ opacity: dim ? 0.72 : 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '8px 12px', borderRadius: 14, marginTop: 6,
        ...(r.you ? { ...CALLOUT.purple, border: `1px solid ${T.accent}` } : { background: T.surface, border: `1px solid ${T.border}` }),
      }}>
        <span style={{ width: 22, fontFamily: MONO, fontSize: 13, color: T.muted, textAlign: 'right' }}>{r.rank}</span>
        <Tile username={r.username} size={30} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: r.you ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.you ? 'You' : r.username}</span>
        <span style={{ fontFamily: MONO, fontSize: 13.5, color: T.text2 }}>{r.xp} XP</span>
      </div>
    </LongPress>
  )
  return (
    <div style={shell}>
      <div style={scroll}>
        <Back onClick={onBack} />
        <div style={{ marginTop: 6 }}><Eyebrow>League</Eyebrow></div>
        {!online && !league ? (
          <Card style={{ marginTop: 12 }}><div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.text2, fontSize: 14 }}><WifiOff size={16} {...ICON} /> Your league needs a connection.</div></Card>
        ) : !league || league.offline ? (
          <Card style={{ marginTop: 12 }}><div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>{league?.offline ? 'Leagues are not switched on at the server yet.' : 'Loading your league…'}</div></Card>
        ) : league.off ? (
          <Card style={{ marginTop: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Leagues are off for you</div>
            <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>Nobody sees you and you see nobody. Turn "Show me in leagues" on in Profile to join a group.</div>
            {onOpenProfile && <Secondary style={{ marginTop: 12, width: '100%' }} onClick={onOpenProfile}>Open Profile</Secondary>}
          </Card>
        ) : (
          <>
            <Card style={{ marginTop: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Group of {league.size}</div>
              <div style={{ fontSize: 13, color: T.text2, marginTop: 4, lineHeight: 1.5 }}>Matched on how much you study, not how good you are</div>
              <div style={{ fontSize: 12.5, color: T.accentPale, marginTop: 6, fontFamily: MONO }}>{timeLeftLabel()}</div>
            </Card>
            {league.small ? (
              <Card style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>Your group fills in as more people study this week — {league.size} so far. A leaderboard of two is worse than none, so the table waits until there are five.</div>
              </Card>
            ) : (
              <>
                <div style={{ marginTop: 18 }}><Eyebrow color={T.muted}>Moving up</Eyebrow></div>
                {movingUp.map((r: any) => <Row key={r.username} r={r} />)}
                {stayingPut.length > 0 && (
                  <>
                    <div style={{ marginTop: 18 }}><Eyebrow color={T.faint}>Staying put</Eyebrow></div>
                    {stayingPut.map((r: any) => <Row key={r.username} r={r} dim={!r.you} />)}
                  </>
                )}
              </>
            )}
            <div style={{ fontSize: 12, color: T.faint, lineHeight: 1.5, marginTop: 18 }}>Nobody drops out of a league here — the bottom five just stay where they are. You can turn leagues off any time in Settings. Long-press a name to report it.</div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── screen 3: the battle ────────────────────────────────────────────────── */

type Local = { questions: BankQuestion[]; answers: Array<{ index: number; choice: number; correct: boolean; points: number }>; startedAt: number }

function BattleScreen({ model, social, online, shell, onBack, onOpenProfile, onDone }: {
  model: ReturnType<typeof useModel>; social: SocialProfile | null; online: boolean; shell: Style
  onBack: () => void; onOpenProfile?: () => void; onDone: () => void
}) {
  const [subject, setSubject] = useState<string>(SUBJECTS[0])
  const [phase, setPhase] = useState<'pick' | 'queue' | 'offer' | 'live' | 'solo' | 'over'>('pick')
  const [match, setMatch] = useState<MatchView | null>(null)
  const [local, setLocal] = useState<Local | null>(null)
  const [offset, setOffset] = useState(0)          // server clock minus ours
  const [now, setNow] = useState(Date.now())
  const [reveal, setReveal] = useState<{ index: number; choice: number; correctIndex: number; points: number } | null>(null)
  const [waited, setWaited] = useState(0)
  const [note, setNote] = useState('')
  const shownAt = useRef(Date.now())
  const stop = useRef(false)
  const battlesOn = social?.allow_battles !== false
  const username = social?.username || 'you'

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id) }, [])
  useEffect(() => () => { stop.current = true; if (phase === 'queue') leaveQueue().catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* matchmaking: poll the queue until paired or fifteen seconds pass */
  async function findOpponent() {
    stop.current = false; setPhase('queue'); setWaited(0); setNote('')
    const band = bandFor(model.graph, model.states, subject)
    const t0 = Date.now()
    while (!stop.current) {
      let r: any
      try { r = await queueForBattle(subject, band) } catch { r = { offline: true } }
      if (stop.current) return
      if (r.matchId) { await openMatch(r.matchId); return }
      if (r.offline) { setNote('Battles need a connection to the server. A solo round works offline.'); setPhase('offer'); return }
      if (r.disabled) { setPhase('pick'); return }
      const w = Date.now() - t0
      setWaited(w)
      if (w >= ROUND.waitSeconds * 1000) { leaveQueue().catch(() => {}); setNote('Nobody free in ' + subject + ' right now.'); setPhase('offer'); return }
      await new Promise(res => setTimeout(res, 2000))
    }
  }
  async function openMatch(id: string) {
    const m = await fetchMatch(id)
    setOffset(m.now - Date.now()); setMatch(m); shownAt.current = Date.now(); setPhase('live')
    // heartbeat + opponent progress
    ;(async () => {
      while (!stop.current) {
        await new Promise(res => setTimeout(res, 1500))
        if (stop.current) return
        try {
          const next = await fetchMatch(id)
          setOffset(next.now - Date.now()); setMatch(next)
          if (next.status !== 'live') { setPhase('over'); onDone(); return }
        } catch { /* keep the last view; the server voids a silent side */ }
      }
    })()
  }
  function startSolo() {
    const graph = model.graph
    const bank = buildBank((SHEET as any).formulas, graph)
    const qs = pickQuestions(bank, subject, `solo-${Date.now()}`)
    setLocal({ questions: qs, answers: [], startedAt: Date.now() }); shownAt.current = Date.now(); setPhase('solo')
  }

  const live = phase === 'live' && match
  const solo = phase === 'solo' && local
  const questions = live ? match!.questions : solo ? local!.questions : []
  const myAnswers = live ? match!.me.answers : solo ? local!.answers : []
  const current = myAnswers.length
  const total = questions.length
  const endsAt = live ? match!.endsAt : solo ? local!.startedAt + ROUND.seconds * 1000 : 0
  const left = Math.max(0, endsAt - (now + (live ? offset : 0)))
  const timeUp = !!(live || solo) && left <= 0

  async function choose(choice: number) {
    if (reveal || timeUp || current >= total) return
    const elapsed = Date.now() - shownAt.current
    if (live) {
      try {
        const r = await sendAnswer(match!.id, current, choice, elapsed)
        setReveal({ index: current, choice, correctIndex: r.correctIndex, points: r.points })
        setMatch(m => m ? { ...m, me: { ...m.me, score: r.score, answers: [...m.me.answers, { index: current, choice, correct: r.correct, points: r.points, at: Date.now() }] } } : m)
      } catch { setNote('That answer did not reach the server. Try again.') ; return }
    } else if (solo) {
      const q = local!.questions[current]
      const correct = q.answer === choice
      const points = scoreAnswer(correct, elapsed)
      setReveal({ index: current, choice, correctIndex: q.answer, points })
      setLocal(l => l ? { ...l, answers: [...l.answers, { index: current, choice, correct, points }] } : l)
    }
    setTimeout(() => { setReveal(null); shownAt.current = Date.now() }, 900)
  }
  useEffect(() => { if (solo && (current >= total || timeUp) && !reveal) setPhase('over') }, [solo, current, total, timeUp, reveal])

  // Read from the match/local round itself, not from the phase: on the results
  // screen `live` is already false, and keying off it showed every player a
  // final score of zero.
  const myScore = match ? match.me.score : local ? local.answers.reduce((s, a) => s + a.points, 0) : 0
  const versus: Style = { ...shell, background: VERSUS }
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000)

  /* pick a subject */
  if (phase === 'pick' || phase === 'queue' || phase === 'offer') {
    return (
      <div style={shell}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 24px' }}>
          <Back onClick={() => { stop.current = true; leaveQueue().catch(() => {}); onBack() }} />
          <div style={{ marginTop: 6 }}><Eyebrow>Battle</Eyebrow></div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 0' }}>1v1 · 7 questions · 60 seconds</h1>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>Faster right answers score more. You are matched with someone at a similar level in the subject. A dropped connection voids the round for both of you — never a loss.</div>
          {!battlesOn ? (
            <Card style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Battles are off for you</div>
              <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>Turn "Allow battles" on in Profile to be matched. Random opponents, no messages.</div>
              {onOpenProfile && <Secondary style={{ marginTop: 12, width: '100%' }} onClick={onOpenProfile}>Open Profile</Secondary>}
            </Card>
          ) : (
            <>
              <div style={{ marginTop: 16 }}><Eyebrow color={T.muted}>Subject</Eyebrow></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {SUBJECTS.map(s => <Chip key={s} on={subject === s} onClick={() => phase === 'pick' && setSubject(s)}>{s}</Chip>)}
              </div>
              {phase === 'queue' && (
                <Card style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: T.text2 }}><Loader2 size={16} {...ICON} /> Looking for someone in {subject}…</div>
                  <div style={{ height: 4, borderRadius: 2, background: T.divider, marginTop: 12, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, (waited / (ROUND.waitSeconds * 1000)) * 100)}%`, background: T.accent, transition: 'width .3s linear' }} /></div>
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>Up to fifteen seconds. If nobody is free you get a solo timed round instead — never a fake opponent.</div>
                  <Secondary style={{ marginTop: 12, width: '100%' }} onClick={() => { stop.current = true; leaveQueue().catch(() => {}); setPhase('pick') }}>Stop looking</Secondary>
                </Card>
              )}
              {phase === 'offer' && (
                <Card style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{note || 'Nobody free right now.'}</div>
                  <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>A solo timed round has the same seven questions and the same clock. It is not recorded as a battle.</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <Primary style={{ flex: 1 }} onClick={startSolo}>Solo round</Primary>
                    {online && <Secondary onClick={findOpponent}>Try again</Secondary>}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
        {battlesOn && phase === 'pick' && (
          <div style={{ padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt }}>
            <Primary onClick={online ? findOpponent : startSolo}>{online ? <><Zap size={18} {...ICON} /> Find an opponent</> : 'Solo round (offline)'}</Primary>
          </div>
        )}
      </div>
    )
  }

  /* the round is over */
  if (phase === 'over') {
    const oppScore = live || match ? match?.opp.score || 0 : 0
    const res = match && match.status === 'void' ? 'void' : match ? outcome(match.me.score, oppScore) : 'solo'
    return (
      <div style={versus}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <Eyebrow color={T.muted}>{res === 'void' ? 'Round void' : res === 'solo' ? 'Solo round' : 'Round over'}</Eyebrow>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>
            {res === 'void' ? 'The connection dropped.' : res === 'won' ? 'You won.' : res === 'lost' ? `${match?.opp.username || 'They'} won.` : res === 'draw' ? 'A draw.' : 'Done.'}
          </div>
          {res === 'void' && <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 8, maxWidth: 320 }}>Nobody loses a void round. Mobile data does this; it is not you.</div>}
          <div style={{ display: 'flex', gap: 24, marginTop: 20, alignItems: 'center' }}>
            <div><Tile username={username} size={44} /><div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, marginTop: 8 }}>{myScore}</div><div style={{ fontSize: 12, color: T.dim }}>You</div></div>
            {match && match.opp.username && <div><Tile username={match.opp.username} size={44} /><div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, marginTop: 8 }}>{oppScore}</div><div style={{ fontSize: 12, color: T.dim }}>{match.opp.username}</div></div>}
          </div>
          {res === 'solo' && <div style={{ fontSize: 12.5, color: T.faint, marginTop: 14 }}>Not recorded — there was no opponent.</div>}
        </div>
        <div style={{ padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.borderExam}`, background: VERSUS, display: 'flex', gap: 10 }}>
          <Secondary style={{ flex: 1 }} onClick={() => { stop.current = true; onBack() }}>Back</Secondary>
          <Primary style={{ flex: 1 }} onClick={() => { stop.current = true; setMatch(null); setLocal(null); setReveal(null); setPhase('pick') }}>Play again</Primary>
        </div>
      </div>
    )
  }

  /* live or solo: the versus chrome */
  const q = questions[current]
  const dots = questions.map((_, i) => i < current ? (myAnswers[i]?.correct ? T.success : T.error) : i === current && !timeUp ? T.accent : T.unseen)
  return (
    <div style={versus}>
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Tile username={username} size={30} />
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, color: T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</div><div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>{myScore}</div></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: T.warning, letterSpacing: -0.5 }}>{timeUp ? 'Time' : `${mm}:${String(ss).padStart(2, '0')}`}</div>
            <div style={{ fontSize: 11, color: T.dim }}>Q{Math.min(current + 1, total)} of {total}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}>
            {live && match!.opp.username ? (
              <>
                <div style={{ minWidth: 0, textAlign: 'right' }}><div style={{ fontSize: 12, color: T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match!.opp.username}</div><div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>{match!.opp.score}</div></div>
                <LongPress onLongPress={() => reportFlow(match!.opp.username!, 'battle', () => {})}><Tile username={match!.opp.username!} size={30} /></LongPress>
              </>
            ) : <div style={{ fontSize: 12, color: T.faint }}>Solo round</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          {dots.map((c, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 12px' }}>
        {q ? (
          <>
            <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.4 }}>{q.text}</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              {q.options.map((opt, i) => {
                const isPick = reveal?.choice === i, isRight = reveal?.correctIndex === i
                const dimmed = reveal && !isPick && !isRight
                return (
                  <button key={i} onClick={() => choose(i)} disabled={!!reveal || timeUp} style={{
                    display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '10px 12px', borderRadius: 14, textAlign: 'left', cursor: reveal || timeUp ? 'default' : 'pointer',
                    background: isRight ? T.successBg : T.surface, border: `1px solid ${isRight ? T.success : isPick ? T.error : T.border}`,
                    color: isRight ? T.success : isPick ? T.error : T.text, fontFamily: FONT, fontSize: 14.5, lineHeight: 1.35, opacity: dimmed ? 0.5 : 1,
                  }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${isRight ? T.success : isPick ? T.error : T.borderCtl}`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, color: isRight ? T.success : T.muted }}>
                      {isRight ? <Check size={14} {...ICON} /> : String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1 }}>{opt}</span>
                    {isRight && reveal && isPick && <span style={{ fontFamily: MONO, fontWeight: 700 }}>+{reveal.points}</span>}
                  </button>
                )
              })}
            </div>
            {note && <div style={{ fontSize: 12.5, color: T.warning, marginTop: 10 }}>{note}</div>}
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.muted, fontSize: 14 }}><Loader2 size={16} {...ICON} /> {timeUp ? 'Time is up — waiting for the final score…' : 'All seven answered. Waiting for the other side…'}</div>
        )}
        {live && match!.opp.username && (
          <div style={{ fontSize: 12.5, color: T.dim, marginTop: 16 }}>
            {!match!.opp.connected ? `${match!.opp.username} may have lost connection…` : match!.opp.answered > current ? `${match!.opp.username} is ahead by ${match!.opp.answered - current}` : match!.opp.answered === current ? `${match!.opp.username} is still choosing` : `${match!.opp.username} has answered ${match!.opp.answered}`}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.borderExam}`, fontSize: 12, color: T.faint, textAlign: 'center' }}>No names, no messages — just the questions</div>
    </div>
  )
}

/* ── screen 5: the study room ────────────────────────────────────────────── */

function RoomScreen({ model, social, online, shell, scroll, footer, onBack, onOpenProfile }: {
  model: ReturnType<typeof useModel>; social: SocialProfile | null; online: boolean; shell: Style; scroll: Style; footer: Style
  onBack: () => void; onOpenProfile?: () => void
}) {
  const roomsOn = social?.join_rooms === true
  const username = social?.username || 'student'
  const chapters = model.graph?.chapters || []
  const [topic, setTopic] = useState<GraphNode | null>(null)
  const [picking, setPicking] = useState(true)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [connected, setConnected] = useState(false)
  const [err, setErr] = useState('')
  const [joinedAt, setJoinedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [hidden, setHidden] = useState<Set<string>>(() => locallyBlocked())
  const handle = useRef<RoomHandle | null>(null)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => () => { handle.current?.leave() }, [])

  async function join(c: GraphNode) {
    setTopic(c); setPicking(false); setErr('')
    const subject = subjectOfChapter(c.id) || c.name
    if (handle.current) { handle.current.setSubject(subject); return }
    try {
      handle.current = await joinRoom({ username, subject }, setMembers, setConnected)
      setJoinedAt(Date.now())
    } catch (e) {
      // Only two things can go wrong here, and neither message comes from the
      // network: no connection, or every room already full.
      const offline = e instanceof Error && e.message === 'needs a connection'
      setErr(offline ? 'Study rooms need a connection.' : 'Every room is full right now — try again in a minute.')
      setPicking(true)
    }
  }
  function leave() { handle.current?.leave(); handle.current = null; onBack() }

  const others = members.filter(m => m.username !== username && !hidden.has(m.username))
  const count = others.length + (handle.current ? 1 : 0)
  const elapsed = joinedAt ? now - joinedAt : 0
  const em = Math.floor(elapsed / 60000), es = Math.floor((elapsed % 60000) / 1000)

  const bySubject = useMemo(() => {
    const m = new Map<string, GraphNode[]>()
    for (const c of chapters) { const s = subjectOfChapter(c.id) || 'Other'; if (!m.has(s)) m.set(s, []); m.get(s)!.push(c) }
    return [...m.entries()]
  }, [chapters])

  if (!roomsOn) {
    return (
      <div style={shell}>
        <div style={scroll}>
          <Back onClick={onBack} />
          <div style={{ marginTop: 6 }}><Eyebrow>Study room</Eyebrow></div>
          <Card style={{ marginTop: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Study rooms are off for you</div>
            <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, marginTop: 6 }}>They are off for everyone until they choose otherwise. In a room, others see your username and the subject you are on — nothing else, and there is no chat. Turn "Join study rooms" on in Profile to sit in one.</div>
            {onOpenProfile && <Secondary style={{ marginTop: 12, width: '100%' }} onClick={onOpenProfile}>Open Profile</Secondary>}
          </Card>
        </div>
      </div>
    )
  }

  if (picking || !handle.current) {
    return (
      <div style={shell}>
        <div style={scroll}>
          <Back onClick={handle.current ? () => setPicking(false) : onBack} />
          <div style={{ marginTop: 6 }}><Eyebrow>Study room</Eyebrow></div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 0' }}>{handle.current ? 'Change my topic' : 'What are you working on?'}</h1>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>Pick from your own syllabus. Others in the room see only the subject.</div>
          {(!online || !roomsAvailable()) && <Card style={{ marginTop: 12 }}><div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.text2, fontSize: 14 }}><WifiOff size={16} {...ICON} /> Study rooms need a connection.</div></Card>}
          {err && <div style={{ fontSize: 13, color: T.warning, marginTop: 10 }}>{err}</div>}
          {!chapters.length && <Card style={{ marginTop: 12 }}><div style={{ fontSize: 14, color: T.text2 }}>No verified syllabus for your board and class yet, so there is no topic list to pick from.</div></Card>}
          {bySubject.map(([s, list]) => (
            <div key={s} style={{ marginTop: 16 }}>
              <Eyebrow color={T.muted}>{s}</Eyebrow>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {list.map(c => (
                  <button key={c.id} onClick={() => join(c)} disabled={!online || !roomsAvailable()} style={{
                    minHeight: 46, padding: '0 14px', borderRadius: 12, textAlign: 'left', fontFamily: FONT, fontSize: 14, cursor: 'pointer',
                    background: topic?.id === c.id ? T.accentSurface : T.surface, border: `1px solid ${topic?.id === c.id ? T.accent : T.border}`, color: T.text,
                  }}>{c.name}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={shell}>
      <div style={scroll}>
        <Back onClick={leave} label="Leave" />
        <div style={{ marginTop: 6 }}><Eyebrow>Study room</Eyebrow></div>
        <div style={{ fontFamily: MONO, fontSize: 46, fontWeight: 600, letterSpacing: -1, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{em}:{String(es).padStart(2, '0')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 13.5, color: T.text2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? T.success : T.warning }} />
          {count <= 1 ? 'You are the only one here so far — others will join.' : `${numberWord(count).replace(/^./, ch => ch.toUpperCase())} people working`}
        </div>

        <div style={{ display: 'grid', gap: 6, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 12px', borderRadius: 14, ...CALLOUT.purple, border: `1px solid ${T.accent}` }}>
            <Tile username={username} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700 }}>You</div><div style={{ fontSize: 12, color: T.dim }}>{topic ? subjectOfChapter(topic.id) || topic.name : ''}</div></div>
            <span style={{ fontFamily: MONO, fontSize: 13, color: T.text2 }}>{roomMinutes(joinedAt || now, now)} min</span>
          </div>
          {others.map(m => (
            <LongPress key={m.key} onLongPress={() => reportFlow(m.username, 'room', () => setHidden(h => new Set([...h, m.username])))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 12px', borderRadius: 14, background: T.surface, border: `1px solid ${T.border}` }}>
                <Tile username={m.username} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</div><div style={{ fontSize: 12, color: T.dim }}>{m.subject}</div></div>
                <span style={{ fontFamily: MONO, fontSize: 13, color: T.text2 }}>{roomMinutes(m.joinedAt, now)} min</span>
              </div>
            </LongPress>
          ))}
        </div>

        <div style={{ fontSize: 12.5, color: T.faint, lineHeight: 1.55, marginTop: 18 }}>There is no chat here, and there never will be. You can see that other people are working and what subject they are on. That is the whole feature — the quiet is the point. Long-press a name to report it.</div>
      </div>
      <div style={{ ...footer, display: 'flex', gap: 10 }}>
        <Secondary style={{ flex: 1 }} onClick={leave}>Leave</Secondary>
        <Secondary style={{ flex: 1 }} onClick={() => setPicking(true)}>Change my topic</Secondary>
      </div>
    </div>
  )
}
