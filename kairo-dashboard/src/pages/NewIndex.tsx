/**
 * #/new -- the temporary door into the seven-spaces redesign.
 *
 * Reached from one deliberately dull row at the bottom of the old drawer, so
 * the new screens can be opened on a phone without typing a URL. Lists the
 * finished spaces and nothing else. Deleted in the cutover commit, along with
 * the row that leads here.
 */
import { ChevronRight } from 'lucide-react'
import { T, FONT, ICON } from '../lib/spaceTokens'
import { SPACES } from '../lib/spaces'

export default function NewIndex({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 14px 24px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: T.accent, textTransform: 'uppercase' }}>New design · preview</div>
        <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: '10px 0 0' }}>
          Work in progress. The old app is untouched — use the menu above for anything real.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          {SPACES.map(s => {
            const Icon = s.icon
            return (
              <button key={s.id} onClick={() => onOpen(s.id)} style={{
                minHeight: 64, width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                borderRadius: 16, background: T.surface, border: `1px solid ${T.border}`, color: T.text,
                fontFamily: FONT, cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, background: T.accentSurface, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={T.accentPale} {...ICON} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{s.label}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: T.dim, marginTop: 2 }}>{s.sub}</span>
                </span>
                <ChevronRight size={18} color={T.faint} {...ICON} />
              </button>
            )
          })}
        </div>

        <p style={{ fontSize: 12, color: T.faint, lineHeight: 1.5, margin: '22px 0 0' }}>
          These screens read the same notes, cards and mistakes as the old ones. {SPACES.length} of seven spaces are finished; when all seven are, the menu switches over.
        </p>
      </div>
    </div>
  )
}
