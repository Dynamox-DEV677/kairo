import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import * as THREE from 'three'
import LabScene from './LabScene'

export interface LabPart {
  id:           string
  label:        string
  color:        string
  function:     string
  whyItMatters: string
  analogy:      string
  related:      string[]
}

export type MaterialMap = Record<string, string>

export type PartCatalog = Record<string, LabPart>

export type PartAnimator = (meshes: THREE.Mesh[], elapsed: number, dt: number) => void

export function useInteractiveGLB(
  url: string,
  materialMap: MaterialMap,
  targetSize: number = 5,
  membraneId?: string,
) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const cloned = scene.clone(true)

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
            o.material.opacity = partId === membraneId ? 0.20 : 0.95
          }
          if (o.material.emissive && o.material.color) {
            o.material.emissive          = o.material.color.clone().multiplyScalar(0.25)
            o.material.emissiveIntensity = 0.3
          }
        }
      }
    })

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

    const scaledBox = new THREE.Box3()
    cloned.traverse((o: any) => { if (o.isMesh && o.geometry) scaledBox.union(new THREE.Box3().setFromObject(o)) })
    const center = new THREE.Vector3()
    scaledBox.getCenter(center)
    cloned.position.sub(center)

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

interface InteractiveGLBLabProps {
  url:          string
  materialMap:  MaterialMap
  catalog:      PartCatalog
  membraneId?:  string
  cameraPos?:   [number, number, number]
  cameraFov?:   number
  tint?:        string
  hint?:        string
  particles?:   number
  stars?:       boolean
  animators?:   Record<string, PartAnimator>
  extraScene?:  ReactNode
  autoRotate?:  boolean
  targetSize?:  number
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

function InteractiveModel({
  url, materialMap, catalog, membraneId, targetSize,
  hovered, selected, onHover, onSelect,
  playing, animators,
}: any) {
  const { cloned, meshesByPart, pickPartId } = useInteractiveGLB(url, materialMap, targetSize, membraneId)
  const groupRef = useRef<THREE.Group>(null)

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
      border: '1px solid rgba(124, 107, 246, 0.25)',
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

export const LAB_PALETTE = {
  biology:   '#1a1830',
  chemistry: '#1a0a18',
  physics:   '#0c1428',
  math:      '#0a0a18',
  space:     '#02041a',
  nucleus:    '#A5B4FC',
  power:      '#dc2626',
  storage:    '#67e8f9',
  shipping:   '#34d399',
  digestion:  '#f472b6',
  structure:  '#fde68a',
  signal:     '#C7D2E8',
  control:    '#cbd5e1',
  energy:     '#86efac',
  fluid:      '#9AA6FF',
}

export { LabScene }
