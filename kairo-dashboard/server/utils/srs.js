
export function sm2(card, quality) {
  let { easiness = 2.5, interval = 1, repetitions = 0 } = card

  if (quality >= 3) {
    if (repetitions === 0)      interval = 1
    else if (repetitions === 1) interval = 6
    else                        interval = Math.round(interval * easiness)

    repetitions += 1
  } else {
    repetitions = 0
    interval = 1
  }

  easiness = Math.max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  return {
    easiness: Math.round(easiness * 100) / 100,
    interval,
    repetitions,
    nextReview: nextReview.toISOString().slice(0, 10),
  }
}

export function getDueCards(cards) {
  const today = new Date().toISOString().slice(0, 10)
  return cards.filter(c => !c.nextReview || c.nextReview <= today)
}

export function freshCardState() {
  return {
    easiness: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date().toISOString().slice(0, 10),
  }
}
