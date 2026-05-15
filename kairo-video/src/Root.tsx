/**
 * Root — registers two compositions:
 *   1. KairoReel          — 1920×1080 horizontal (matches your Canva file)
 *   2. KairoReelVertical  — 1080×1920 portrait    (Instagram Reels / TikTok / Shorts)
 *
 * Both share the same Sequence + scene set. The vertical comp swaps the
 * page dimensions via a single prop.
 */
import { Composition, Series } from 'remotion'
import { FPS } from './theme'
import { HookScene,      HOOK_DURATION      } from './scenes/HookScene'
import { PitchScene,     PITCH_DURATION     } from './scenes/PitchScene'
import { DashboardScene, DASHBOARD_DURATION } from './scenes/DashboardScene'
import { FeaturesScene,  FEATURES_DURATION  } from './scenes/FeaturesScene'
import { CompareScene,   COMPARE_DURATION   } from './scenes/CompareScene'
import { CTAScene,       CTA_DURATION       } from './scenes/CTAScene'

const TOTAL =
  HOOK_DURATION + PITCH_DURATION + DASHBOARD_DURATION +
  FEATURES_DURATION + COMPARE_DURATION + CTA_DURATION

const KairoReelMain: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={HOOK_DURATION}>      <HookScene /></Series.Sequence>
    <Series.Sequence durationInFrames={PITCH_DURATION}>     <PitchScene /></Series.Sequence>
    <Series.Sequence durationInFrames={DASHBOARD_DURATION}> <DashboardScene /></Series.Sequence>
    <Series.Sequence durationInFrames={FEATURES_DURATION}>  <FeaturesScene /></Series.Sequence>
    <Series.Sequence durationInFrames={COMPARE_DURATION}>   <CompareScene /></Series.Sequence>
    <Series.Sequence durationInFrames={CTA_DURATION}>       <CTAScene /></Series.Sequence>
  </Series>
)

export const Root: React.FC = () => (
  <>
    <Composition
      id="KairoReel"
      component={KairoReelMain}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="KairoReelVertical"
      component={KairoReelMain}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
)
