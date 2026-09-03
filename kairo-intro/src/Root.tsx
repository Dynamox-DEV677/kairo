/**
 * Remotion composition registry.
 *
 * Add new compositions here (e.g. a 15-second cutdown for socials)
 * and they'll show up in the studio + be renderable by name.
 */
import './style.css'
import { Composition } from 'remotion'
import KairoIntro from './KairoIntro'
import KairoIndustries, { KI_FPS, KI_DURATION_F } from './KairoIndustries'
import KairoLoaderClip from './KairoLoaderClip'
import KairoTeaser, { KAIRO_TEASER_DURATION_F } from './KairoTeaser'
import KynoSting, { KYNO_STING_FPS, KYNO_STING_DURATION_F } from './KynoSting'
import KynoTeaser2, { KYNO_TEASER2_FPS, KYNO_TEASER2_DURATION_F } from './KynoTeaser2'
import KynoCameraDemo, { CAM_FPS, CAM_DURATION_F } from './KynoCameraDemo'
import FounderReel, { FR_FPS, FR_DURATION_F } from './FounderReel'
import KairoAd from './kairo-ad/KairoAd'
import { FPS as AD_FPS, DURATION_F as AD_DURATION_F, WIDTH as AD_W, HEIGHT as AD_H } from './kairo-ad/constants/timeline'
import { FPS, DURATION_F, WIDTH, HEIGHT } from './config/timing'

// One loop of the dashboard loader is ~8s. We render a hair over that
// (8.5s = 510 frames) so the final fade settles cleanly before cut.
const LOADER_DURATION_F = Math.round(FPS * 8.5)

export const RemotionRoot = () => (
  <>
    {/* Clean 6s company intro — the Kairo Industries mark, nothing else. */}
    <Composition
      id="KairoIndustries"
      component={KairoIndustries}
      durationInFrames={KI_DURATION_F}
      fps={KI_FPS}
      width={WIDTH}
      height={HEIGHT}
    />
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

    {/* Kyno brand videos — self-contained, real app icon + real web palette. */}
    <Composition
      id="KynoSting"
      component={KynoSting}
      durationInFrames={KYNO_STING_DURATION_F}
      fps={KYNO_STING_FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="KynoTeaser2"
      component={KynoTeaser2}
      durationInFrames={KYNO_TEASER2_DURATION_F}
      fps={KYNO_TEASER2_FPS}
      width={1920}
      height={1080}
    />

    {/* Vertical 9:16 Short for Reels/Shorts — live Camera Study Mode demo. */}
    <Composition
      id="KynoCameraDemo"
      component={KynoCameraDemo}
      durationInFrames={CAM_DURATION_F}
      fps={CAM_FPS}
      width={1080}
      height={1920}
    />
    {/* KAIRO INDUSTRIES launch film — 3D titanium mark, particle assemble,
        knowledge lattice, verb sequence, endplate. See src/kairo-ad/README.md.
        Preview fast with heavyFx=false; render final with the default. */}
    <Composition
      id="KairoAd"
      component={KairoAd}
      durationInFrames={AD_DURATION_F}
      fps={AD_FPS}
      width={AD_W}
      height={AD_H}
      defaultProps={{ heavyFx: true }}
    />

    {/* Overlay-only graphics for the founder video. Rendered transparent and
        ffmpeg-composited over public/founder-base.mp4 (no OffthreadVideo → no flicker). */}
    <Composition
      id="FounderReel"
      component={FounderReel}
      durationInFrames={FR_DURATION_F}
      fps={FR_FPS}
      width={1080}
      height={1920}
    />
  </>
)
