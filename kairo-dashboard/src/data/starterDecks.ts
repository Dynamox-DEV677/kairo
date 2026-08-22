/**
 * Starter decks — the day-one content for Revision Reels.
 *
 * WHY THIS EXISTS: a brand-new student opened Reels and saw nothing, because
 * Reels is built from their own activity. Competing NEET/JEE apps hand you
 * thousands of cards on install; this closes that cold-start gap.
 *
 * COPYRIGHT: every card here is an ORIGINAL statement of a standard,
 * uncopyrightable fact — an SI unit, a law, a formula, a definition — written
 * in my own words. No textbook sentence is reproduced. (Same basis as
 * ncertCache.ts and the AI's own answers.) Facts like "the SI unit of force is
 * the newton" belong to no one; only a specific book's prose would.
 *
 * SINGLE SOURCE OF TRUTH: adding a deck writes ordinary flashcards into the
 * twin store — the SAME records Reels, SRS and the Notebook already read. A
 * starter card is just a flashcard with source:'starter'. Nothing parallel.
 *
 * `boards`: which curricula a deck suits. '*' = universal (bedrock facts true
 * on every board); 'ncert' also covers CBSE/state. A deck is offered to a
 * student only if it matches their board, so a Cambridge student is never
 * handed a deck labelled as NCERT chapters.
 */

export interface StarterCard { front: string; back: string }
export interface StarterDeck {
  id: string
  title: string
  subject: string
  boards: string[]          // e.g. ['*'] or ['ncert']
  classes: string[]         // class numbers this suits; [] = any
  blurb: string
  cards: StarterCard[]
}

