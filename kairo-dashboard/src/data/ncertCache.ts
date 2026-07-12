
export interface NcertEntry {
  id: string
  subject: 'Physics' | 'Chemistry' | 'Biology' | 'Math'
  match: string[][]
  topicKeyword:    string
  supports3D:      boolean
  labRoute:        string | null
  textExplanation: string
  formulas:        string[]
  relatedConcepts: string[]
  imageQueries:    string[]
  videoQuery:      string
}

export const NCERT_CACHE: NcertEntry[] = [

  {
    id: 'newtons-first-law',
    subject: 'Physics',
    topicKeyword: "Newton's First Law",
    match: [
      ['newton', 'first', 'law'],
      ['law', 'inertia'],
      ['inertia'],
    ],
    supports3D: false,
    labRoute: 'gravity',
    textExplanation: `
## Newton's First Law of Motion

An object at rest stays at rest, and an object in motion stays in motion at the same speed and in the same direction — **unless acted on by an external force**.

This is also called the **Law of Inertia**. Inertia is the property of any mass to resist a change in its state of motion.

### What this really means

A body has no preference for being still or moving. It just stays in whatever state of motion (or rest) it was already in. To change that state, *something else* has to push or pull it.

### Everyday examples

- **The seatbelt** — when a car stops suddenly, your body keeps moving forward at the car's previous speed. The belt is the external force that stops you.
- **The tablecloth trick** — if you yank the cloth fast enough, the dishes stay put because their own inertia resists the brief horizontal force.
- **A book on a desk** — it stays there forever unless you (or gravity, or wind) push it.
- **Space probes** — once Voyager left the solar system, no engines are firing, but it keeps moving because nothing is slowing it down.

### Why "unless acted on by a force" is the key phrase

On Earth, *everything eventually stops* — a rolling ball, a slid chair, a thrown ball. That's not because the law is wrong; it's because **friction**, **air resistance**, and **gravity** are always acting as external forces. In an idealised, force-free environment, motion truly never decays.

### Connection to mass

The amount of inertia an object has scales with its **mass**. A truck is harder to stop than a bicycle moving at the same speed because the truck has more inertia. That's why Newton's Second Law later quantifies this exact relationship.
`.trim(),
    formulas: [],
    relatedConcepts: ['Inertia', "Newton's Second Law", "Newton's Third Law", 'Friction', 'Mass'],
    imageQueries: ['Newton first law of motion diagram', 'inertia tablecloth experiment', 'seatbelt physics inertia', 'newton apple'],
    videoQuery: "Newton's First Law of Motion explained",
  },

  {
    id: 'newtons-second-law',
    subject: 'Physics',
    topicKeyword: "Newton's Second Law",
    match: [
      ['newton', 'second', 'law'],
      ['f', 'equal', 'ma'],
      ['force', 'mass', 'acceleration'],
    ],
    supports3D: false,
    labRoute: 'gravity',
    textExplanation: `
## Newton's Second Law of Motion

The **net force** on an object is equal to its **mass** times its **acceleration**.

\`\`\`
F = m · a
\`\`\`

That single equation is the most-used line in all of high-school physics.

### Unpacking it

- **F** is measured in newtons (N). One newton accelerates one kilogram by one m/s² — that's the definition.
- **m** is the mass in kilograms, a property of the object itself, not how fast it's moving.
- **a** is acceleration in m/s² — how quickly the object's velocity changes per second.

### Why it follows from the First Law

The First Law said: change in motion requires an external force. The Second Law quantifies *how much*: more mass needs more force to produce the same change in motion. A bigger F gives a bigger a; a bigger m gives a smaller a.

### Solving a typical problem

> A 2 kg ball is pushed with 10 N. What's its acceleration?
> a = F / m = 10 / 2 = **5 m/s²**

> A car experiences a friction force of 600 N. The car has mass 1200 kg. How fast does it slow down?
> a = 600 / 1200 = **0.5 m/s²** of deceleration.

### Tricky bits to remember

- **F is the *net* force**, not just whichever push you applied. If gravity and friction both act on a body, F = sum of all forces (with direction).
- Force is a **vector**. Pushing left and right cancel if equal.
- Weight = m · g, where g ≈ 9.8 m/s² on Earth. A 5 kg object weighs 5 × 9.8 = 49 N.
`.trim(),
    formulas: ['F = m · a', 'a = F / m', 'F_net = Σ F_i', 'W = m · g'],
    relatedConcepts: ["Newton's First Law", "Newton's Third Law", 'Acceleration', 'Force', 'Weight'],
    imageQueries: ['Newton second law F=ma diagram', 'mass acceleration force vector', 'free body diagram force', 'newton apple gravity'],
    videoQuery: "Newton's Second Law F = ma explained",
  },

  {
    id: 'newtons-third-law',
    subject: 'Physics',
    topicKeyword: "Newton's Third Law",
    match: [
      ['newton', 'third', 'law'],
      ['action', 'reaction'],
      ['action', 'reaction', 'force'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Newton's Third Law of Motion

**For every action, there is an equal and opposite reaction.**

If object A pushes on object B with force F, then B simultaneously pushes back on A with force F in the *exact opposite* direction.

### What people get wrong

The two forces are on **different objects**. They don't cancel each other. They look symmetric, but each force only acts on one body.

- You push the wall with 50 N. The wall pushes you back with 50 N. The wall doesn't move because it's anchored, but you also don't feel an obvious recoil because the floor friction holds you in place.

### Real examples

- **Walking** — your foot pushes the ground backward; the ground pushes your foot forward. The forward push is what actually moves you.
- **Swimming** — your arm pushes water backward; the water pushes you forward.
- **Rockets** — burning fuel pushes hot gas downward; the gas pushes the rocket upward. No air or ground required — works in space.
- **Birds flying** — wings push air down; air pushes birds up.
- **Recoil of a gun** — the bullet flies forward; the gun kicks backward with equal momentum (smaller velocity because of larger mass).

### How it links to the other laws

The Third Law tells you forces always come in **pairs**. Newton's Second Law then tells you what acceleration each object gets from its own force in that pair, given its mass.
`.trim(),
    formulas: ['F_AB = -F_BA'],
    relatedConcepts: ['Action-Reaction', 'Momentum', "Newton's First Law", "Newton's Second Law", 'Rockets'],
    imageQueries: ['Newton third law diagram', 'rocket thrust reaction', 'swimmer action reaction', 'walking action reaction force'],
    videoQuery: "Newton's Third Law action reaction explained",
  },

  {
    id: 'gravity',
    subject: 'Physics',
    topicKeyword: 'Gravity',
    match: [
      ['gravity'],
      ['gravitational', 'force'],
      ['law', 'universal', 'gravitation'],
      ['newton', 'gravitation'],
    ],
    supports3D: false,
    labRoute: 'gravity',
    textExplanation: `
## Gravity & Newton's Law of Universal Gravitation

Every object in the universe pulls on every other object. The strength of that pull depends on the **masses** of the two objects and the **distance** between them.

\`\`\`
F = G · (m₁ · m₂) / r²
\`\`\`

Where:
- **F** is the gravitational force (N)
- **G** is the gravitational constant ≈ 6.674 × 10⁻¹¹ N·m²/kg²
- **m₁, m₂** are the two masses (kg)
- **r** is the distance between their centres (m)

### The inverse-square law

Force falls off as the *square* of the distance. Double the distance → force drops to one quarter. Triple → one ninth.

### Weight vs mass

These are NOT the same.

- **Mass** is how much matter you contain. A constant. Measured in kg.
- **Weight** is the force gravity exerts on your mass. Changes by location. Measured in newtons.

On Earth: W = m × g, where g ≈ 9.8 m/s². On the Moon, g ≈ 1.62 m/s² — same mass, weight is 1/6 of Earth-weight.

### What Newton actually figured out

The same force that pulls an apple from a tree (the legend) is the force that holds the Moon in orbit around the Earth. Both are inverse-square gravity — just at very different scales.

### Free fall

In the absence of air resistance, all objects accelerate downward at the same rate: g. A feather and a hammer hit the ground at the same time on the Moon (Apollo 15 actually demonstrated this).
`.trim(),
    formulas: ['F = G · m₁m₂ / r²', 'W = m · g', 'g ≈ 9.8 m/s² (Earth)', 'g ≈ 1.62 m/s² (Moon)'],
    relatedConcepts: ["Newton's Second Law", 'Free Fall', 'Weight', 'Orbits', 'Mass'],
    imageQueries: ['Newton law universal gravitation diagram', 'apple gravity', 'Earth moon gravity orbit', 'free fall feather hammer'],
    videoQuery: 'Newton law of universal gravitation explained',
  },

  {
    id: 'ohms-law',
    subject: 'Physics',
    topicKeyword: "Ohm's Law",
    match: [
      ['ohm', 'law'],
      ['v', 'equal', 'ir'],
      ['voltage', 'current', 'resistance'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Ohm's Law

The current flowing through a conductor between two points is directly proportional to the voltage across them, provided temperature stays constant.

\`\`\`
V = I · R
\`\`\`

- **V** = voltage (volts, V) — the "push" driving electrons
- **I** = current (amperes, A) — the rate of charge flow
- **R** = resistance (ohms, Ω) — how much the conductor opposes the current

### Rearranging

- Find current: I = V / R
- Find resistance: R = V / I

### What "directly proportional" means

If you double the voltage across a fixed resistor, the current doubles. If you halve V, I halves. Plotting V against I gives a **straight line** through the origin — the slope is the resistance.

### Materials that don't obey Ohm's law

Real-world devices like diodes, transistors, and filaments don't follow Ohm's law cleanly. Their V-I graph isn't a straight line. We still use the formula as an approximation, but call them "non-ohmic" conductors.

### Quick problem

> A 9V battery is connected to a 3Ω resistor. What's the current?
> I = V / R = 9 / 3 = **3 A**.

### Power dissipation

Once you know V, I, and R you can also compute power:

\`\`\`
P = V · I = I² · R = V² / R
\`\`\`

Power tells you how fast electrical energy turns into heat (or light, or motion).
`.trim(),
    formulas: ['V = I · R', 'I = V / R', 'R = V / I', 'P = V · I', 'P = I² · R', 'P = V² / R'],
    relatedConcepts: ['Voltage', 'Current', 'Resistance', 'Power', 'Kirchhoff Laws'],
    imageQueries: ["Ohm's law triangle V I R", 'voltage current resistance circuit', 'ohm law graph straight line', 'resistor circuit diagram'],
    videoQuery: "Ohm's Law explained with examples",
  },

  {
    id: 'reflection-of-light',
    subject: 'Physics',
    topicKeyword: 'Reflection of Light',
    match: [
      ['reflection', 'light'],
      ['law', 'reflection'],
      ['mirror', 'reflection'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Reflection of Light

When a ray of light strikes a smooth surface, it bounces back into the same medium. Two laws govern that bounce.

### The two laws of reflection

1. **The angle of incidence equals the angle of reflection.**
   Both are measured from the **normal** — an imaginary line perpendicular to the surface at the point of incidence.

2. **The incident ray, reflected ray, and the normal all lie in the same plane.**

### Types of reflection

- **Regular reflection** — happens on a smooth, polished surface (mirror). All parallel rays bounce off parallel and you get a clear image.
- **Diffuse reflection** — happens on a rough surface (paper, wall). Parallel rays bounce off in many directions — that's why a white wall doesn't act like a mirror.

### Spherical mirrors

- **Concave mirror** (curved inward) — converges parallel rays to a focal point. Used in shaving mirrors, headlights, telescopes.
- **Convex mirror** (curved outward) — diverges parallel rays. Always gives a smaller, virtual image. Used in vehicle rear-view mirrors.

### Mirror formula

For both concave and convex spherical mirrors:

\`\`\`
1/v + 1/u = 1/f
\`\`\`

Where:
- **u** is the object distance from the mirror (negative by convention)
- **v** is the image distance
- **f** is the focal length (negative for concave's *real* focal length in NCERT sign convention)

### Magnification

\`\`\`
m = -v/u = h'/h
\`\`\`

Where h is the object's height and h' is the image's. A positive m means erect image, negative means inverted.
`.trim(),
    formulas: ['Angle of incidence = Angle of reflection', '1/v + 1/u = 1/f', 'm = -v/u', 'm = h\'/h'],
    relatedConcepts: ['Refraction', 'Concave Mirror', 'Convex Mirror', 'Focal Length', 'Image Formation'],
    imageQueries: ['reflection of light diagram', 'law of reflection angle normal', 'concave convex mirror', 'mirror image formation ray diagram'],
    videoQuery: 'Reflection of light laws and mirrors explained',
  },

  {
    id: 'refraction-of-light',
    subject: 'Physics',
    topicKeyword: 'Refraction of Light',
    match: [
      ['refraction', 'light'],
      ['snell', 'law'],
      ['refractive', 'index'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Refraction of Light

When light passes from one transparent medium into another, it changes speed — and that change of speed makes the light **bend**. The bending is called refraction.

### The laws of refraction

1. **The incident ray, refracted ray, and the normal all lie in the same plane.**

2. **Snell's Law:**

\`\`\`
n₁ · sin(θ₁) = n₂ · sin(θ₂)
\`\`\`

Where:
- **n₁, n₂** are the refractive indices of the two media
- **θ₁** is the angle of incidence
- **θ₂** is the angle of refraction

### Refractive index

\`\`\`
n = c / v
\`\`\`

Where c is the speed of light in vacuum and v is the speed in that medium. Higher n → light travels slower → light bends more.

Common values:
- Vacuum: 1.0000
- Air: ~1.0003
- Water: 1.33
- Glass: ~1.5
- Diamond: 2.42

### Which way does light bend?

- Going from a **less dense** medium (air) to a **denser** medium (water) → light bends **toward** the normal.
- Going from denser to less dense → light bends **away** from the normal.

### Real-world consequences

- **A pencil in a glass of water** looks broken at the surface.
- **Pool floors** appear shallower than they actually are.
- **Mirages** in deserts are layers of hot air refracting sky-light.
- **Total internal reflection** — at angles steeper than the critical angle, light reflects entirely instead of refracting. This is how optical fibres carry signals.

### Lens formula

\`\`\`
1/v - 1/u = 1/f
\`\`\`

Convex lenses converge light; concave lenses diverge it. f is positive for convex, negative for concave.
`.trim(),
    formulas: ['n₁ sin θ₁ = n₂ sin θ₂', 'n = c/v', '1/v - 1/u = 1/f', 'Critical angle: sin θ_c = n₂/n₁'],
    relatedConcepts: ['Reflection', 'Refractive Index', 'Lenses', 'Total Internal Reflection', 'Optical Fibres'],
    imageQueries: ['refraction of light prism', 'snell law diagram', 'light bending water pencil', 'total internal reflection optical fibre'],
    videoQuery: 'Refraction of light Snell law explained',
  },

  {
    id: 'kinetic-potential-energy',
    subject: 'Physics',
    topicKeyword: 'Kinetic and Potential Energy',
    match: [
      ['kinetic', 'energy'],
      ['potential', 'energy'],
      ['kinetic', 'potential', 'energy'],
      ['ke'],
      ['pe'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Kinetic & Potential Energy

Energy is the capacity to do work. Two of its most common forms — kinetic and potential — describe an object's *state of motion* and *state of position* respectively.

### Kinetic Energy (KE)

The energy a moving object has *because* it is moving.

\`\`\`
KE = ½ · m · v²
\`\`\`

- m = mass (kg)
- v = velocity (m/s)
- KE measured in joules (J)

Notice the **v²** — doubling the speed of a car quadruples its KE (and hence its braking distance, and the energy it can deliver in a crash).

### Potential Energy (PE)

The energy an object has stored *because of its position*. For an object at height h above the ground:

\`\`\`
PE = m · g · h
\`\`\`

- m = mass (kg)
- g = 9.8 m/s² on Earth
- h = height (m)

### Conservation of mechanical energy

In the absence of friction and air drag, the total mechanical energy (KE + PE) of a system stays constant.

\`\`\`
KE₁ + PE₁ = KE₂ + PE₂
\`\`\`

A roller-coaster cart converts PE at the top into KE at the bottom and back again — total energy unchanged.

### Quick problem

> A 2 kg ball is dropped from a height of 5 m. What's its speed just before hitting the ground? Ignore air resistance.

PE at top → all converted to KE at the bottom.
m·g·h = ½·m·v²
g·h = ½·v²
v = √(2·g·h) = √(2 · 9.8 · 5) = **9.9 m/s**

### Other forms of energy

KE and PE are just two flavours. Energy also lives as thermal, chemical, electrical, light, sound, and nuclear forms. The **Law of Conservation of Energy** says total energy across all forms can never be created or destroyed, only converted.
`.trim(),
    formulas: ['KE = ½ · m · v²', 'PE = m · g · h', 'KE₁ + PE₁ = KE₂ + PE₂', 'W = F · d (work)'],
    relatedConcepts: ['Work', 'Power', 'Conservation of Energy', 'Momentum', 'Free Fall'],
    imageQueries: ['kinetic potential energy roller coaster', 'KE PE graph', 'falling ball energy conservation', 'pendulum energy diagram'],
    videoQuery: 'Kinetic and potential energy explained',
  },

  {
    id: 'atomic-structure',
    subject: 'Chemistry',
    topicKeyword: 'Atomic Structure',
    match: [
      ['atomic', 'structure'],
      ['structure', 'atom'],
      ['bohr', 'model'],
      ['electron', 'proton', 'neutron'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Atomic Structure

An atom is the smallest unit of matter that retains the identity of an element. Every atom has the same three building blocks.

### The three subatomic particles

| Particle | Charge | Mass | Location |
|---|---|---|---|
| **Proton** | +1 | 1 amu | nucleus |
| **Neutron** | 0 | 1 amu | nucleus |
| **Electron** | −1 | ~1/1836 amu | orbital shells around the nucleus |

### Nucleus vs electron cloud

The nucleus is incredibly dense and tiny — if an atom were a football stadium, the nucleus would be a marble at the centre and the electrons would be moving in clouds throughout the stands. Almost all the **mass** of the atom is in the nucleus, but almost all the **volume** is empty space.

### Atomic number and mass number

- **Atomic number (Z)** = number of protons. Defines which element. Hydrogen Z=1, Helium Z=2, Carbon Z=6.
- **Mass number (A)** = protons + neutrons.
- **Isotopes** are atoms of the same element with different numbers of neutrons (so same Z, different A). Carbon-12 and Carbon-14 are isotopes.

### The Bohr model (Class 9 NCERT)

Niels Bohr proposed that electrons orbit the nucleus in fixed circular **shells** at specific energy levels. The shells are labelled K, L, M, N (or n=1, 2, 3, 4).

Each shell holds a maximum of **2n² electrons**:
- K (n=1): 2 electrons
- L (n=2): 8 electrons
- M (n=3): 18 electrons
- N (n=4): 32 electrons

### Electronic configuration of common atoms

- H (Z=1): 1
- He (Z=2): 2
- C (Z=6): 2, 4
- O (Z=8): 2, 6
- Na (Z=11): 2, 8, 1
- Mg (Z=12): 2, 8, 2
- Cl (Z=17): 2, 8, 7

The number of electrons in the outermost shell is the **valency** — and that's what controls how the atom bonds with others.

### Modern picture

The Bohr model is a simplified version. In reality electrons don't orbit in neat circles — they exist in **orbitals**, which are probability clouds where the electron is *likely* to be found. The full picture comes from quantum mechanics.
`.trim(),
    formulas: ['Mass number A = Z + N', 'Max electrons in shell n = 2n²', 'Valency = electrons in outermost shell (or 8 - that)'],
    relatedConcepts: ['Periodic Table', 'Electron Configuration', 'Isotopes', 'Valency', 'Chemical Bonding'],
    imageQueries: ['atom structure proton neutron electron diagram', 'Bohr model atom shells', 'electron shells K L M N', 'isotopes carbon 12 14'],
    videoQuery: 'Atomic structure and Bohr model explained',
  },

  {
    id: 'periodic-table',
    subject: 'Chemistry',
    topicKeyword: 'Periodic Table',
    match: [
      ['periodic', 'table'],
      ['mendeleev'],
      ['periodic', 'classification'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## The Periodic Table

A systematic arrangement of all known elements, ordered by **atomic number** (Z), in such a way that elements with similar chemical properties land in the same column.

### Structure

- **Periods** (rows): there are 7. The period number = the outermost electron shell.
- **Groups** (columns): there are 18. Elements in the same group share similar valence-electron configurations and so have similar chemistry.

### Key groups (NCERT focus)

| Group | Name | Behaviour |
|---|---|---|
| 1 | Alkali metals (Li, Na, K, Rb, Cs) | Highly reactive, 1 valence electron, soft metals |
| 2 | Alkaline earth metals (Be, Mg, Ca, Sr, Ba) | Reactive but less so than Group 1, 2 valence electrons |
| 17 | Halogens (F, Cl, Br, I) | Highly reactive non-metals, 7 valence electrons |
| 18 | Noble gases (He, Ne, Ar, Kr, Xe) | Inert, full outer shell, almost no chemistry |

### Periodic trends

- **Atomic radius**: decreases left → right (more protons pulling electrons inward), increases top → bottom (more shells).
- **Ionisation energy**: increases left → right, decreases top → bottom. (Energy needed to remove an electron.)
- **Electronegativity**: increases left → right, decreases top → bottom. Fluorine is the most electronegative element.
- **Metallic character**: decreases left → right, increases top → bottom.

### History — Mendeleev's insight (1869)

Dmitri Mendeleev arranged the known elements by atomic *mass* (the atomic number concept came later). He left **gaps** for elements he predicted must exist — and he was right. Gallium, germanium, and scandium were all later discovered with properties he had foretold.

### Today's version

The modern table is arranged by atomic number, not mass. This fixed a few apparent anomalies in Mendeleev's table (e.g., Tellurium and Iodine).
`.trim(),
    formulas: [],
    relatedConcepts: ['Atomic Structure', 'Electronegativity', 'Ionisation Energy', 'Mendeleev', 'Valency'],
    imageQueries: ['periodic table of elements', 'periodic table groups periods', 'periodic trends radius ionisation', 'Mendeleev original periodic table'],
    videoQuery: 'Periodic table trends explained',
  },

  {
    id: 'acids-bases-ph',
    subject: 'Chemistry',
    topicKeyword: 'Acids, Bases & pH',
    match: [
      ['acid', 'base'],
      ['ph', 'scale'],
      ['acid', 'base', 'ph'],
      ['litmus', 'test'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Acids, Bases & the pH Scale

### Acids

Substances that release **H⁺ ions** (protons) when dissolved in water.

\`\`\`
HCl  →  H⁺ + Cl⁻
\`\`\`

Properties:
- Sour taste (lemon, vinegar)
- Turn blue litmus red
- React with metals to give H₂ gas
- React with bases to form salt + water (neutralisation)

Common acids: HCl (stomach acid, hydrochloric), H₂SO₄ (sulphuric, car batteries), HNO₃ (nitric, fertilisers), CH₃COOH (acetic, vinegar), citric acid (lemons).

### Bases

Substances that release **OH⁻ ions** (hydroxide) when dissolved in water.

\`\`\`
NaOH  →  Na⁺ + OH⁻
\`\`\`

Properties:
- Bitter taste, slippery feel (soap)
- Turn red litmus blue
- React with acids to neutralise

Common bases: NaOH (caustic soda), KOH (potash), Ca(OH)₂ (lime), Mg(OH)₂ (milk of magnesia, antacid), NH₄OH (ammonia).

### Neutralisation

Acid + Base → Salt + Water

\`\`\`
HCl + NaOH  →  NaCl + H₂O
\`\`\`

This is how an antacid (a mild base) neutralises stomach acid.

### The pH scale

A measure of how acidic or basic a solution is. Range 0 to 14.

- **pH < 7** → acidic (lower = stronger acid)
- **pH = 7** → neutral (pure water)
- **pH > 7** → basic / alkaline (higher = stronger base)

\`\`\`
pH = -log₁₀ [H⁺]
\`\`\`

### Real-world pH values

| Substance | pH |
|---|---|
| Stomach acid | ~1.5 |
| Lemon juice | 2 |
| Vinegar | 3 |
| Black coffee | 5 |
| Pure water | 7 |
| Blood | 7.4 |
| Sea water | 8 |
| Baking soda | 9 |
| Soap | 10 |
| Bleach | 13 |

### Indicators

A way to tell if something's an acid or base:
- **Litmus** — red in acid, blue in base
- **Phenolphthalein** — colourless in acid, pink in base
- **Methyl orange** — red in acid, yellow in base
- **Universal indicator** — shows a whole spectrum and gives an exact pH
`.trim(),
    formulas: ['pH = -log₁₀ [H⁺]', 'Acid + Base → Salt + Water', '[H⁺] · [OH⁻] = 10⁻¹⁴ (at 25°C)'],
    relatedConcepts: ['pH', 'Salts', 'Neutralisation', 'Indicators', 'Electrolytes'],
    imageQueries: ['pH scale chart acid base', 'litmus paper test', 'neutralisation reaction', 'acids bases everyday'],
    videoQuery: 'Acids bases and pH scale explained',
  },

  {
    id: 'photosynthesis',
    subject: 'Biology',
    topicKeyword: 'Photosynthesis',
    match: [
      ['photosynthesis'],
      ['plant', 'food'],
      ['chlorophyll', 'sunlight'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Photosynthesis

The process by which green plants (and some other organisms) use sunlight to convert carbon dioxide and water into glucose, releasing oxygen as a by-product. It's the single most important biochemical process on Earth — every food chain ultimately depends on it.

### The overall equation

\`\`\`
6 CO₂ + 6 H₂O  →  C₆H₁₂O₆ + 6 O₂
        (sunlight, chlorophyll)
\`\`\`

Six carbon dioxide molecules + six water molecules + light energy → one glucose molecule + six oxygen molecules.

### What plants need

1. **Sunlight** — the energy source. Absorbed by chlorophyll, the green pigment in chloroplasts.
2. **Carbon dioxide** — taken in from the air through pores called stomata, mostly on the underside of leaves.
3. **Water** — absorbed from the soil through roots, transported up via the xylem.
4. **Chlorophyll** — the molecule that captures light energy. It reflects green light (which is why leaves look green) and absorbs red and blue light.

### Where it happens

Inside **chloroplasts** — organelles found mainly in mesophyll cells of leaves. Each chloroplast contains stacks of thylakoid membranes embedded in a fluid called stroma.

### Two stages

1. **Light-dependent reactions** — happen in the thylakoid membranes. Light splits water into H⁺, electrons, and O₂. ATP and NADPH are produced.
2. **Light-independent reactions (Calvin cycle)** — happen in the stroma. ATP and NADPH from stage 1 are used to fix CO₂ into glucose.

### Why it matters

- **Food** — every gram of plant matter, and every gram of animal matter that ate the plant, traces back to photosynthesis.
- **Oxygen** — almost all atmospheric O₂ comes from this reaction (oceans + forests).
- **Carbon cycle** — plants pull CO₂ out of the atmosphere, helping regulate climate.

### Factors affecting the rate

- **Light intensity** — more light, faster rate, up to a saturation point.
- **CO₂ concentration** — higher CO₂ generally speeds it up.
- **Temperature** — optimum around 25–35 °C. Too hot and enzymes denature.
- **Water availability** — drought closes stomata, slowing CO₂ uptake.
`.trim(),
    formulas: ['6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂ (with sunlight + chlorophyll)'],
    relatedConcepts: ['Chlorophyll', 'Respiration', 'Chloroplast', 'Stomata', 'Calvin Cycle'],
    imageQueries: ['photosynthesis diagram leaf', 'chloroplast structure', 'photosynthesis light dark reactions', 'plant stomata cross section'],
    videoQuery: 'Photosynthesis explained for students',
  },

  {
    id: 'respiration',
    subject: 'Biology',
    topicKeyword: 'Cellular Respiration',
    match: [
      ['respiration'],
      ['cellular', 'respiration'],
      ['breathing'],
      ['aerobic', 'respiration'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Respiration

The process by which living cells break down glucose to release the energy needed for life processes. It's effectively the *reverse* of photosynthesis.

### Don't confuse respiration with breathing

- **Breathing** is the physical act of moving air in and out of the lungs.
- **Respiration** is the *chemical* process inside cells that uses oxygen to break glucose down. Even plants respire — at every moment, day and night.

### Aerobic respiration (with oxygen)

\`\`\`
C₆H₁₂O₆ + 6 O₂  →  6 CO₂ + 6 H₂O + Energy (38 ATP)
\`\`\`

Produces a lot of energy per glucose molecule — about 38 molecules of ATP. Happens mostly in the **mitochondria** (the "powerhouse of the cell").

### Anaerobic respiration (without oxygen)

When oxygen is scarce, cells fall back to a less efficient pathway.

In animal muscle cells (during heavy exercise):
\`\`\`
C₆H₁₂O₆  →  2 C₃H₆O₃ (lactic acid) + Energy (2 ATP)
\`\`\`

That lactic acid build-up is why your muscles ache after sprinting.

In yeast (used in brewing, baking):
\`\`\`
C₆H₁₂O₆  →  2 C₂H₅OH (ethanol) + 2 CO₂ + Energy (2 ATP)
\`\`\`

### The three stages of aerobic respiration

1. **Glycolysis** — in the cytoplasm. Glucose (6C) splits into two pyruvate (3C) molecules. Net: 2 ATP.
2. **Krebs cycle** — in the mitochondrial matrix. Each pyruvate is broken down completely to CO₂. Generates NADH and FADH₂.
3. **Electron transport chain** — in the inner mitochondrial membrane. NADH and FADH₂ donate electrons; energy is used to make ATP. Oxygen is the final electron acceptor, forming water.

### Why aerobic is so much more efficient

Glycolysis alone gives 2 ATP. Adding the Krebs cycle and ETC gives ~36 more, for a total of ~38. That's why animals (us included) need oxygen so urgently — without it we're stuck at the 2-ATP level.
`.trim(),
    formulas: ['C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + 38 ATP (aerobic)', 'C₆H₁₂O₆ → 2 C₃H₆O₃ + 2 ATP (anaerobic, lactic acid)', 'C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂ + 2 ATP (yeast fermentation)'],
    relatedConcepts: ['Photosynthesis', 'ATP', 'Mitochondria', 'Glycolysis', 'Krebs Cycle', 'Anaerobic Respiration'],
    imageQueries: ['cellular respiration diagram mitochondria', 'aerobic anaerobic respiration', 'glycolysis krebs cycle electron transport', 'ATP energy molecule'],
    videoQuery: 'Cellular respiration aerobic anaerobic explained',
  },

  {
    id: 'cell-structure',
    subject: 'Biology',
    topicKeyword: 'Cell Structure',
    match: [
      ['cell', 'structure'],
      ['plant', 'animal', 'cell'],
      ['organelle'],
      ['part', 'cell'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Cell Structure

A cell is the smallest unit of life. Every living organism — from bacteria to humans — is made of one or more cells. Cells have specialised **organelles**, each performing a distinct function.

### Common organelles

| Organelle | What it does |
|---|---|
| **Nucleus** | Houses DNA, the cell's master blueprint. Controls all activity. |
| **Mitochondria** | "Powerhouse" — does cellular respiration to generate ATP. |
| **Ribosomes** | Make proteins by reading mRNA. |
| **Endoplasmic reticulum (ER)** | Network of membranes. Rough ER has ribosomes (protein synthesis). Smooth ER makes lipids. |
| **Golgi apparatus** | Packages and ships proteins to where they need to go. |
| **Lysosomes** | "Suicide bags" — contain digestive enzymes to break down waste. |
| **Cytoplasm** | Jelly-like fluid filling the cell. Hosts all the organelles. |
| **Cell membrane** | Selective barrier controlling what enters and leaves. |
| **Vacuole** | Storage sac for water, food, waste. Huge in plants, tiny in animals. |

### Plant cell vs Animal cell

Plant cells have THREE structures that animal cells lack:

1. **Cell wall** — rigid outer layer made of cellulose, gives plants their shape and rigidity.
2. **Chloroplasts** — green organelles that do photosynthesis.
3. **Large central vacuole** — holds water under pressure (turgor) and keeps the plant upright.

Animal cells, lacking these, are typically irregular in shape and softer.

### Prokaryotes vs Eukaryotes

- **Prokaryotes** — bacteria. Simple cells, no nucleus (DNA floats free), no membrane-bound organelles. Smaller.
- **Eukaryotes** — animals, plants, fungi, protists. Have a nucleus and membrane-bound organelles. Larger and more complex.

### Cell theory (NCERT essentials)

Three points:
1. All living things are made of cells.
2. The cell is the basic unit of structure and function in living things.
3. All cells come from pre-existing cells.

Robert Hooke first observed cork cells in 1665 and gave them the name "cell". Schleiden, Schwann, and Virchow developed the formal theory in the 1830s–50s.
`.trim(),
    formulas: [],
    relatedConcepts: ['Nucleus', 'Mitochondria', 'Chloroplast', 'Cell Membrane', 'Prokaryote', 'Eukaryote'],
    imageQueries: ['animal cell structure labelled', 'plant cell structure labelled', 'cell organelles diagram', 'prokaryote vs eukaryote cell'],
    videoQuery: 'Cell structure organelles explained',
  },

  {
    id: 'human-heart',
    subject: 'Biology',
    topicKeyword: 'Human Heart',
    match: [
      ['human', 'heart'],
      ['heart', 'structure'],
      ['heart', 'circulatory'],
      ['circulation', 'blood'],
    ],
    supports3D: false,
    labRoute: 'heart',
    textExplanation: `
## The Human Heart & Circulatory System

A muscular four-chambered pump that drives blood through the body, delivering oxygen and nutrients and carrying waste away.

### The four chambers

- **Right atrium** — receives deoxygenated blood from the body (via the vena cava).
- **Right ventricle** — pumps that deoxygenated blood to the lungs (via pulmonary artery).
- **Left atrium** — receives oxygenated blood from the lungs (via pulmonary veins).
- **Left ventricle** — pumps oxygenated blood out to the rest of the body (via the aorta). Has the thickest muscle wall because it pushes blood the furthest.

### The valves

Four one-way valves prevent backflow:

- **Tricuspid** — between right atrium and right ventricle
- **Pulmonary (semilunar)** — at the exit of the right ventricle
- **Bicuspid / Mitral** — between left atrium and left ventricle
- **Aortic (semilunar)** — at the exit of the left ventricle

The "lub-dub" of a heartbeat is the sound of these valves snapping shut.

### Double circulation

In humans, blood passes through the heart twice per circuit:

1. **Pulmonary circulation** — right side of heart → lungs → back to left side. Picks up oxygen, drops off CO₂.
2. **Systemic circulation** — left side of heart → whole body → back to right side. Delivers O₂ and nutrients, picks up CO₂ and waste.

This double-loop ensures fully oxygenated blood reaches every cell.

### Arteries, veins, capillaries

- **Arteries** — carry blood **away** from the heart. Thick walls because of high pressure. Carry oxygenated blood (except the pulmonary artery).
- **Veins** — carry blood **back** to the heart. Thinner walls, valves to prevent backflow. Carry deoxygenated blood (except the pulmonary veins).
- **Capillaries** — tiny vessels, one cell thick. Where gas + nutrient exchange happens between blood and tissues.

### Blood pressure

Two numbers: **systolic / diastolic**. Normal is about **120/80 mmHg**.
- Systolic = pressure when the heart contracts.
- Diastolic = pressure when the heart relaxes between beats.
`.trim(),
    formulas: [],
    relatedConcepts: ['Circulatory System', 'Arteries', 'Veins', 'Blood', 'Lungs', 'Respiratory System'],
    imageQueries: ['human heart structure labelled', 'heart four chambers diagram', 'double circulation blood flow', 'arteries veins capillaries'],
    videoQuery: 'Human heart structure and circulation explained',
  },

  {
    id: 'dna-structure',
    subject: 'Biology',
    topicKeyword: 'DNA Structure',
    match: [
      ['dna', 'structure'],
      ['double', 'helix'],
      ['dna'],
      ['nucleotide'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## DNA Structure

Deoxyribonucleic acid (DNA) is the molecule that stores the genetic instructions for every living organism. James Watson and Francis Crick, using data from Rosalind Franklin's X-ray work, proposed its structure in 1953.

### The double helix

DNA is a **double helix** — two long strands twisted around each other like a spiral staircase.

### Building blocks: nucleotides

Each strand is a chain of **nucleotides**. A nucleotide has three parts:

1. A **deoxyribose** sugar
2. A **phosphate** group
3. A **nitrogenous base** — one of four:
   - **Adenine (A)**
   - **Thymine (T)**
   - **Guanine (G)**
   - **Cytosine (C)**

### Base pairing rules (Chargaff's rule)

The two strands are held together by hydrogen bonds between complementary bases:
- **A always pairs with T** (2 hydrogen bonds)
- **G always pairs with C** (3 hydrogen bonds)

This means knowing one strand instantly tells you the other.

### The backbone

The sugar and phosphate groups form the **backbone** of each strand. The bases stick out inward like rungs of a ladder, pairing across the helix.

### Anti-parallel strands

The two strands run in opposite directions — one 5' → 3', the other 3' → 5'. This anti-parallel arrangement is critical for replication and transcription.

### Why it matters

The **order** of the bases (A, T, G, C) along the strand is the *code*. Three bases at a time (a **codon**) specify one amino acid. Strings of codons spell out genes, which spell out proteins, which build everything else in the cell.

### Replication

When a cell divides, DNA replicates **semi-conservatively** — the helix unzips, and each old strand acts as a template for a new complementary strand. The result: two identical double helices, each with one old and one new strand.

### Quick facts

- The human genome is about **3 billion base pairs** long.
- If stretched out, the DNA in *one* human cell is about **2 metres long**.
- DNA is found in the **nucleus** of eukaryotic cells (with small amounts in mitochondria and chloroplasts).
`.trim(),
    formulas: ['A pairs with T', 'G pairs with C', 'Length of DNA per cell ≈ 2 m', 'Human genome ≈ 3 × 10⁹ base pairs'],
    relatedConcepts: ['Chromosome', 'Gene', 'RNA', 'Replication', 'Watson and Crick', 'Genetic Code'],
    imageQueries: ['DNA double helix structure', 'DNA nucleotide base pairs', 'DNA replication semi-conservative', 'Watson Crick DNA model'],
    videoQuery: 'DNA structure double helix explained',
  },

  {
    id: 'quadratic-equation',
    subject: 'Math',
    topicKeyword: 'Quadratic Equation',
    match: [
      ['quadratic', 'equation'],
      ['quadratic', 'formula'],
      ['discriminant'],
      ['ax', 'bx', 'c'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Quadratic Equations

A polynomial equation of degree 2 — meaning the highest power of x is 2. Standard form:

\`\`\`
ax² + bx + c = 0
\`\`\`

where a, b, c are constants and **a ≠ 0**.

### The quadratic formula

The single most useful formula in Class 10 math:

\`\`\`
x = (-b ± √(b² - 4ac)) / (2a)
\`\`\`

Plug in the values of a, b, c, and you get the roots (solutions).

### Worked example

> Solve: 2x² - 5x + 3 = 0

a = 2, b = -5, c = 3.

x = (5 ± √(25 - 24)) / 4
x = (5 ± 1) / 4
x = **6/4 or 4/4**
x = **3/2 or 1**

### The discriminant

\`\`\`
D = b² - 4ac
\`\`\`

This number tells you the *nature* of the roots without solving fully:

- **D > 0** → two distinct real roots
- **D = 0** → one repeated real root (the parabola just touches the x-axis)
- **D < 0** → no real roots (two complex roots, parabola doesn't cross the x-axis)

### Three solving methods

1. **Factoring** — fastest when it works. Find p, q such that pq = ac and p+q = b.
   Example: x² - 5x + 6 = 0 → (x-2)(x-3) = 0 → x = 2 or 3.

2. **Quadratic formula** — always works. Use when factoring is ugly.

3. **Completing the square** — rewrites ax² + bx + c as a(x + h)² + k. Useful for proving the quadratic formula itself, and for finding the vertex.

### The graph: a parabola

y = ax² + bx + c plots a parabola.
- If a > 0: opens upward (smile)
- If a < 0: opens downward (frown)
- Vertex at x = -b/(2a)
- The roots are where the parabola crosses the x-axis

### Sum and product of roots

If α and β are the roots:
- α + β = **-b/a**
- α · β = **c/a**

Useful for reconstructing the equation when you know its roots.
`.trim(),
    formulas: ['ax² + bx + c = 0', 'x = (-b ± √(b² - 4ac)) / (2a)', 'D = b² - 4ac', 'Sum of roots = -b/a', 'Product of roots = c/a'],
    relatedConcepts: ['Polynomial', 'Discriminant', 'Roots', 'Parabola', 'Completing the Square'],
    imageQueries: ['quadratic formula equation', 'parabola graph quadratic', 'quadratic discriminant cases', 'completing the square geometry'],
    videoQuery: 'Quadratic equation and quadratic formula explained',
  },

  {
    id: 'pythagorean-theorem',
    subject: 'Math',
    topicKeyword: 'Pythagorean Theorem',
    match: [
      ['pythagoras', 'theorem'],
      ['pythagorean', 'theorem'],
      ['right', 'triangle', 'hypotenuse'],
      ['a', 'squared', 'b', 'squared'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Pythagorean Theorem

In any **right-angled triangle**, the square of the longest side (the **hypotenuse**) equals the sum of the squares of the other two sides.

\`\`\`
a² + b² = c²
\`\`\`

where c is the hypotenuse (the side opposite the right angle) and a, b are the legs.

### Why it's so important

It connects geometry and algebra. It's the foundation of distance calculations in coordinate geometry, vectors, and almost all of physics involving 2D motion or forces.

### Worked example

> A ladder leans against a wall. The base of the ladder is 3 m from the wall, and the top reaches 4 m up. How long is the ladder?

a = 3, b = 4. Find c.
c² = 9 + 16 = 25
c = **5 m**

The triple (3, 4, 5) is a classic *Pythagorean triple* — three integers that satisfy a² + b² = c².

### More Pythagorean triples to remember

- (3, 4, 5)
- (5, 12, 13)
- (8, 15, 17)
- (7, 24, 25)
- (20, 21, 29)

Multiplying any triple by an integer gives another: (6, 8, 10), (9, 12, 15), etc.

### Distance between two points

In coordinate geometry, the distance between (x₁, y₁) and (x₂, y₂) is

\`\`\`
d = √((x₂ - x₁)² + (y₂ - y₁)²)
\`\`\`

This is just the Pythagorean theorem applied to a right triangle whose legs are the horizontal and vertical distances.

### Converse

If a triangle's three sides satisfy a² + b² = c², then the triangle MUST be right-angled (with the right angle opposite c). This is the **converse of the Pythagorean theorem**.

### Why "Pythagoras"?

Named after Pythagoras of Samos (~570–495 BCE), though the theorem was known to Babylonians and Indians well before him. The Indian mathematician **Baudhayana** stated it in the *Sulba Sutras* around 800 BCE.
`.trim(),
    formulas: ['a² + b² = c²', 'd = √((x₂-x₁)² + (y₂-y₁)²)', 'c = √(a² + b²)'],
    relatedConcepts: ['Right Triangle', 'Hypotenuse', 'Distance Formula', 'Trigonometry', 'Pythagorean Triple'],
    imageQueries: ['Pythagorean theorem right triangle', 'a squared plus b squared equals c squared diagram', 'Pythagorean triple 3 4 5', 'distance formula coordinate plane'],
    videoQuery: 'Pythagorean theorem explained with examples',
  },

  {
    id: 'trigonometry-ratios',
    subject: 'Math',
    topicKeyword: 'Trigonometric Ratios',
    match: [
      ['trigonometry'],
      ['sin', 'cos', 'tan'],
      ['sine', 'cosine', 'tangent'],
      ['trigonometric', 'ratio'],
    ],
    supports3D: false,
    labRoute: null,
    textExplanation: `
## Trigonometric Ratios

For a right-angled triangle with a non-right angle θ, three ratios connect the sides to the angle.

### The three primary ratios

Picture a right triangle. The right angle is one of the corners. From the perspective of angle θ:

- **Opposite** — the side directly across from θ.
- **Adjacent** — the leg next to θ (NOT the hypotenuse).
- **Hypotenuse** — the longest side, opposite the right angle.

Then:

\`\`\`
sin θ  =  opposite / hypotenuse
cos θ  =  adjacent / hypotenuse
tan θ  =  opposite / adjacent
\`\`\`

**Memory aid:** **SOH-CAH-TOA**.

### Reciprocals

Three more ratios are just the inverses:

\`\`\`
cosec θ = 1 / sin θ  =  hypotenuse / opposite
sec θ   = 1 / cos θ  =  hypotenuse / adjacent
cot θ   = 1 / tan θ  =  adjacent / opposite
\`\`\`

### Standard angle values to memorise

| θ | sin | cos | tan |
|---|---|---|---|
| 0° | 0 | 1 | 0 |
| 30° | 1/2 | √3/2 | 1/√3 |
| 45° | 1/√2 | 1/√2 | 1 |
| 60° | √3/2 | 1/2 | √3 |
| 90° | 1 | 0 | undefined |

### Pythagorean identities

The three most-used identities in Class 10–11:

\`\`\`
sin²θ + cos²θ = 1
1 + tan²θ = sec²θ
1 + cot²θ = cosec²θ
\`\`\`

### Worked example

> In a right triangle, sin θ = 3/5. Find cos θ and tan θ.

If sin θ = opposite/hypotenuse = 3/5, then opposite = 3 and hypotenuse = 5.
By Pythagoras: adjacent = √(25 − 9) = 4.

- cos θ = 4/5
- tan θ = 3/4

### Where this leads

Trigonometry unlocks:
- **Heights and distances** — finding building heights using angles of elevation.
- **Coordinate geometry** — rotating points, parametrising circles.
- **Physics** — projectile motion, wave equations, AC circuits.
- **Calculus** — derivative of sin x is cos x; integrating sin gives -cos.
`.trim(),
    formulas: ['sin θ = opp/hyp', 'cos θ = adj/hyp', 'tan θ = opp/adj = sin θ / cos θ', 'sin²θ + cos²θ = 1', '1 + tan²θ = sec²θ'],
    relatedConcepts: ['Right Triangle', 'Pythagorean Theorem', 'Identities', 'Heights & Distances', 'Unit Circle'],
    imageQueries: ['trigonometric ratios SOHCAHTOA', 'sin cos tan right triangle', 'trigonometry standard angles table', 'unit circle trigonometry'],
    videoQuery: 'Trigonometric ratios sin cos tan explained',
  },

]
