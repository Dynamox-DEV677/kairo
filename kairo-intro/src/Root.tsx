/**
 * Remotion composition registry.
 *
 * Add new compositions here (e.g. a 15-second cutdown for socials)
 * and they'll show up in the studio + be renderable by name.
 */
import './style.css'
import { Composition } from 'remotion'
import KairoIntro from './KairoIntro'
import { FPS, DURATION_F, WIDTH, HEIGHT } from './config/timing'

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
  </>
)
