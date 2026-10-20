/**
 * The image model, and what happens when Groq retires it.
 *
 * qwen/qwen3.6-27b was shut down on 2026-09-14 and every image feature in Kyno
 * 404'd for five weeks - camera, Snap-and-Solve, the formula reader, the
 * whiteboard check, scanned PDFs - while students read "We've been alerted"
 * and nobody had been. These pin the fix: one place names the model, nothing
 * still names the retired one, a 404 is recognised as a retirement, and the
 * camera route reports what it cannot handle instead of swallowing it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_VISION_MODEL, visionModels, visionModel, isRetiredModel, retireVisionModel, _resetVisionModels,
} from '../lib/visionModel.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

test('the default is the successor Groq names for the retired model', () => {
  assert.equal(DEFAULT_VISION_MODEL, 'qwen/qwen3.8-27b')
  assert.deepEqual(visionModels({}), ['qwen/qwen3.8-27b'])
})

test('GROQ_VISION_MODEL still overrides without a deploy, and the default stays behind it', () => {
  assert.deepEqual(visionModels({ GROQ_VISION_MODEL: 'x/new-model' }), ['x/new-model', 'qwen/qwen3.8-27b'])
  assert.deepEqual(visionModels({ GROQ_VISION_MODEL: '  ' }), ['qwen/qwen3.8-27b'])
})

test('a 404 / model_not_found is a retirement; busy and broken are not', () => {
  assert.equal(isRetiredModel(404, ''), true)
  assert.equal(isRetiredModel(400, '{"error":{"code":"model_not_found"}}'), true)
  assert.equal(isRetiredModel(400, 'The model `x` does not exist or you do not have access to it.'), true)
  assert.equal(isRetiredModel(429, 'rate limit'), false)
  assert.equal(isRetiredModel(503, 'overloaded'), false)
})

test('a retired model is skipped for the next request', () => {
  _resetVisionModels()
  const env = { GROQ_VISION_MODEL: 'x/old' }
  assert.equal(visionModel(env), 'x/old')
  retireVisionModel('x/old', '/test', 'model_not_found')
  assert.equal(visionModel(env), 'qwen/qwen3.8-27b')
  _resetVisionModels()
})

test('no server route or screen still names the retired model', () => {
  const offenders = []
  const scan = (dir) => {
    for (const f of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = join(dir, f.name)
      if (f.isDirectory()) { if (f.name !== '__tests__' && f.name !== 'node_modules') scan(rel); continue }
      if (!/\.(js|ts|tsx)$/.test(f.name)) continue
      read(rel).split(/\r?\n/).forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
        if (/qwen3\.6-27b/.test(code)) offenders.push(`${rel}:${i + 1}`)
      })
    }
  }
  scan('server'); scan('src')
  assert.deepEqual(offenders, [])
})

test('the camera route uses the shared model, does not retry past Vercel, and reports faults', () => {
  const src = read('server', 'routes', 'cameraLive.js')
  assert.match(src, /from '\.\.\/lib\/visionModel\.js'/)
  assert.doesNotMatch(src, /GROQ_VISION\b/)
  assert.match(src, /CAMERA_DEADLINE_MS = 9000/)
  assert.match(src, /!\/timeout\|abort\/i\.test\(e\.message\)/, 'a timeout is never retried')
  assert.match(src, /reportFault\(\{ route: '\/api\/camera\/analyze'/)
  assert.doesNotMatch(src, /detail: raw/, 'the provider error body stays on the server')
})
