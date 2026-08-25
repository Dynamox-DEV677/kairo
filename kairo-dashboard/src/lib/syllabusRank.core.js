/**
 * Marks-at-risk ranking (brief part C). ONE function drives both surfaces:
 *
 *   risk = typical_marks × pyq_frequency × (1 − mastery) × decay
 *          ─────────────────────────────────────────────────────
 *                         est_study_minutes
 *
 * expressed as expected marks recoverable per minute invested. Untouched
 * nodes use mastery 0 and decay 1, which is the whole point: a never-opened
 * high-mark chapter and a fading once-solid chapter land on ONE comparable
 * axis.
 *
 * Prerequisites gate ordering: a node whose prereq is UNTOUCHED never
 * surfaces itself — the prereq surfaces in its place, carrying the reason.
 */

export function riskScore(node, st) {
  const mastery = st?.state === 'UNTOUCHED' ? 0 : (st?.mastery ?? 0)
  const decay = st?.state === 'UNTOUCHED' ? 1 : (1 - (st?.retention ?? 1))
  const effectiveDecay = st?.state === 'UNTOUCHED' ? 1 : Math.max(decay, 0.05)
  return (node.typical_marks * node.pyq_frequency * (1 - mastery) * effectiveDecay) / node.est_study_minutes
}

/**
 * Ranked list of what to work on, prereq-substituted and deduped.
 * Each row: { node, score, reason, substitutedFor? }.
 */
export function rankNodes(graph, states, { max = 10 } = {}) {
  const scored = graph.chapters
    .map(node => ({ node, st: states.get(node.id), score: riskScore(node, states.get(node.id)) }))
    .sort((a, b) => b.score - a.score)

  const out = []
  const seen = new Set()

  for (const row of scored) {
    if (out.length >= max) break

    // Walk down to the first untouched prerequisite, if any.
    let target = row.node
    let substitutedFor = null
    let guard = 0
    while (guard++ < 10) {
      const blocked = (target.prereq || []).find(p => states.get(p)?.state === 'UNTOUCHED')
      if (!blocked) break
      substitutedFor = substitutedFor || row.node
      target = graph.byId.get(blocked)
    }

    if (seen.has(target.id)) continue
    seen.add(target.id)

    const st = states.get(target.id)
    out.push({
      node: target,
      score: row.score,
      state: st?.state ?? 'UNTOUCHED',
      substitutedFor: substitutedFor && substitutedFor.id !== target.id ? substitutedFor : null,
      reason: reasonFor(target, st, substitutedFor),
    })
  }
  return out
}

/** The stated why — opaque recommendations do not get followed. */
export function reasonFor(node, st, substitutedFor) {
  const marks = Math.round(node.typical_marks)
  if (substitutedFor && substitutedFor.id !== node.id) {
    return `Comes before ${substitutedFor.name} — start here so it lands.`
  }
  switch (st?.state) {
    case 'UNTOUCHED': return `Worth ~${marks} marks, never opened.`
    case 'FADING': return `You were solid here — it's fading now. A short pass brings it back cheap.`
    case 'PRACTISED': return `Started but not solid yet — ~${marks} marks still open.`
    case 'SEEN': return `Read but never tested — ~${marks} marks unproven.`
    default: return `Worth ~${marks} marks.`
  }
}
