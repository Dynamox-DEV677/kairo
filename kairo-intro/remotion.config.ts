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

Config.setVideoImageFormat('jpeg')
Config.setCodec('h264')
Config.setCrf(18)
Config.setPixelFormat('yuv420p')   // broadest playback compatibility
Config.setChromiumOpenGlRenderer('angle')
Config.setOverwriteOutput(true)
