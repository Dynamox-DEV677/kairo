# Kairo · Hype Reel · Remotion

The 40-second Kairo OS launch reel, built in **Remotion** so it renders to a
real MP4 with full control over every animation. Theme matches the Canva
file (`DAHJqrhgIss`) 1:1 — purple gradient over pure black, white 4-point
sparkles, big punchy text beats.

## Quick start

```bash
cd kairo-video
npm install
npm run dev          # opens the Remotion studio at http://localhost:3000
npm run render       # renders 1920×1080 MP4 → out/kairo-reel.mp4
npm run render:vertical   # 1080×1920 portrait for Reels / TikTok / Shorts
```

## Structure

```
kairo-video/
├── public/
│   └── kairo_logo.png        ← real Kairo leaves logo (copied from dashboard)
├── src/
│   ├── index.ts              ← registers <Root>
│   ├── Root.tsx              ← composition: 1920×1080 + 1080×1920 variants
│   ├── theme.ts              ← palette, font, FPS, sec() helper
│   ├── components/
│   │   ├── Aura.tsx          ← slow-panning purple radial wash
│   │   ├── Sparkle.tsx       ← single 4-point star with pulse + rotate + drift
│   │   ├── SparkleField.tsx  ← scatter of 6 sparkles (4 corners + 2 mid)
│   │   ├── BigBeat.tsx       ← one word, springs in / blurs out
│   │   └── DashboardMock.tsx ← vector phone mockup of Kairo OS dashboard
│   └── scenes/
│       ├── HookScene.tsx       0:00–0:06  WANNA SEE SOMETHING COOL MEET kairo
│       ├── PitchScene.tsx      0:06–0:11  YOUR · AI ACADEMIC · TWIN
│       ├── DashboardScene.tsx  0:11–0:21  Mockup slides in, "IT LEARNS HOW YOU STUDY" types
│       ├── FeaturesScene.tsx   0:21–0:31  3D LABS · AI SOLVER · BATTLE · FLASHCARDS
│       ├── CompareScene.tsx    0:31–0:38  BYJU's / Khan / **KAIRO**
│       └── CTAScene.tsx        0:38–0:43  Logo · "kairo" wordmark · kairo.app
```

Total: **43 s** (close enough to the 40 s target; just trim the final
`CTAScene` from 150 → 120 frames if you want exactly 40).

## How the timing was tuned

Every scene exports a `*_DURATION` constant in frames at 30 fps. Edit a
constant to shorten/lengthen any beat without touching the rest of the
timeline. `Root.tsx` sums them automatically.

## Swapping the theme

All colours live in `src/theme.ts` (`C` for solids, `GRAD` for gradients).
Change one constant and every scene picks it up.

## Customising for your dashboard

`components/DashboardMock.tsx` draws the phone preview entirely in SVG —
no screenshot needed. Edit the metrics (score, streak, retention, heatmap
chips) right in that file and re-render.
