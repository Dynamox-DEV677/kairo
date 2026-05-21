# Kairo · Cinematic Launch Intro

48-second premium reveal video. Apple-keynote / OpenAI-launch / Arc /
JARVIS startup aesthetic. Built with [Remotion](https://www.remotion.dev/)
— programmatic React video so every frame is deterministic, every
variable is editable, and the whole thing renders to MP4 via a single
CLI command.

---

## Production plan

### Final feeling
A billion-dollar AI operating system reveal from 2035. Restrained.
Confident. Not loud. The viewer should feel they're watching something
genuinely advanced power on — not a startup logo wipe.

### Constraints
- **Background** `#050505` (true near-black, *not* `#000`)
- **Primary**    `#4F7CFF` (electric blue)
- **Secondary**  `#66D9FF` (cyan)
- **Highlight**  `#A5B4FC` (soft indigo, used at < 12% alpha)
- **Text**       `#FFFFFF`
- **No purple neon, no gaming bloom, no flash-cuts.** All glows clamp
  at `alpha ≤ 0.32`. All transitions are scene-cross-fades, never
  hard cuts.

### Render target
- **1920×1080** · 60 fps · 2880 frames total · ~12 MB H.264 at CRF 18

---

## Timeline

| Scene | Frames     | Seconds   | What happens                                                  |
|-------|------------|-----------|---------------------------------------------------------------|
| 01    | 0 – 360    | 0 – 6     | Pure darkness. Particles fade in. Camera dollies forward.     |
| 02    | 360 – 840  | 6 – 14    | One thin line draws itself. Intelligence waking up.           |
| 03    | 840 – 1320 | 14 – 22   | Lines emerge, connect into orbital paths. Camera orbits.      |
| 04    | 1320 – 1800| 22 – 30   | Lines morph into the Kairo mark. Particle trails follow.      |
| 05    | 1800 – 2280| 30 – 38   | Logo locks. Soft pulse. KAIRO + tagline fade in.              |
| 06    | 2280 – 2640| 38 – 44   | Breathing pulse. Intelligent particles orbit the mark.        |
| 07    | 2640 – 2880| 44 – 48   | Camera dollies in. Final pulse. Freeze on end frame.          |

All frame anchors live in [`src/config/timing.ts`](src/config/timing.ts)
— change one constant, every scene re-aligns.

---

## Camera language

There is no real 3D scene — Remotion is 2D. The camera is *simulated*
by composing three transforms on the root group of each scene:

1. **Dolly** — uniform `scale()` driven by `camera.z`
2. **Pan**   — `translate()` driven by `camera.x`, `camera.y`
3. **Orbit** — `rotate()` around the scene's logical centre
4. **Parallax** — each particle's apparent motion is scaled by its
   depth (`mass`), so foreground particles drift faster than the
   distant field. Sells the illusion of volume.

Camera curves are in [`src/lib/camera.ts`](src/lib/camera.ts) — drop in
new key-frames as Bezier-eased segments and the rig recomposes.

---

## Easing library

The whole intro reads "premium" because every motion uses a curated
bezier — never `linear`, never the default `ease`. See
[`src/lib/easings.ts`](src/lib/easings.ts):

| Name        | Curve                              | Use                                              |
|-------------|------------------------------------|--------------------------------------------------|
| `APPLE`     | `cubic-bezier(0.4, 0, 0.2, 1)`     | Standard UI moves (Apple Material)               |
| `LINEAR_R`  | `cubic-bezier(0.16, 1, 0.3, 1)`    | Linear-app-style snappy reveals                  |
| `CINEMATIC` | `cubic-bezier(0.65, 0.05, 0.36, 1)`| Slow-in, slow-out cinematic transitions          |
| `BREATHE`   | `cubic-bezier(0.45, 0, 0.55, 1)`   | Gentle sinusoidal breathing pulses               |
| `INK`       | `cubic-bezier(0.83, 0, 0.17, 1)`   | Hard-to-fast acceleration (for path draw-ins)    |

---

## Particle system

[`src/primitives/ParticleField.tsx`](src/primitives/ParticleField.tsx)

- **Deterministic**: positions seeded from a Mulberry32 PRNG so renders
  are reproducible across machines and re-runs.
- **Pseudo-3D**: each particle carries `(x, y, z, phase, mass)`. The
  camera projects to 2D every frame.
- **Behaviour modes**: `dawn` (drift slowly upward), `lattice` (snap to
  orbit nodes), `orbital` (rotate around centre), `still` (frozen).
  Scenes pass `mode` + interpolation factor — the field handles the
  blending.
- **Render cost**: 240 particles by default. Each is one `<circle>` —
  no canvas, no WebGL, so it composites cleanly with the SVG line
  geometry.

---

## Logo behaviour

[`src/primitives/KairoMark.tsx`](src/primitives/KairoMark.tsx)

The Kairo mark is a geometric **K** rendered as three SVG paths:
1. Vertical spine
2. Upper diagonal
3. Lower diagonal

Each path has its own `stroke-dasharray` animation, staggered by 80ms
so the K *assembles* in a noticeable left-to-right order during scene
04. A `<radialGradient>` fill kicks in at frame 1860 (scene 05) so the
finished K has the electric-blue → cyan brand gradient. A soft
inner-shadow simulates depth without an outright neon glow.

---

## Text reveal

`KAIRO` and the tagline `YOUR AI EDUCATION SYSTEM` use a *clip-path
sweep*, not opacity. Each letter is masked from below by a moving
rectangle that retreats over 12 frames, with an 80 ms stagger between
glyphs. Feels closer to film typography than fade-up.

Typography: **SF Pro Display** if locally installed, falling back to
**Satoshi** → **Inter** → system sans. Loaded in
[`src/style.css`](src/style.css).

---

## Folder layout

```
kairo-intro/
├── package.json           Remotion + React deps, render scripts
├── remotion.config.ts     1920x1080 · 60fps · H.264 · CRF 18
├── tsconfig.json
├── public/                Optional assets (logo PNG fallback, fonts)
└── src/
    ├── Root.tsx              Registers the <KairoIntro> composition
    ├── KairoIntro.tsx        Sequences the 7 scenes
    ├── style.css             Fonts, base styles
    │
    ├── config/
    │   ├── timing.ts         Frame anchors, FPS, scene boundaries
    │   ├── colors.ts         Brand palette
    │   └── motion.ts         Defaults: stagger, intensity, depth
    │
    ├── lib/
    │   ├── easings.ts        Bezier curve registry
    │   ├── rng.ts            Seedable PRNG
    │   ├── camera.ts         Virtual camera + projection
    │   └── noise.ts          1D simplex for organic drift
    │
    ├── primitives/
    │   ├── ParticleField.tsx One field that behaves differently
    │   │                     per scene via a `mode` prop
    │   ├── GlowLine.tsx      Single line that draws itself in
    │   ├── OrbitalPath.tsx   Ellipse with particle trails
    │   ├── KairoMark.tsx     The K mark + gradient
    │   └── DepthFog.tsx      Radial vignette + ambient tint
    │
    └── scenes/
        ├── Scene01_Dawn.tsx
        ├── Scene02_FirstLine.tsx
        ├── Scene03_Lattice.tsx
        ├── Scene04_Assembly.tsx
        ├── Scene05_Reveal.tsx
        ├── Scene06_Breathe.tsx
        └── Scene07_Zoom.tsx
```

---

## Editable variables

Every knob lives in one of three files:

- **Timing** → `src/config/timing.ts`
  - FPS, total duration, individual scene boundaries (frame ranges).
- **Colors** → `src/config/colors.ts`
  - Six entries. Swap the palette here and the entire intro re-skins.
- **Motion** → `src/config/motion.ts`
  - Particle count, glow intensity, camera curve shape, text stagger.

You should not need to touch scene code to retime, recolor, or
re-pace the intro. The scenes are *consumers* of the configs.

---

## Commands

```bash
# install
cd kairo-intro
npm install

# live preview at localhost:3000 (full timeline scrubbable)
npm start

# render to MP4 — outputs to out/kairo-intro.mp4
npm run render

# render still frame at a given second (for thumbnails / posters)
npm run still -- --time=37
```

---

## Why Remotion (not After Effects)

1. **Reproducible** — same source, same render, every time.
2. **Diff-able** — version controlled, code-reviewed.
3. **Composable** — the `<KairoMark>` here can be re-used directly in
   the dashboard splash without re-cutting.
4. **Programmable** — text content (`YOUR AI EDUCATION SYSTEM`) lives
   in code, easy to localise or A/B test.
5. **Zero licence cost** — matches the $0-budget constraint.

If you ever need the AE version (for an editor to grade colours
beyond what Remotion's compositor can do), the timing JSON in
`src/config/timing.ts` is the source of truth that an AE expression
script can import.
