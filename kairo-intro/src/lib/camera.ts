/**
 * Virtual camera — Remotion is 2D, but the intro reads as 3D because
 * we project a (x, y, z) world space to screen via a simple
 * perspective transform.
 *
 *   Screen.x = world.x * (focal / (focal - cam.z + world.z)) + W/2
 *   Screen.y = world.y * (focal / (focal - cam.z + world.z)) + H/2
 *
 * The scale factor `focal / (focal - cam.z + world.z)` *is* the
 * parallax: things closer to the camera scale up, things further
 * away shrink. Particles with high `z` (distant) drift less when
 * the camera pans, selling the sense of depth.
 *
 * Camera key-frames live in `keyframes` below — append more anchors
 * to change the motion.
 */
import { WIDTH, HEIGHT, SCENES, sceneProgress } from '../config/timing'
import { MOTION } from '../config/motion'
import { APPLE, CINEMATIC } from './easings'

const FOCAL = 800   // lens — smaller = wider FOV, more dramatic depth

export interface CameraState {
  /** World-space camera position. */
  x: number
  y: number
  z: number
  /** Y-axis rotation (degrees). Simulated by rotating the scene. */
  yaw: number
}

/**
 * Returns the camera state for any given frame. Linear interpolation
 * between named anchor poses, with an easing applied so transitions
 * feel intentional.
 */
export function cameraAt(frame: number): CameraState {
  // Pose during each scene — read from the motion config so they're
  // editable in one place. Curves between poses use APPLE for moves
  // and CINEMATIC for the orbit so the rotation has a slower start.
  const pDawn      = sceneProgress('dawn',      frame)
  const pFirstLine = sceneProgress('firstLine', frame)
  const pLattice   = sceneProgress('lattice',   frame)
  const pAssembly  = sceneProgress('assembly',  frame)
  const pReveal    = sceneProgress('reveal',    frame)
  const pZoom      = sceneProgress('zoom',      frame)

  // Z (dolly)
  const z =
    frame < SCENES.dawn.end       ? lerp(MOTION.CAMERA_Z_DAWN_IN,  MOTION.CAMERA_Z_DAWN_OUT,  APPLE(pDawn)) :
    frame < SCENES.firstLine.end  ? lerp(MOTION.CAMERA_Z_DAWN_OUT, MOTION.CAMERA_Z_LATTICE,   APPLE(pFirstLine)) :
    frame < SCENES.lattice.end    ? lerp(MOTION.CAMERA_Z_LATTICE,  MOTION.CAMERA_Z_ASSEMBLY,  APPLE(pLattice)) :
    frame < SCENES.assembly.end   ? lerp(MOTION.CAMERA_Z_ASSEMBLY, MOTION.CAMERA_Z_REVEAL,    APPLE(pAssembly)) :
    frame < SCENES.reveal.end     ? MOTION.CAMERA_Z_REVEAL :
    frame < SCENES.breathe.end    ? MOTION.CAMERA_Z_BREATHE :
                                    lerp(MOTION.CAMERA_Z_BREATHE,  MOTION.CAMERA_Z_FINAL,     CINEMATIC(pZoom))

  // Yaw — scene 03 orbits to MOTION.ORBIT_DEGREES, then scene 04
  // eases back to 0 as the lattice collapses into the K. After
  // assembly, yaw holds at 0 for the reveal / breathe / zoom block
  // so the climax reads stable, not tilted.
  const yaw =
    frame < SCENES.lattice.start  ? 0 :
    frame < SCENES.lattice.end    ? lerp(0, MOTION.ORBIT_DEGREES, CINEMATIC(pLattice)) :
    frame < SCENES.assembly.end   ? lerp(MOTION.ORBIT_DEGREES, 0, APPLE(pAssembly)) :
                                    0

  return { x: 0, y: 0, z, yaw }
}

/** Apply the virtual camera to a 3D point, returning a screen-space {x, y, scale}. */
export function project(world: { x: number; y: number; z: number }, cam: CameraState) {
  const denom = FOCAL - cam.z + world.z
  const scale = FOCAL / denom
  return {
    x: world.x * scale + WIDTH  / 2 - cam.x,
    y: world.y * scale + HEIGHT / 2 - cam.y,
    scale,
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
