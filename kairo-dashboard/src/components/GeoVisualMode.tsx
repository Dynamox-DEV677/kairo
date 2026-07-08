/**
 * Geo Visual Mode — Kora Solver's geography intelligence layout.
 *
 * Replaces the standard Solver result panel when:
 *    • the AI classifies the question as `geography`
 *    • the user has Map mode selected (auto-suggested by default)
 *
 * Layout (desktop):
 *
 *   ┌─────────────────────────┬──────────────────────────┐
 *   │  Interactive Leaflet    │  Cinematic image carousel│
 *   │  map (auto-zoomed)      │  + AI explanation panel  │
 *   │                         │  with structured sections │
 *   ├─────────────────────────┴──────────────────────────┤
 *   │  Mini concept graph (animated nodes + connectors) │
 *   └────────────────────────────────────────────────────┘
 *
 * Layout (mobile):
 *    Map → Images → Sections → Concept graph (collapsible drawer)
 *
 * All map tiles come from OpenStreetMap (free, no API key). Images come
 * from the existing Wikimedia-backed imageSlides array — same pipe the
 * standard Solver uses. The only new server hit is the Wikipedia
 * coordinates resolver (done already during /solver/text).
 */
import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapContainer, TileLayer, CircleMarker, Tooltip, useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Map as MapIcon, Globe, Layers, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, ExternalLink, Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ──────────────────────────────────────────────────────────────────────────
// Types — mirror the SolverResponse shape KairoSolver passes in.
// ──────────────────────────────────────────────────────────────────────────
export interface GeographySection {
  heading: string
  body:    string
}
export interface GeographyData {
  name:     string
  kind:     'region' | 'country' | 'city' | 'river' | 'mountain' | 'desert' | 'forest' | 'ocean' | 'continent' | 'other'
  zoom:     number
  lat:      number | null
  lng:      number | null
  sections: GeographySection[]
  pageUrl:  string | null
}
export interface GeoImageSlide {
  url:         string
  thumb?:      string
  caption:     string
  source:      'wikimedia' | 'pexels' | 'unsplash'
  attribution?: string
  pageUrl?:    string
}

interface GeoVisualModeProps {
  topic:           string
  textExplanation: string
  geography:       GeographyData
  imageSlides:     GeoImageSlide[]
  imagesBusy:      boolean
  relatedConcepts: string[]
  /** Fires when the user clicks a related-concept chip — Solver re-runs the ask. */
  onAskRelated?:   (q: string) => void
}

// ──────────────────────────────────────────────────────────────────────────
// Palette — matches the rest of Kora's dark theme exactly.
// ──────────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#050505',
  surface:   '#151922',
  glass:     'rgba(20, 24, 35, 0.65)',
  border:    'rgba(255, 255, 255, 0.08)',
  borderHi:  'rgba(102, 217, 255, 0.35)',
  primary:   '#4F7CFF',
  secondary: '#66D9FF',
  text:      '#FFFFFF',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"

// ──────────────────────────────────────────────────────────────────────────
// Default coordinates by `kind` — fallback when the Wikipedia resolver
// couldn't return real coordinates (e.g. abstract climate concepts).
// ──────────────────────────────────────────────────────────────────────────
const FALLBACK_COORDS: Record<GeographyData['kind'], { lat: number; lng: number; zoom: number }> = {
  region:    { lat: 20.0, lng:  78.0, zoom: 4 },   // India default
  country:   { lat: 20.0, lng:  78.0, zoom: 5 },
  city:      { lat: 20.0, lng:  78.0, zoom: 10 },
  river:     { lat:  0.0, lng:  20.0, zoom: 4 },
  mountain:  { lat: 28.0, lng:  84.0, zoom: 7 },
  desert:    { lat: 25.0, lng:  10.0, zoom: 5 },
  forest:    { lat: -3.0, lng: -60.0, zoom: 4 },
  ocean:     { lat:  0.0, lng:   0.0, zoom: 3 },
  continent: { lat:  0.0, lng:   0.0, zoom: 3 },
  other:     { lat: 20.0, lng:  78.0, zoom: 4 },
}

