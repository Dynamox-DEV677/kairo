/**
 * Remotion render configuration for the Kairo cinematic intro.
 *
 * Defaults are tuned for premium-quality H.264 — CRF 18 with the
 * `medium` preset hits a sweet spot of ~10-14 MB for the 48-second
 * 1080p output while staying visually indistinguishable from lossless.
 *
 * Bump to CRF 14 + `slow` preset before a marketing release if file
 * size isn't a concern.
 */
import { Config } from '@remotion/cli/config'

// Transparent-overlay renders (graphics that get ffmpeg-composited over real
// footage) need PNG frames + vp8 + an alpha pixel format. These config values
// otherwise WIN over the CLI flags and silently flatten the alpha, so switch
// them with:  $env:REMOTION_ALPHA='1'  before rendering an overlay comp.
const ALPHA = process.env.REMOTION_ALPHA === '1'

Config.setVideoImageFormat(ALPHA ? 'png' : 'jpeg')
Config.setCodec(ALPHA ? 'vp8' : 'h264')
Config.setCrf(18)
Config.setPixelFormat(ALPHA ? 'yuva420p' : 'yuv420p')   // broadest playback compatibility
Config.setChromiumOpenGlRenderer('angle')
Config.setOverwriteOutput(true)
