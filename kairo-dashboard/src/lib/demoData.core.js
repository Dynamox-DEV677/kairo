/**
 * The demo twin's quiz history — pure data, imported by BOTH twin.seedDemo
 * (to seed the browser) and the node test (to assert the demo can never again
 * show TREND −100% / PREDICTED —). One source, so the test tests the truth.
 *
 * Shape of the story: a believable fortnight. Started shaky (maths), got
 * steadier, vectors stayed the weak spot (that feeds the weak-topic panels),
 * finished on an upswing so Trajectory reads like progress, because it is.
 * 21 scored assessments — above the prediction gate (20) BY DESIGN; if the
 * gate moves up, the test below fails and this file grows.
 */

export const DEMO_QUIZ_EVENTS = [
  { type: 'quiz_answered',  subject: 'Math',      topic: 'quadratic equations', correct: false, score: 40, difficulty: 0.6, daysAgo: 14 },
  { type: 'quiz_answered',  subject: 'Math',      topic: 'quadratic equations', correct: true,  score: 55, difficulty: 0.6, daysAgo: 14 },
  { type: 'quiz_answered',  subject: 'Physics',   topic: 'newton laws',         correct: true,  score: 60, difficulty: 0.5, daysAgo: 13 },
  { type: 'quiz_answered',  subject: 'Chemistry', topic: 'periodic table',      correct: false, score: 45, difficulty: 0.5, daysAgo: 12 },
  { type: 'quiz_answered',  subject: 'Chemistry', topic: 'periodic table',      correct: true,  score: 65, difficulty: 0.5, daysAgo: 12 },
  { type: 'quiz_completed', subject: 'Math',      topic: 'quadratic equations',                 score: 58, difficulty: 0.6, daysAgo: 11 },
  { type: 'quiz_answered',  subject: 'Biology',   topic: 'life processes',      correct: true,  score: 70, difficulty: 0.4, daysAgo: 10 },
  { type: 'quiz_answered',  subject: 'Biology',   topic: 'life processes',      correct: true,  score: 75, difficulty: 0.4, daysAgo: 10 },
  { type: 'quiz_answered',  subject: 'Math',      topic: 'trigonometry',        correct: true,  score: 68, difficulty: 0.6, daysAgo: 9 },
  { type: 'quiz_answered',  subject: 'Physics',   topic: 'light',               correct: false, score: 50, difficulty: 0.6, daysAgo: 8 },
  { type: 'quiz_answered',  subject: 'Physics',   topic: 'light',               correct: true,  score: 72, difficulty: 0.6, daysAgo: 8 },
  { type: 'quiz_completed', subject: 'Physics',   topic: 'newton laws',                         score: 78, difficulty: 0.5, daysAgo: 7 },
  { type: 'essay_graded',   subject: 'English',   topic: 'persuasive essay',                    score: 74,                  daysAgo: 6 },
  { type: 'quiz_answered',  subject: 'Math',      topic: 'vectors',             correct: false, score: 35, difficulty: 0.7, daysAgo: 5 },
  { type: 'quiz_answered',  subject: 'Math',      topic: 'vectors',             correct: false, score: 48, difficulty: 0.7, daysAgo: 5 },
  { type: 'quiz_answered',  subject: 'Chemistry', topic: 'carbon and its compounds', correct: true, score: 76, difficulty: 0.5, daysAgo: 4 },
  { type: 'quiz_answered',  subject: 'Biology',   topic: 'heart',               correct: true,  score: 82, difficulty: 0.5, daysAgo: 3 },
  { type: 'quiz_answered',  subject: 'Physics',   topic: 'energy',              correct: true,  score: 80, difficulty: 0.6, daysAgo: 2 },
  { type: 'quiz_answered',  subject: 'Math',      topic: 'trigonometry',        correct: true,  score: 79, difficulty: 0.6, daysAgo: 1 },
  { type: 'quiz_completed', subject: 'Math',      topic: 'quadratic equations',                 score: 81, difficulty: 0.6, daysAgo: 0 },
  { type: 'quiz_answered',  subject: 'Physics',   topic: 'newton laws',         correct: true,  score: 85, difficulty: 0.5, daysAgo: 0 },
]

/** Non-scored colour for the demo (labs opened, cards flipped). */
export const DEMO_ACTIVITY_EVENTS = [
  { type: 'lab_opened',       subject: 'Biology',   topic: 'cell',           daysAgo: 9 },
  { type: 'flashcard_review', subject: 'Chemistry', topic: 'periodic table', correct: true, daysAgo: 7 },
  { type: 'lab_opened',       subject: 'Space',     topic: 'solar system',   daysAgo: 6 },
  { type: 'lab_opened',       subject: 'Biology',   topic: 'dna',            daysAgo: 3 },
  { type: 'flashcard_review', subject: 'Chemistry', topic: 'periodic table', correct: true, daysAgo: 1 },
  { type: 'lab_opened',       subject: 'Biology',   topic: 'heart',          daysAgo: 1 },
]