// ──────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────
export default function GeoVisualMode({
  topic,
  textExplanation,
  geography,
  imageSlides,
  imagesBusy,
  relatedConcepts,
  onAskRelated,
}: GeoVisualModeProps) {
  // Client-side geocode fallback: when the backend couldn't resolve coords
  // (Wikipedia articles for big natural features often carry no coordinate
  // tag), ask Nominatim from the browser. Until/unless something resolves,
  // we show the kind-default REGION but hide the labeled pin — the old
  // behaviour drew "Amazon Rainforest" on a pin in the middle of India.
  const [resolved, setResolved] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    setResolved(null)
    const q = geography.name || topic
    if (geography.lat != null || !q) return
    let dead = false
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
      .then(r => (r.ok ? r.json() : null))
      .then(arr => {
        if (dead || !Array.isArray(arr) || !arr[0]?.lat) return
        setResolved({ lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) })
      })
      .catch(() => { /* offline — keep fallback view */ })
    return () => { dead = true }
  }, [geography.name, geography.lat, topic])

  const located = geography.lat != null || resolved != null
  const effectiveLat = geography.lat ?? resolved?.lat ?? FALLBACK_COORDS[geography.kind].lat
  const effectiveLng = geography.lng ?? resolved?.lng ?? FALLBACK_COORDS[geography.kind].lng
  const effectiveZoom = geography.zoom || FALLBACK_COORDS[geography.kind].zoom

  return (
    <div style={{
      width: '100%',
      display: 'grid',
      gap: 14,
      // Desktop: Map | Right-side stack (carousel + explanation). Concept
      // graph stretches across both columns underneath.
      gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.4fr)',
      gridTemplateAreas: `
        "map  right"
        "graph graph"
      `,
      gridTemplateRows: 'minmax(380px, auto) auto',
    }}
      className="ks-geo-grid"
    >
      {/* ── Left: Leaflet map ─────────────────────────────────────────── */}
      <div style={{ gridArea: 'map', minWidth: 0 }}>
        <MapPanel
          name={geography.name || topic}
          kind={geography.kind}
          lat={effectiveLat}
          lng={effectiveLng}
          zoom={effectiveZoom}
          pageUrl={geography.pageUrl}
          located={located}
        />
      </div>

      {/* ── Right: image carousel + structured explanation ────────────── */}
      <div style={{
        gridArea: 'right',
        display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0,
      }}>
        <ImageCarousel slides={imageSlides} busy={imagesBusy} />
        <ExplanationPanel
          name={geography.name || topic}
          textExplanation={textExplanation}
          sections={geography.sections}
        />
      </div>

      {/* ── Bottom: mini concept graph ────────────────────────────────── */}
      <div style={{ gridArea: 'graph', minWidth: 0 }}>
        <ConceptGraphPanel
          center={geography.name || topic}
          related={relatedConcepts}
          onAskRelated={onAskRelated}
        />
      </div>

      {/* Local styles — handle mobile stack + leaflet tile dark filter */}
      <style>{`
        /* Leaflet tiles are light by default; nudge them to match Kora's dark theme. */
        .ks-geo-map .leaflet-tile-pane {
          filter: hue-rotate(190deg) invert(0.92) brightness(0.95) saturate(0.85) contrast(1.05);
        }
        .ks-geo-map .leaflet-container {
          background: ${C.bg};
        }
        .ks-geo-map .leaflet-control-attribution {
          background: rgba(8, 9, 12, 0.7) !important;
          color: ${C.textFaint} !important;
          font-size: 9px !important;
          padding: 1px 5px !important;
        }
        .ks-geo-map .leaflet-control-attribution a {
          color: ${C.secondary} !important;
        }
        .ks-geo-map .leaflet-control-zoom {
          border: 1px solid ${C.border} !important;
          background: ${C.glass} !important;
          backdrop-filter: blur(14px);
          border-radius: 10px !important;
          overflow: hidden;
        }
        .ks-geo-map .leaflet-control-zoom a {
          background: transparent !important;
          color: ${C.text} !important;
          border: none !important;
        }
        .ks-geo-map .leaflet-control-zoom a:hover {
          background: rgba(79, 124, 255, 0.18) !important;
        }
        .ks-geo-map .leaflet-tooltip {
          background: rgba(8, 9, 12, 0.92) !important;
          color: ${C.text} !important;
          border: 1px solid ${C.borderHi} !important;
          border-radius: 8px !important;
          padding: 6px 10px !important;
          font-family: ${FONT};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .ks-geo-map .leaflet-tooltip-top:before,
        .ks-geo-map .leaflet-tooltip-bottom:before,
        .ks-geo-map .leaflet-tooltip-left:before,
        .ks-geo-map .leaflet-tooltip-right:before {
          border-color: transparent !important;
        }

        /* Mobile: stack everything vertically. Concept graph last, taller. */
        @media (max-width: 880px) {
          .ks-geo-grid {
            grid-template-columns: 1fr !important;
            grid-template-areas:
              "map"
              "right"
              "graph" !important;
            grid-template-rows: auto auto auto !important;
          }
        }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Map panel — Leaflet w/ OpenStreetMap tiles, dark-themed via CSS filter.
// ══════════════════════════════════════════════════════════════════════════

interface MapPanelProps {
  name: string
  kind: GeographyData['kind']
  lat:  number
  lng:  number
  zoom: number
  pageUrl: string | null
  /** false = coords are a kind-default guess — hide the labeled pin. */
  located: boolean
}
function MapPanel({ name, kind, lat, lng, zoom, pageUrl, located }: MapPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className="ks-geo-map"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        height: '100%',
        minHeight: 380,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Map header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(79, 124, 255, 0.06) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #4F7CFF, #2046C2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(79, 124, 255, 0.3)',
          }}>
            <Globe size={14} color="#fff" />
          </div>
          <div>
            <div style={{
              fontFamily: FONT, fontSize: 9.5, fontWeight: 700,
              color: C.secondary, textTransform: 'uppercase', letterSpacing: 1.8,
            }}>
              Interactive Map · {kind}
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.text,
              marginTop: 1,
            }}>
              {name}
            </div>
          </div>
        </div>
        {pageUrl && (
          <a href={pageUrl} target="_blank" rel="noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 7,
            background: 'rgba(102, 217, 255, 0.08)',
            border: `1px solid ${C.borderHi}`,
            color: C.secondary, fontFamily: FONT, fontSize: 10.5, fontWeight: 700,
            textDecoration: 'none', letterSpacing: 0.4,
          }}>
            Wiki <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* The map itself */}
      <div style={{ flex: 1, minHeight: 280 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={zoom}
          minZoom={2}
          maxZoom={14}
          scrollWheelZoom
          style={{ width: '100%', height: '100%', minHeight: 280, background: C.bg }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyToOnChange lat={lat} lng={lng} zoom={zoom} />

          {/* Pulsing marker — only when the coords are REAL. Drawing the
              labeled pin on the kind-default fallback centre put "Amazon
              Rainforest" in the middle of India. */}
          {located && (
            <>
              <CircleMarker
                center={[lat, lng]}
                pathOptions={{ color: C.secondary, fillColor: C.primary, fillOpacity: 0.45, weight: 2 }}
                radius={10}
              >
                <Tooltip direction="top" offset={[0, -10]} permanent>
                  {name}
                </Tooltip>
              </CircleMarker>
              <PulseHalo lat={lat} lng={lng} />
            </>
          )}
        </MapContainer>
      </div>
    </motion.div>
  )
}

/**
 * Smoothly fly the map to new coordinates when they change. Without this the
 * map would snap-jump when the user asks a new geography question.
 */
function FlyToOnChange({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 1.4 })
  }, [lat, lng, zoom, map])
  return null
}

/**
 * Animated halo around the marker — re-paints a slowly-growing circle every
 * 1.6s for a subtle "this is alive" pulse. Pure SVG, no extra deps.
 */
function PulseHalo({ lat, lng }: { lat: number; lng: number }) {
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setPulse(p => p + 1), 1600)
    return () => window.clearInterval(id)
  }, [])
  return (
    <CircleMarker
      key={pulse}
      center={[lat, lng]}
      pathOptions={{
        color:       C.secondary,
        fillColor:   C.secondary,
        fillOpacity: 0,
        weight:      1.5,
        opacity:     0.55,
        className:   'ks-geo-pulse',
      }}
      radius={26}
    />
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Image carousel — cinematic fade transitions, glass card frame.
// ══════════════════════════════════════════════════════════════════════════

function ImageCarousel({ slides, busy }: { slides: GeoImageSlide[]; busy: boolean }) {
  const [idx, setIdx] = useState(0)
  const timer = useRef<number | null>(null)

  // Auto-advance every 4 s when more than one slide is available.
  useEffect(() => {
    if (slides.length < 2) return
    if (timer.current) window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      setIdx(i => (i + 1) % slides.length)
    }, 4000)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [slides.length])

  // Snap back if the slide list shrinks under us (new question, fewer images).
  useEffect(() => {
    if (idx >= slides.length) setIdx(0)
  }, [slides.length, idx])

  const current = slides[idx]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        aspectRatio: '16 / 9',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {busy && slides.length === 0 ? (
        <Skeleton label="Loading images…" />
      ) : slides.length === 0 ? (
        <div style={{ color: C.textFaint, fontFamily: FONT, fontSize: 12.5 }}>
          No images found.
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.img
            key={current.url}
            src={current.url}
            alt={current.caption}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
            }}
          />
        </AnimatePresence>
      )}

      {/* Bottom caption ribbon */}
      {current && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '36px 14px 12px',
          background: 'linear-gradient(180deg, transparent 0%, rgba(5, 5, 5, 0.85) 100%)',
          color: C.text, fontFamily: FONT, fontSize: 12, lineHeight: 1.4,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10,
        }}>
          <span style={{ fontWeight: 600 }}>{current.caption}</span>
          {current.attribution && (
            <span style={{ color: C.textFaint, fontSize: 9.5, fontWeight: 500, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
              © {current.attribution}
            </span>
          )}
        </div>
      )}

      {/* Pagination dots */}
      {slides.length > 1 && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', gap: 5,
          padding: '5px 9px', borderRadius: 999,
          background: 'rgba(5, 5, 5, 0.5)', backdropFilter: 'blur(10px)',
          border: `1px solid ${C.border}`,
        }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Image ${i + 1}`}
              style={{
                width: 6, height: 6, borderRadius: '50%', border: 'none',
                background: i === idx ? C.secondary : 'rgba(255, 255, 255, 0.25)',
                cursor: 'pointer', padding: 0,
                transition: 'all 0.2s',
              }} />
          ))}
        </div>
      )}

      {/* Prev / Next arrows — desktop only */}
      {slides.length > 1 && (
        <>
          <CarouselArrow side="left"  onClick={() => setIdx(i => (i - 1 + slides.length) % slides.length)} />
          <CarouselArrow side="right" onClick={() => setIdx(i => (i + 1) % slides.length)} />
        </>
      )}
    </motion.div>
  )
}

function CarouselArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button onClick={onClick} aria-label={side}
      style={{
        position: 'absolute',
        top: '50%', transform: 'translateY(-50%)',
        [side]: 10,
        width: 34, height: 34, borderRadius: '50%',
        background: 'rgba(5, 5, 5, 0.55)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${C.border}`,
        color: C.text, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
        transition: 'all 0.2s',
      } as React.CSSProperties}>
      <Icon size={16} />
    </button>
  )
}

function Skeleton({ label }: { label: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(90deg, rgba(20, 24, 35, 0.6) 0%, rgba(40, 48, 70, 0.9) 50%, rgba(20, 24, 35, 0.6) 100%)',
      backgroundSize: '200% 100%',
      animation: 'ks-shimmer 1.8s linear infinite',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.textFaint, fontFamily: FONT, fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
    }}>
      {label}
      <style>{`@keyframes ks-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Explanation panel — structured sections + general markdown
// ══════════════════════════════════════════════════════════════════════════

function ExplanationPanel({
  name, textExplanation, sections,
}: { name: string; textExplanation: string; sections: GeographySection[] }) {
  // Group sections side-by-side so the right column doesn't feel like an
  // endless scroll. Each card is its own self-contained "fact" tile.
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        flex: 1,
        minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'linear-gradient(135deg, #66D9FF, #4F7CFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={12} color="#0a0a0a" />
        </div>
        <div>
          <div style={{
            fontFamily: FONT, fontSize: 9.5, fontWeight: 700,
            color: C.secondary, textTransform: 'uppercase', letterSpacing: 1.8,
          }}>
            Kora says
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: C.text, marginTop: 1 }}>
            {name}
          </div>
        </div>
      </div>

      {/* Structured sections grid — each as its own glass tile. */}
      {sections.length > 0 ? (
        <div style={{
          display: 'grid', gap: 8,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}>
          {sections.map((s, i) => (
            <SectionCard key={i} heading={s.heading} body={s.body} index={i} />
          ))}
        </div>
      ) : (
        // Fallback when the model didn't emit sections — render the raw
        // markdown so the user still sees the full explanation.
        <div style={{
          fontFamily: FONT, fontSize: 13, color: C.textDim, lineHeight: 1.6,
          maxHeight: 380, overflowY: 'auto', paddingRight: 6,
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {textExplanation}
          </ReactMarkdown>
        </div>
      )}
    </motion.div>
  )
}

function SectionCard({ heading, body, index }: { heading: string; body: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 * index, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        padding: '11px 13px',
        background: 'rgba(255, 255, 255, 0.025)',
        border: `1px solid ${C.border}`,
        borderRadius: 10,
      }}
    >
      <div style={{
        fontFamily: FONT, fontSize: 9.5, fontWeight: 700,
        color: C.secondary, textTransform: 'uppercase', letterSpacing: 1.8,
        marginBottom: 5,
      }}>
        {heading}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.textDim, lineHeight: 1.55 }}>
        {body}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Mini concept graph — animated nodes + connectors at the bottom
// ══════════════════════════════════════════════════════════════════════════

function ConceptGraphPanel({
  center, related, onAskRelated,
}: { center: string; related: string[]; onAskRelated?: (q: string) => void }) {
  // Mobile: collapse to a drawer so it doesn't push the map off-screen.
  const [open, setOpen] = useState(true)

  const items = useMemo(() => related.slice(0, 6), [related])
  const count = items.length || 1

  // Layout — centre node + items arranged in an arc above the centre.
  const W = 800
  const H = 180
  const cx = W / 2
  const cy = H - 26
  const r  = 130

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header / collapser */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '11px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: FONT,
          borderBottom: open ? `1px solid ${C.border}` : 'none',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'rgba(79, 124, 255, 0.12)',
            border: `1px solid ${C.borderHi}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Layers size={12} color={C.secondary} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: C.secondary,
              textTransform: 'uppercase', letterSpacing: 1.8,
            }}>
              Concept Graph
            </div>
            <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginTop: 1 }}>
              How {center} connects to related ideas
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={16} color={C.textFaint} /> : <ChevronDown size={16} color={C.textFaint} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '12px 14px 16px' }}>
              {items.length === 0 ? (
                <div style={{
                  padding: '20px 12px', textAlign: 'center',
                  color: C.textFaint, fontFamily: FONT, fontSize: 12,
                }}>
                  No related concepts yet.
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  width="100%"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ display: 'block' }}
                >
                  {/* Connectors — drawn first so nodes paint over them */}
                  {items.map((_, i) => {
                    const a = -Math.PI + (i + 0.5) / count * Math.PI
                    const tx = cx + Math.cos(a) * r
                    const ty = cy + Math.sin(a) * r
                    return (
                      <motion.line
                        key={'l' + i}
                        x1={cx} y1={cy} x2={tx} y2={ty}
                        stroke="url(#ks-geo-edge)"
                        strokeWidth={1.4}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.7 }}
                        transition={{ duration: 0.6, delay: 0.05 * i, ease: 'easeOut' }}
                      />
                    )
                  })}

                  <defs>
                    <linearGradient id="ks-geo-edge" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%"  stopColor={C.primary} />
                      <stop offset="100%" stopColor={C.secondary} />
                    </linearGradient>
                    <radialGradient id="ks-geo-center" cx="50%" cy="50%" r="50%">
                      <stop offset="0%"  stopColor={C.secondary} stopOpacity="0.55" />
                      <stop offset="100%" stopColor={C.secondary} stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Centre node */}
                  <circle cx={cx} cy={cy} r={50} fill="url(#ks-geo-center)" />
                  <motion.circle
                    cx={cx} cy={cy} r={28}
                    fill={C.primary}
                    stroke="#fff" strokeOpacity={0.35} strokeWidth={1.5}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                  />
                  <text
                    x={cx} y={cy + 4}
                    textAnchor="middle"
                    fontFamily={FONT} fontSize={11} fontWeight={800}
                    fill="#fff"
                    style={{ pointerEvents: 'none' }}
                  >
                    {center.length > 14 ? center.slice(0, 13) + '…' : center}
                  </text>

                  {/* Satellites — clickable chips */}
                  {items.map((label, i) => {
                    const a = -Math.PI + (i + 0.5) / count * Math.PI
                    const tx = cx + Math.cos(a) * r
                    const ty = cy + Math.sin(a) * r
                    return (
                      <motion.g
                        key={'n' + i}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 + 0.05 * i, ease: [0.2, 0.8, 0.2, 1] }}
                        style={{ cursor: onAskRelated ? 'pointer' : 'default' }}
                        onClick={() => onAskRelated?.(label)}
                      >
                        <rect
                          x={tx - 64} y={ty - 14}
                          width={128} height={28}
                          rx={14}
                          fill="rgba(255, 255, 255, 0.05)"
                          stroke={C.borderHi}
                          strokeWidth={1}
                        />
                        <text
                          x={tx} y={ty + 4}
                          textAnchor="middle"
                          fontFamily={FONT} fontSize={11} fontWeight={600}
                          fill={C.text}
                        >
                          {label.length > 17 ? label.slice(0, 16) + '…' : label}
                        </text>
                      </motion.g>
                    )
                  })}
                </svg>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
