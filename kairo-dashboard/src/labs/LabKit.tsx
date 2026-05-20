/**
 * LabKit — the Kairo Labs Style System.
 *
 * One file = everything you need to ship a new GLB-backed interactive lab.
 *
 * THE WORKFLOW:
 *
 *   1. Find a great GLB (Sketchfab / Smithsonian 3D / Khronos samples / etc.)
 *   2. Drop it in /models-cdn/ and push (jsDelivr serves it free)
 *   3. Write a MaterialMap + PartCatalog for it
 *   4. Render <InteractiveGLBLab url=... map=... catalog=... />
 *   5. Done. You get: cinematic scene, hover glow, click info card,
 *      auto-rotate, mobile touch, ATP-style particles, animation hooks.
 *
 *  ┌────────────────────────────────────────────────────────────────────┐
 *  │                          LabShell (existing)                        │
 *  │  ┌──────────────────────────┐   ┌─────────────────────────────────┐ │
 *  │  │   InteractiveGLBLab      │   │   AI explanation panel          │ │
 *  │  │   ─────────────────      │   │   ───────────────────           │ │
 *  │  │   LabScene wrapper       │   │   reacts to params              │ │
 *  │  │   ↓                      │   │                                 │ │
 *  │  │   useInteractiveGLB hook │   │                                 │ │
 *  │  │   ↓ groups meshes by mat │   │                                 │ │
 *  │  │   <primitive object={…}> │   │                                 │ │
 *  │  │   hover/click handlers   │   │                                 │ │
 *  │  │   ↓                      │   │                                 │ │
 *  │  │   <PartInfoCard>         │   │                                 │ │
 *  │  └──────────────────────────┘   └─────────────────────────────────┘ │
 *  └────────────────────────────────────────────────────────────────────┘
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import * as THREE from 'three'
import LabScene from './LabScene'

// ════════════════════════════════════════════════════════════════════════════
// TYPES — the contract every lab fills in
// ════════════════════════════════════════════════════════════════════════════

/** One interactive part of the model (organelle, organ, part, etc.). */
export interface LabPart {
  id:           string
  label:        string
  color:        string             // highlight emissive + chip accent
  function:     string             // 1 sentence, plain English
  whyItMatters: string             // 1 sentence — why a student should care
  analogy:      string             // exam-friendly mnemonic
  related:      string[]           // 2-5 process names students will see in textbooks
}

/** Material-name → part-id mapping. Material names come from the GLB exporter.
 *  Always include lower-case keys; we lower-case the lookup automatically. */
export type MaterialMap = Record<string, string>

/** Part-id → catalog entry. Keys are the SAME ids used in MaterialMap values. */
export type PartCatalog = Record<string, LabPart>

/** Optional per-part animation hook — called on every frame for meshes that
 *  belong to this part. Use it for pulse/rotate/glow effects. */
export type PartAnimator = (meshes: THREE.Mesh[], elapsed: number, dt: number) => void

// ════════════════════════════════════════════════════════════════════════════
// useInteractiveGLB — the workhorse hook
// ════════════════════════════════════════════════════════════════════════════
/**
 * Loads a GLB, clones the scene, fits it to a target size, groups meshes by
 * the supplied material map, and manages hover/select state.
 *
 * Returns:
 *   - cloned: the THREE.Group ready to drop into the scene as <primitive>
 *   - meshesByPart: { [partId]: THREE.Mesh[] }   for animations or overrides
 *   - pickPartId(mesh): figure out which part a clicked mesh belongs to
 */
