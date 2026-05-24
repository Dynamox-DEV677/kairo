/**
 * Remotion composition registry.
 *
 * Add new compositions here (e.g. a 15-second cutdown for socials)
 * and they'll show up in the studio + be renderable by name.
 */
import './style.css'
import { Composition } from 'remotion'
import KairoIntro from './KairoIntro'
import KairoLoaderClip from './KairoLoaderClip'
import KairoTeaser, { KAIRO_TEASER_DURATION_F } from './KairoTeaser'
import { FPS, DURATION_F, WIDTH, HEIGHT } from './config/timing'

// One loop of the dashboard loader is ~8s. We render a hair over that
// (8.5s = 510 frames) so the final fade settles cleanly before cut.
const LOADER_DURATION_F = Math.round(FPS * 8.5)

export const RemotionRoot = () => (
  <>
    <Composition
      id="KairoIntro"
      component={KairoIntro}
      durationInFrames={DURATION_F}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="KairoLoader"
      component={KairoLoaderClip}
      durationInFrames={LOADER_DURATION_F}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* Apple-style ~28s product teaser. Purple opener → blue brand reveal →
        feature montage → tagline → sign-off. */}
    <Composition
      id="KairoTeaser"
      component={KairoTeaser}
      durationInFrames={KAIRO_TEASER_DURATION_F}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
)
