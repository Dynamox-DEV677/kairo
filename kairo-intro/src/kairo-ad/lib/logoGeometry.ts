/**
 * Builds real extruded geometry for the Kairo mark.
 *
 * The shipped logo asset is a raster wrapped in an SVG, so there was no vector
 * data to extrude. `scratchpad/trace_logo.py` recovers true contours from the
 * PNG; this module turns those contours into beveled ExtrudeGeometry — the mark
 * becomes an engineered metal part rather than a flat texture on a card.
 */
import * as THREE from 'three'
import { LOGO_SHAPES, type Pt } from '../constants/logoContours'
import { EXTRUDE } from '../constants/theme'
import { hash } from './easing'

const toShape = (outer: Pt[], holes: Pt[][]) => {
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  }
  return shape
}

/**
 * One geometry per logo element (orbit ring, mortarboard, inner swoosh) so each
 * can be animated independently during the assemble — they arrive at different
 * times, which is what makes the build-up feel choreographed.
 */
export function buildLogoGeometries(): THREE.ExtrudeGeometry[] {
  return LOGO_SHAPES.map((s) => {
    const geo = new THREE.ExtrudeGeometry(toShape(s.outer, s.holes), { ...EXTRUDE })
    // Centre depth on Z so the part rotates about its own body, not its face.
    geo.translate(0, 0, -EXTRUDE.depth / 2)
    geo.computeVertexNormals()
    return geo
  })
}

/**
 * Points sampled along the logo's contours — the particle system uses these as
 * its destination so the dust visibly *packs into* the mark's silhouette
 * instead of dissolving behind a cross-fade.
 */
export function sampleLogoOutline(count: number): THREE.Vector3[] {
  const segs: { a: THREE.Vector2; b: THREE.Vector2; len: number }[] = []
  let total = 0

  for (const s of LOGO_SHAPES) {
    const rings: Pt[][] = [s.outer, ...s.holes]
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = new THREE.Vector2(...ring[i])
        const b = new THREE.Vector2(...ring[(i + 1) % ring.length])
        const len = a.distanceTo(b)
        if (len < 1e-5) continue
        segs.push({ a, b, len })
        total += len
      }
    }
  }

  // Even arc-length distribution: clumping at dense contour points would make
  // the assembled silhouette read lumpy.
  const out: THREE.Vector3[] = []
  const step = total / count
  let walked = 0
  let idx = 0
  let acc = 0

  for (let n = 0; n < count; n++) {
    const target = n * step
    while (idx < segs.length - 1 && acc + segs[idx].len < target) {
      acc += segs[idx].len
      idx++
    }
    const seg = segs[idx]
    const t = seg.len > 0 ? (target - acc) / seg.len : 0
    const p = seg.a.clone().lerp(seg.b, Math.min(1, Math.max(0, t)))
    // Slight thickness through Z so the packed mark has volume, not a flat wall.
    // Deterministic — Remotion renders frames across parallel workers, so
    // Math.random() here would give each worker different targets and flicker.
    out.push(new THREE.Vector3(p.x, p.y, (hash(n * 7.13 + 1.7) - 0.5) * EXTRUDE.depth * 0.8))
    walked = target
  }
  void walked
  return out
}