export function useInteractiveGLB(
  url: string,
  materialMap: MaterialMap,
  targetSize: number = 5,
  membraneId?: string,    // if set, this part renders as a translucent shell
) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const cloned = scene.clone(true)

    // Walk and prep meshes: enable shadows, set base material state.
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        if (o.material && !o.userData.origEmissive) {
          o.userData.origEmissive          = o.material.emissive ? o.material.emissive.clone() : new THREE.Color('#000')
          o.userData.origEmissiveIntensity = o.material.emissiveIntensity ?? 0
          if ('transparent' in o.material) {
            o.material.transparent = true
            const matKey = (o.material.name || '').toLowerCase()
            const partId = materialMap[matKey]
            // Membrane / shell gets see-through baseline so we can see inside
            o.material.opacity = partId === membraneId ? 0.20 : 0.95
          }
          // Bump base emissive so even un-hovered parts have a subtle bio-glow
          if (o.material.emissive && o.material.color) {
            o.material.emissive          = o.material.color.clone().multiplyScalar(0.25)
            o.material.emissiveIntensity = 0.3
          }
        }
      }
    })

    // Mesh-only bounds — never trust Box3.setFromObject() on rigged GLBs
    // (skeletal empties + bones inflate the box, fit-factor → tiny model)
    const meshBox = new THREE.Box3()
    let meshCount = 0
    cloned.traverse((o: any) => {
      if (o.isMesh && o.geometry) {
        meshBox.union(new THREE.Box3().setFromObject(o))
        meshCount++
      }
    })
    const box = meshCount > 0 ? meshBox : new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.y, size.z) || 1
    cloned.scale.setScalar(targetSize / longest)

    // Re-center on origin (mesh-only) after scaling
    const scaledBox = new THREE.Box3()
    cloned.traverse((o: any) => { if (o.isMesh && o.geometry) scaledBox.union(new THREE.Box3().setFromObject(o)) })
    const center = new THREE.Vector3()
    scaledBox.getCenter(center)
    cloned.position.sub(center)

    // Group meshes by part id for fast highlight + animation access
    const meshesByPart: Record<string, THREE.Mesh[]> = {}
    cloned.traverse((o: any) => {
      if (o.isMesh && o.material) {
        const matKey = (o.material.name || '').toLowerCase()
        const partId = materialMap[matKey]
        if (partId) {
          meshesByPart[partId] ??= []
          meshesByPart[partId].push(o)
        }
      }
    })

    function pickPartId(mesh: any): string | null {
      if (!mesh?.material) return null
      return materialMap[(mesh.material.name || '').toLowerCase()] || null
    }

    return { cloned, meshesByPart, pickPartId }
  }, [scene, materialMap, targetSize, membraneId])
}

// ════════════════════════════════════════════════════════════════════════════
// InteractiveGLBLab — the full lab in one component
// ════════════════════════════════════════════════════════════════════════════
interface InteractiveGLBLabProps {
  url:          string
  materialMap:  MaterialMap
  catalog:      PartCatalog
  membraneId?:  string                       // which part is the "see-through shell"
  cameraPos?:   [number, number, number]
  cameraFov?:   number
  tint?:        string
  /** Idle hint shown top-left when nothing is hovered/selected. */
  hint?:        string
  /** Particle count for the ambient cytoplasm/atmosphere drift. */
  particles?:   number
  /** Show ambient backdrop stars (off for "inside a cell" / "inside a circuit"). */
  stars?:       boolean
  /** Per-part animation hooks. Called every frame for that part's meshes. */
  animators?:   Record<string, PartAnimator>
  /** Extra <Canvas> children injected after the model (e.g. ATP particles). */
  extraScene?:  ReactNode
  /** Whether the scene auto-rotates when no part is hovered/selected. */
  autoRotate?:  boolean
  /** Target world-units size for the GLB (longest axis). */
  targetSize?:  number
  /** Whether the sim is currently playing (animations on/off). */
  playing?:     boolean
}

