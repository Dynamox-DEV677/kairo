/**
 * Camera choreography.
 *
 * Written as a shot list, not as a single tween: each scene owns a dolly path and
 * a focus target, and the rig blends between them with long ease-outs. Every
 * shot carries micro-drift so no frame is ever perfectly still — that stillness
 * is what makes CG cameras read as CG.
 *
 * Driven entirely by useCurrentFrame (never useFrame), so scrubbing the timeline
 * and rendering in parallel both produce identical results.
 */
import { useLayoutEffect } from 'react'
import { useCurrentFrame } from 'remotion'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SCENE, FPS } from '../../constants/timeline'
import { ramp, progress, microDrift, CINEMA, DRIFT } from '../../lib/easing'

export default function CameraRig() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const { camera } = useThree()

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera

    // ── dolly distance ────────────────────────────────────────────────────
    // Far → mid during the birth, settling as the mark assembles, a slow macro
    // creep through the seat, then the push THROUGH the logo, then retreat.
    // Framing maths: the mark spans ~2 units. In a 9:16 frame the WIDTH is the
    // limiting axis, so horizontal half-angle is atan(0.5625 * tan(fov/2)).
    // Fitting 2.2 units of width needs z ≈ 6.4 at 34° and ≈ 8.5 at 26°. These
    // distances are derived from that, not eyeballed.
    let z: number
    if (t < SCENE.assemble.from) {
      z = ramp(frame, 0, SCENE.awaken.to, 15.5, 11.0, DRIFT)
    } else if (t < SCENE.seat.from) {
      z = ramp(frame, SCENE.assemble.from, SCENE.assemble.to, 11.0, 8.8, CINEMA)
    } else if (t < SCENE.interior.from) {
      // "macro" here means a gentle creep — the whole mark must stay in frame
      z = ramp(frame, SCENE.seat.from, SCENE.seat.to, 8.8, 7.1, CINEMA)
    } else if (t < SCENE.words.from) {
      // through the mark and out the other side
      z = ramp(frame, SCENE.interior.from, SCENE.interior.to, 7.1, -5.4, CINEMA)
    } else if (t < SCENE.signoff.from) {
      z = ramp(frame, SCENE.words.from, SCENE.words.to, -5.4, -9.2, DRIFT)
    } else {
      // swing back around in front of the mark for the endplate
      z = ramp(frame, SCENE.signoff.from, SCENE.signoff.to, 7.8, 9.4, DRIFT)
    }

    // ── orbit ─────────────────────────────────────────────────────────────
    // A slow arc through the assemble so the extrusion depth reads, then held
    // nearly frontal for the endplate (logos resolve better square-on).
    const orbit =
      t < SCENE.interior.from
        ? ramp(frame, SCENE.awaken.to, SCENE.seat.to, -0.52, 0.30, CINEMA)
        : ramp(frame, SCENE.interior.from, SCENE.signoff.to, 0.30, 0.03, DRIFT)

    const height = t < SCENE.interior.from
      ? ramp(frame, 0, SCENE.seat.to, 2.1, 0.22, CINEMA)
      : ramp(frame, SCENE.interior.from, SCENE.signoff.to, 0.22, 0.6, DRIFT)

    // Operator breathing. Amplitude shrinks on the endplate so the last frames
    // feel locked off and final.
    const settle = 1 - progress(frame, SCENE.signoff.from, SCENE.signoff.to, CINEMA) * 0.72
    const d = microDrift(frame, 1.9, 0.055 * settle)

    const radius = Math.abs(z)
    cam.position.set(
      Math.sin(orbit) * radius + d.x,
      height + d.y,
      Math.cos(orbit) * radius * Math.sign(z || 1),
    )

    // Look slightly ahead of the mark during the fly-through so we appear to be
    // travelling into something rather than staring at a wall.
    const lookZ = t > SCENE.interior.from && t < SCENE.signoff.from ? -3.2 : 0
    cam.lookAt(d.x * 0.35, d.y * 0.25, lookZ)

    // ── lens ──────────────────────────────────────────────────────────────
    // Long lens on the macro beats (compression = product photography), wider
    // through the interior so the lattice has scale.
    const fov =
      t < SCENE.interior.from
        ? ramp(frame, SCENE.assemble.from, SCENE.seat.to, 34, 26, CINEMA)
        : t < SCENE.signoff.from
          ? ramp(frame, SCENE.interior.from, SCENE.words.to, 26, 52, CINEMA)
          : ramp(frame, SCENE.signoff.from, SCENE.signoff.to, 38, 30, DRIFT)

    cam.fov = fov
    cam.near = 0.05
    cam.far = 120
    cam.updateProjectionMatrix()
  })

  return null
}
