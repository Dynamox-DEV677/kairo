# KAIRO INDUSTRIES — Launch Film

A 33.6-second vertical launch film. Pure black, brushed titanium, no colour.

**Composition id:** `KairoAd` · 1080×1920 · 60 fps · 2016 frames

---

## Run

```bash
npm start                     # Remotion studio
npx remotion render KairoAd out/kairo-industries.mp4
```

**2K delivery (what ships):**
```bash
npx remotion render KairoAd out/kairo-industries-2k.mp4 --scale=1.3333 --crf=15
```

**Fast preview** — bypasses bloom + depth-of-field, which are the expensive passes:
```bash
npx remotion render KairoAd out/preview.mp4 --props='{"heavyFx":false}'
```

---

## Structure

```
src/kairo-ad/
├─ KairoAd.tsx                  composition root — canvas, grade, type layers
├─ constants/
│  ├─ theme.ts                  palette, PBR material spec, extrusion profile, type stack
│  ├─ timeline.ts               single source of truth for every shot boundary
│  └─ logoContours.ts           AUTO-GENERATED vector contours of the mark
├─ lib/
│  ├─ easing.ts                 cinematic curves, deterministic hash, micro-drift
│  └─ logoGeometry.ts           contours → beveled ExtrudeGeometry + outline sampling
└─ components/
   ├─ three/
   │  ├─ CameraRig.tsx          the shot list: dolly, orbit, lens
   │  ├─ StudioRig.tsx          key/fill/kicker + generated HDRI + specular sweep
   │  ├─ TitaniumLogo.tsx       three extrusions, energy→metal material transition
   │  ├─ MetallicDust.tsx       1400 instances; atmosphere AND the assemble
   │  └─ KnowledgeLattice.tsx   the interior pass
   └─ ui/
      └─ CinematicType.tsx      mask-revealed DOM typography
```

Re-pacing the film is a single edit in `constants/timeline.ts` — every component
derives its timing from there.

---

## Shot list

| # | Time | Shot |
|---|------|------|
| 1 | 0.0–5.4 | Black. One light is born. First dust. |
| 2 | 5.4–12.6 | Dust streams in and packs into the mark; energy → titanium. |
| 3 | 12.6–17.8 | The mark seats. A hard specular rake reveals the brushed finish. |
| 4 | 17.8–23.6 | Camera passes **through** the mark into a knowledge lattice. |
| 5 | 23.6–29.4 | Learn · Create · Think · Imagine · Build. One at a time. |
| 6 | 29.4–33.6 | The mark alone. Camera retreats. Endplate. Fade. |

---

## Notes on the build

**The logo is real geometry.** The shipped `kairo-mark.svg` only wraps a raster
PNG, so there was nothing to extrude. `scratchpad/trace_logo.py` recovers true
vector contours from the artwork and writes `constants/logoContours.ts`; those
are extruded with bevels into three independently-animated parts. To regenerate
after a logo change, re-run that script.

**Everything is frame-deterministic.** No `Math.random()`, no `useFrame` — all
motion derives from `useCurrentFrame()` and a hash function. Remotion renders
frames across parallel workers; anything else flickers.

**"Ray traced" is PBR.** WebGL can't ray trace. The look comes from
`MeshPhysicalMaterial` (metalness 1.0, roughness 0.28, clearcoat) reflecting a
studio softbox environment generated to a canvas at runtime — no CDN fetch, so
renders work offline and identically every time.

**No literal books in Scene 4.** Floating notebooks and holograms render as
screensaver in WebGL, which would contradict the brief's own "no clichés". The
interior is an architectural lattice instead — structured knowledge without
illustrating it.

**Post FX are opt-in.** Bloom and DOF are genuinely expensive on integrated
GPUs. The film is composed to read without them; `heavyFx={false}` for previews.

---

## Sound

No audio is bundled. `constants/timeline.ts` exports `AUDIO_CUES` — the mark
list for a composer:

| Time | Cue |
|------|-----|
| 0.0 | sub-bass swell in, −30dB, 4s ramp |
| 5.4 | granular dust rise |
| 12.2 | deep cinematic boom — the mark solidifies |
| 13.1 | tiny metallic impact (cap seats) |
| 14.0 | specular sweep whoosh, low-passed |
| 17.8 | air-pressure drop entering the mark |
| 23.6 | soft synth pad under the verbs |
| 29.4 | pad resolves; last 2s nearly silent |

Mux once scored:
```bash
ffmpeg -i out/kairo-industries-2k.mp4 -i score.wav \
  -c:v copy -c:a aac -b:a 320k -shortest out/kairo-final.mp4
```

---

## Typography

SF Pro Display and Neue Haas Grotesk are licence-locked and can only resolve
from a local install. The stack in `theme.ts` falls back through Geist →
Satoshi → Inter → Segoe UI Variable, all chosen for similar metrics so the
tracking values still read correctly. For exact brand type, install the licensed
face locally or drop a woff2 into `public/` and add an `@font-face`.