export const STARTER_DECKS: StarterDeck[] = [
  // ── Universal bedrock — true on any board, so every student gets these ──
  {
    id: 'phys-units',
    title: 'Physics · Units & constants',
    subject: 'Physics',
    boards: ['*'],
    classes: [],
    blurb: 'The SI units and constants you should never have to look up.',
    cards: [
      { front: 'SI unit of force, and what it equals', back: 'Newton (N). $1\\,\\text{N} = 1\\,\\text{kg·m/s}^2$ — the force that gives a 1 kg mass an acceleration of 1 m/s².' },
      { front: 'SI unit of work and energy', back: 'Joule (J). $1\\,\\text{J} = 1\\,\\text{N·m}$ — work done when 1 N moves its point of application 1 m.' },
      { front: 'SI unit of power', back: 'Watt (W). $1\\,\\text{W} = 1\\,\\text{J/s}$ — one joule of energy transferred per second.' },
      { front: 'SI unit of electric charge, and its relation to current', back: 'Coulomb (C). $1\\,\\text{C} = 1\\,\\text{A·s}$ — the charge carried by 1 ampere in 1 second.' },
      { front: 'Acceleration due to gravity near Earth\'s surface', back: 'About $9.8\\,\\text{m/s}^2$ (often taken as $10$ for quick estimates), directed downward.' },
      { front: 'Speed of light in vacuum', back: 'About $3 \\times 10^8\\,\\text{m/s}$.' },
    ],
  },
  {
    id: 'phys-motion',
    title: 'Physics · Motion & force',
    subject: 'Physics',
    boards: ['*'],
    classes: [],
    blurb: 'Newton\'s laws and the equations of motion, the way exams use them.',
    cards: [
      { front: "Newton's first law", back: 'A body stays at rest or in uniform straight-line motion unless a net external force acts on it. (The law of inertia.)' },
      { front: "Newton's second law", back: 'Net force equals rate of change of momentum; for constant mass, $F = ma$.' },
      { front: "Newton's third law", back: 'For every action there is an equal and opposite reaction — the two forces act on different bodies.' },
      { front: 'The three equations of motion (uniform acceleration)', back: '$v = u + at$,\\quad $s = ut + \\tfrac{1}{2}at^2$,\\quad $v^2 = u^2 + 2as$.' },
      { front: 'Difference between mass and weight', back: 'Mass is the amount of matter (kg), the same everywhere. Weight is the gravitational force on it, $W = mg$ (N), and changes with $g$.' },
      { front: 'Momentum, and why it is conserved', back: 'Momentum $p = mv$. In the absence of a net external force, total momentum of a system stays constant.' },
    ],
  },
  {
    id: 'chem-atom',
    title: 'Chemistry · Atoms & the mole',
    subject: 'Chemistry',
    boards: ['*'],
    classes: [],
    blurb: 'Atomic structure, valency and the mole — the base every reaction rests on.',
    cards: [
      { front: 'Charge and relative mass of proton, neutron, electron', back: 'Proton: +1, mass ≈ 1 u. Neutron: 0, mass ≈ 1 u. Electron: −1, mass ≈ 1/1836 u (negligible).' },
      { front: 'Atomic number vs mass number', back: 'Atomic number (Z) = number of protons. Mass number (A) = protons + neutrons.' },
      { front: 'What are isotopes?', back: 'Atoms of the same element (same Z) with different numbers of neutrons, so different mass numbers — e.g. carbon-12 and carbon-14.' },
      { front: 'Avogadro\'s number and what a mole is', back: 'One mole is $6.022 \\times 10^{23}$ particles — the number of atoms in exactly 12 g of carbon-12.' },
      { front: 'Formula linking moles, mass and molar mass', back: '$\\text{moles} = \\dfrac{\\text{given mass}}{\\text{molar mass}}$.' },
      { front: 'Maximum electrons in the first three shells', back: 'Shell holds up to $2n^2$: K (n=1) → 2, L (n=2) → 8, M (n=3) → 18.' },
    ],
  },
  {
    id: 'chem-acids',
    title: 'Chemistry · Acids, bases & salts',
    subject: 'Chemistry',
    boards: ['*'],
    classes: [],
    blurb: 'pH, neutralisation and the tests examiners love.',
    cards: [
      { front: 'What the pH scale measures, and its range', back: 'How acidic or basic a solution is, from 0 to 14. Below 7 acidic, 7 neutral, above 7 basic. Lower pH = more $\\text{H}^+$ ions.' },
      { front: 'What ion makes a solution acidic vs basic?', back: 'Acids release $\\text{H}^+$ (H₃O⁺) in water; bases release $\\text{OH}^-$.' },
      { front: 'The neutralisation reaction, in words', back: 'Acid + base → salt + water. The $\\text{H}^+$ and $\\text{OH}^-$ combine to form water.' },
      { front: 'Litmus colour changes', back: 'Acids turn blue litmus red; bases turn red litmus blue. Neutral leaves it unchanged.' },
      { front: 'Gas released when an acid reacts with a metal, and its test', back: 'Hydrogen. It burns with a "pop" sound when a lit splint is brought near.' },
    ],
  },
  {
    id: 'bio-cell',
    title: 'Biology · Cell & life processes',
    subject: 'Biology',
    boards: ['*'],
    classes: [],
    blurb: 'The cell, photosynthesis and respiration — high-yield and heavily asked.',
    cards: [
      { front: 'One clear difference between plant and animal cells', back: 'Plant cells have a rigid cellulose cell wall, a large central vacuole, and chloroplasts; animal cells have none of these.' },
      { front: 'Role of mitochondria', back: 'The "powerhouse" — site of aerobic respiration, releasing energy as ATP.' },
      { front: 'Balanced equation for photosynthesis', back: '$6CO_2 + 6H_2O \\xrightarrow{\\text{light}} C_6H_{12}O_6 + 6O_2$ (in chlorophyll).' },
      { front: 'Word equation for aerobic respiration', back: 'Glucose + oxygen → carbon dioxide + water + energy (ATP).' },
      { front: 'Difference between aerobic and anaerobic respiration', back: 'Aerobic uses oxygen and releases much more energy (→ CO₂ + water). Anaerobic works without oxygen and releases less (→ lactic acid in muscle, or ethanol + CO₂ in yeast).' },
    ],
  },
  {
    id: 'math-algebra',
    title: 'Maths · Algebra essentials',
    subject: 'Mathematics',
    boards: ['*'],
    classes: [],
    blurb: 'The identities and the quadratic formula you use in every paper.',
    cards: [
      { front: 'Expand $(a+b)^2$ and $(a-b)^2$', back: '$(a+b)^2 = a^2 + 2ab + b^2$;\\quad $(a-b)^2 = a^2 - 2ab + b^2$.' },
      { front: 'Factorise $a^2 - b^2$', back: '$a^2 - b^2 = (a+b)(a-b)$ — difference of two squares.' },
      { front: 'The quadratic formula', back: 'For $ax^2+bx+c=0$: $x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.' },
      { front: 'What the discriminant tells you', back: '$D = b^2 - 4ac$. $D>0$: two real roots. $D=0$: one repeated root. $D<0$: no real roots.' },
      { front: 'Sum and product of roots of $ax^2+bx+c=0$', back: 'Sum $= -\\dfrac{b}{a}$, product $= \\dfrac{c}{a}$.' },
    ],
  },
  {
    id: 'math-geom',
    title: 'Maths · Mensuration & trig',
    subject: 'Mathematics',
    boards: ['*'],
    classes: [],
    blurb: 'Areas, volumes and the trig ratios — pure recall marks.',
    cards: [
      { front: 'Pythagoras\' theorem', back: 'In a right triangle, $\\text{hypotenuse}^2 = \\text{base}^2 + \\text{height}^2$.' },
      { front: 'The three basic trig ratios', back: '$\\sin\\theta = \\dfrac{\\text{opp}}{\\text{hyp}}$, $\\cos\\theta = \\dfrac{\\text{adj}}{\\text{hyp}}$, $\\tan\\theta = \\dfrac{\\text{opp}}{\\text{adj}}$.' },
      { front: 'Area and circumference of a circle', back: 'Area $= \\pi r^2$; circumference $= 2\\pi r$.' },
      { front: 'Volume and surface area of a sphere', back: 'Volume $= \\tfrac{4}{3}\\pi r^3$; surface area $= 4\\pi r^2$.' },
      { front: 'Volume of a cylinder and a cone (same base & height)', back: 'Cylinder $= \\pi r^2 h$; cone $= \\tfrac{1}{3}\\pi r^2 h$ — a cone is one-third of its cylinder.' },
      { front: '$\\sin$, $\\cos$, $\\tan$ of $30°, 45°, 60°$', back: '$\\sin: \\tfrac12, \\tfrac{1}{\\sqrt2}, \\tfrac{\\sqrt3}{2}$. $\\cos$ is the reverse. $\\tan: \\tfrac{1}{\\sqrt3}, 1, \\sqrt3$.' },
    ],
  },
]
