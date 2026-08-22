/**
 * B4 — diagram recall: the honesty gate is the whole point. A low-confidence
 * or thin read must become an honest miss, never a guessed diagram with made-up
 * parts on a student's screen.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiagramResponse, cardsFromDiagram, MIN_PARTS } from '../../src/lib/diagramRecall.core.js'

test('a confident, well-formed diagram parses into a recall set', () => {
  const raw = 'noise ' + JSON.stringify({
    diagramType: 'animal cell',
    confidence: 'high',
    parts: [
      { label: 'Nucleus', clue: 'the control centre near the middle' },
      { label: 'Mitochondrion', clue: 'the bean-shaped energy organelle' },
      { label: 'Cell membrane', clue: 'the outer boundary' },
    ],
  }) + ' trailing'
  const r = parseDiagramResponse(raw)
  assert.equal(r.ok, true)
  assert.equal(r.diagramType, 'animal cell')
  assert.equal(r.parts.length, 3)
  assert.equal(r.parts[0].label, 'Nucleus')
})

test('low confidence is an honest miss, not a guess', () => {
  const r = parseDiagramResponse(JSON.stringify({
    diagramType: 'maybe a heart', confidence: 'low',
    parts: [{ label: 'A', clue: 'x' }, { label: 'B', clue: 'y' }],
  }))
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'low-confidence')
  assert.equal(r.diagramType, 'maybe a heart')  // surfaced as a hint, not asserted
})

test('too few parts is a miss even at high confidence', () => {
  const r = parseDiagramResponse(JSON.stringify({
    diagramType: 'neuron', confidence: 'high', parts: [{ label: 'Axon', clue: 'the long fibre' }],
  }))
  assert.equal(r.ok, false)
  assert.ok(MIN_PARTS >= 2)
})

test('unreadable / non-JSON is a miss', () => {
  assert.equal(parseDiagramResponse('I could not see a diagram').ok, false)
  assert.equal(parseDiagramResponse('').ok, false)
  assert.equal(parseDiagramResponse(null).ok, false)
  assert.equal(parseDiagramResponse('{ broken json').ok, false)
})

test('parts missing a label are dropped, not kept blank', () => {
  const r = parseDiagramResponse(JSON.stringify({
    diagramType: 'plant cell', confidence: 'high',
    parts: [{ label: 'Chloroplast', clue: 'green, does photosynthesis' }, { clue: 'no label here' }, { label: '  ', clue: 'blank' }, { label: 'Cell wall', clue: 'rigid outer layer' }],
  }))
  assert.equal(r.ok, true)
  assert.deepEqual(r.parts.map(p => p.label), ['Chloroplast', 'Cell wall'])
})

test('cards turn parts into clue→label Q/A for Reels + SRS', () => {
  const cards = cardsFromDiagram('animal cell', [
    { label: 'Nucleus', clue: 'the control centre' },
    { label: 'Ribosome', clue: '' },
  ])
  assert.equal(cards.length, 2)
  assert.match(cards[0].front, /animal cell/)
  assert.match(cards[0].front, /control centre/)
  assert.equal(cards[0].back, 'Nucleus')
  assert.equal(cards[0].topic, 'animal cell')
  // A part with no clue still makes a usable card.
  assert.match(cards[1].front, /Name this part/)
})
