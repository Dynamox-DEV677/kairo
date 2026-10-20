/**
 * The one place that names Groq's image-reading model.
 *
 * It used to be written out in four files. On 2026-09-14 Groq shut down
 * qwen/qwen3.6-27b, and every one of them started getting 404 "model does not
 * exist": Camera Study, Snap-and-Solve, the formula reader, the whiteboard
 * check and scanned-PDF reading all failed for five weeks. Students were told
 * "We've been alerted", and nobody was, because these routes answered 502
 * themselves and never reported anything.
 *
 * Two changes so it cannot happen quietly again:
 *
 *   1. One list, here. GROQ_VISION_MODEL (a Vercel env var) still overrides it
 *      without a deploy, and the list is tried in order.
 *   2. A retired model is reported as a fault the first time it 404s, so the
 *      next retirement arrives as an email rather than a screenshot.
 *
 * Successor per Groq's deprecations page: qwen/qwen3.8-27b, multimodal, same
 * 131K context, GA. Like the model it replaces it is a reasoning model and may
 * emit a <think> block before the answer, which every caller already strips.
 */

import { reportFault } from '../services/alert.js'

export const DEFAULT_VISION_MODEL = 'qwen/qwen3.8-27b'

/** Tried in order: the env override first, then the default. */
export function visionModels(env = process.env) {
  return [...new Set([env.GROQ_VISION_MODEL, DEFAULT_VISION_MODEL].map(m => String(m || '').trim()).filter(Boolean))]
}

/** The model to use right now (the first one that has not been found retired). */
let retired = new Set()
export function visionModel(env = process.env) {
  const all = visionModels(env)
  return all.find(m => !retired.has(m)) ?? all[all.length - 1]
}

/**
 * Did this failure mean "that model is gone", as opposed to busy or broken?
 * Groq answers a retired id with 404 and code model_not_found.
 */
export function isRetiredModel(status, body = '') {
  return status === 404 || /model_not_found|does not exist|decommissioned/i.test(String(body))
}

/** Stop using a model for the life of this instance, and tell a human. */
export function retireVisionModel(model, route, detail = '') {
  retired.add(model)
  reportFault({
    route,
    status: 404,
    message: `Groq vision model "${model}" is gone (404 / model_not_found). Every image feature is failing until server/lib/visionModel.js names a live model. ${String(detail).slice(0, 200)}`,
  })
}

/** For tests: forget what has been retired. */
export function _resetVisionModels() {
  retired = new Set()
}