export default function InteractiveGLBLab({
  url, materialMap, catalog, membraneId,
  cameraPos = [5, 3.5, 7.5], cameraFov = 50,
  tint = '#1a1830', hint, particles = 80, stars = false,
  animators, extraScene, autoRotate = true, targetSize = 5, playing = true,
}: InteractiveGLBLabProps) {
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene
        cameraPos={cameraPos} cameraFov={cameraFov}
        tint={tint} particles={particles} stars={stars}
      >
        <Suspense fallback={null}>
          <InteractiveModel
            url={url} materialMap={materialMap} catalog={catalog}
            membraneId={membraneId} targetSize={targetSize}
            hovered={hovered} selected={selected}
            onHover={setHovered} onSelect={setSelected}
            playing={playing} animators={animators}
          />
        </Suspense>

        <ContactShadows position={[0, -2.7, 0]} opacity={0.35} scale={10} blur={2.5} far={5} />

        {extraScene}

        <OrbitControls
          enablePan={false}
          minDistance={3} maxDistance={20}
          enableDamping dampingFactor={0.08}
          autoRotate={autoRotate && !selected && !hovered}
          autoRotateSpeed={0.4}
        />
      </LabScene>

      <HoverChip hovered={hovered} selected={selected} catalog={catalog} />
      <IdleHint  hovered={hovered} selected={selected} hint={hint} />

      <AnimatePresence>
        {selected && catalog[selected] && (
          <PartInfoCard part={catalog[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── The model wrapper, separated so the hook re-runs on cache hits ────────
function InteractiveModel({
  url, materialMap, catalog, membraneId, targetSize,
  hovered, selected, onHover, onSelect,
  playing, animators,
}: any) {
  const { cloned, meshesByPart, pickPartId } = useInteractiveGLB(url, materialMap, targetSize, membraneId)
  const groupRef = useRef<THREE.Group>(null)

  // Apply hover/selected emissive whenever they change
  useEffect(() => {
    Object.entries(meshesByPart).forEach(([partId, meshes]) => {
      const isHover    = partId === hovered
      const isSelected = partId === selected
      const isDimmed   = !!selected && !isSelected
      const info       = catalog[partId] as LabPart | undefined
      ;(meshes as THREE.Mesh[]).forEach((m: any) => {
        if (!m.material) return
        if (isHover || isSelected) {
          m.material.emissive          = new THREE.Color(info?.color || '#ffffff')
          m.material.emissiveIntensity = isSelected ? 1.8 : 1.0
          m.material.opacity           = partId === membraneId ? 0.28 : 1.0
        } else {
          m.material.emissive          = m.userData.origEmissive || new THREE.Color('#000')
          m.material.emissiveIntensity = m.userData.origEmissiveIntensity ?? 0
          if (m.material.transparent) {
            m.material.opacity = partId === membraneId
              ? (isDimmed ? 0.10 : 0.20)
              : (isDimmed ? 0.4 : 0.95)
          }
        }
      })
    })
  }, [hovered, selected, meshesByPart, membraneId, catalog])

  // Whole-cell sway + per-part animators
  useFrame((state, dt) => {
    if (!playing || !groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.position.y = Math.sin(t * 0.6) * 0.05

    if (animators) {
      for (const [partId, animator] of Object.entries(animators)) {
        const meshes = meshesByPart[partId]
        if (meshes && animator) (animator as PartAnimator)(meshes, t, dt)
      }
    }
  })

  return (
    <group
      ref={groupRef}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        const id = pickPartId(e.object)
        if (id) {
          onHover(id)
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={() => {
        onHover(null)
        document.body.style.cursor = 'default'
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        const id = pickPartId(e.object)
        if (id) onSelect(id)
      }}
    >
      <primitive object={cloned} />
    </group>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Standard overlay components — reuse across every lab for identity
// ════════════════════════════════════════════════════════════════════════════
export function PartHoverChip({ hovered, selected, catalog }: { hovered: string | null; selected: string | null; catalog: PartCatalog }) {
  return <HoverChip hovered={hovered} selected={selected} catalog={catalog} />
}
export function PartIdleHint({ hovered, selected, hint }: { hovered: string | null; selected: string | null; hint?: string }) {
  return <IdleHint hovered={hovered} selected={selected} hint={hint} />
}
export { PartInfoCard }

function HoverChip({ hovered, selected, catalog }: any) {
  return (
    <AnimatePresence>
      {hovered && !selected && (
        <motion.div
          key={hovered}
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{
            position: 'absolute', top: 14, left: 14, zIndex: 10,
            padding: '7px 13px', borderRadius: 8,
            background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(10px)',
            border: `1px solid ${catalog[hovered]?.color || '#444'}44`,
            fontSize: 11, color: '#fafafa', fontWeight: 700, letterSpacing: 0.4,
            pointerEvents: 'none',
          }}>
          {catalog[hovered]?.label || hovered}
          <span style={{ color: '#9CA3AF', fontWeight: 500, marginLeft: 8 }}>· click to learn more</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function IdleHint({ hovered, selected, hint }: any) {
  if (hovered || selected) return null
  return (
    <div style={{
      position: 'absolute', top: 14, left: 14, zIndex: 5,
      padding: '6px 12px', borderRadius: 7,
      background: 'rgba(13,13,13,0.55)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(79, 124, 255, 0.25)',
      fontSize: 10.5, color: '#A5B4FC', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: 1.5,
      pointerEvents: 'none',
    }}>
      <Sparkles size={10} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
      {hint || 'Hover any part · click for details'}
    </div>
  )
}

function PartInfoCard({ part, onClose }: { part: LabPart; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'absolute', left: 16, bottom: 16, zIndex: 10,
        width: 'min(340px, calc(100% - 32px))',
        background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(14px)',
        border: `1px solid ${part.color}55`,
        borderRadius: 14,
        boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 24px ${part.color}22`,
        padding: 16, color: '#fafafa',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: part.color, boxShadow: `0 0 12px ${part.color}` }} />
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>{part.label}</div>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9CA3AF', padding: 4, display: 'flex',
        }}>
          <X size={15} />
        </button>
      </div>

      <Field label="Function" body={part.function} />
      <Field label="Why it matters" body={part.whyItMatters} />
      <Field label="Real-world analogy" body={part.analogy} />

      {part.related.length > 0 && <>
        <div style={{ fontSize: 10, color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 }}>
          Related processes
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {part.related.map(r => (
            <span key={r} style={{
              padding: '3px 8px', borderRadius: 100,
              background: `${part.color}14`, border: `1px solid ${part.color}33`,
              color: part.color, fontSize: 10.5, fontWeight: 600,
            }}>{r}</span>
          ))}
        </div>
      </>}
    </motion.div>
  )
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
        {label}
      </div>
      <p style={{ fontSize: 12.5, color: '#e4e4e7', margin: 0, lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE TOKENS — the Kairo Labs design system, in one place
// ════════════════════════════════════════════════════════════════════════════
export const LAB_PALETTE = {
  // Subject-tinted backgrounds
  biology:   '#1a1830',
  chemistry: '#1a0a18',
  physics:   '#0c1428',
  math:      '#0a0a18',
  space:     '#02041a',
  // Part-color recommendations (use for catalog entry colors)
  nucleus:    '#66D9FF',
  power:      '#dc2626',   // power-related parts (mitochondria, batteries, suns)
  storage:    '#67e8f9',   // vacuoles, capacitors
  shipping:   '#34d399',   // golgi, conveyors
  digestion:  '#f472b6',   // lysosomes, stomachs
  structure:  '#fde68a',   // cytoskeleton, bones, frames
  signal:     '#C7D2E8',   // membranes, wires, nerve fibres
  control:    '#cbd5e1',   // centrioles, controllers
  energy:     '#86efac',   // vesicles, electrons
  fluid:      '#22d3ee',   // blood, water, plasma
}

// Re-exports for ergonomic imports elsewhere
export { LabScene }
