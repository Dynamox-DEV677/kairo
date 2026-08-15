# Kyno — build notes

## Deferred — post-pilot

Explicitly out of scope for the 3-month build. Listed so they are a decision,
not an oversight. Do not start any of these until Phase 0 and Phase 1 pass
their acceptance checks.

| | |
|---|---|
| Additional regional languages | Tamil, Telugu, Marathi, Bengali toggles beyond the Hinglish/Hindi pair. |
| Any-exam framework | Letting a student add SSC / banking / railways / state PSC and get a generated syllabus tree. |
| Stream/career guidance | Post-Class-10 path conversations grounded in in-app performance. |
| "Just want to pass" goal mode | A genuinely different plan and tone for a student not chasing top marks. |
| Micro-sessions | 10–15 minute interruptible chunks with one-tap resume. |
| Verified shortcuts | Exam-speed alternate methods, correctness-checked before display. |
| Negative-marking practice | Guess/skip expected-value read from the student's own accuracy history. |
| Score-to-outcome demystifier | Historical cutoff/percentile patterns from stored data. |
| Handwriting speed drills | Timed neat-copy exercise checked by camera. |
| Effort-sharing circles | Opt-in group sharing minutes and streaks only, never scores. |
| Multi-question sheet marking | Grading a whole photographed paper at once. |
| Repeater/dropper tracking | Year-over-year view for students on a second attempt. |
| Voice-first fallback | Speak a doubt, hear the answer, for low-literacy students. |
| WhatsApp distribution | Share-as-image/PDF into the groups students already use. |

## Known open work

Honest state, so nothing reads as finished when it isn't.

### Phase 0 — foundation

- [x] One source of truth: XP, streak, level, mastery, retention, prediction, weak topics
- [x] Canonical topic model, no duplicate topics
- [x] Deterministic daily plan, survives reload
- [x] Dead ends: 3D-lab quest, League's fake tier, Battle Mode's empty state, "My Tasks" mislabel
- [x] Bottom-nav overlap
- [ ] **Desktop layout above 1024px** — the shell is already flex-row with a docked sidebar above 768px, so the reported "mobile column" needs its real cause found rather than a second layout system stacked on a working one
- [ ] **Merge Home and the Kyno tab** into one dashboard with a "do this now" hero
- [ ] **Trim the sidebar** — 42 items, not the 26 assumed; everything unfinished behind a beta section
- [ ] **Granular notification settings** — study reminders separate, reminders-only default
- [ ] Join-a-school reachable from Settings
- [ ] Audit of all 42 sidebar items for shells

### Phase 1 — differentiator

Not started. Partial groundwork exists and should be extended, not rebuilt:

- `src/data/syllabus/cbse.json` — Class 9–10 Science + Maths chapter/topic tree
- `src/data/syllabus/weightage.cbse.json` — Class 10 marks per chapter
- `server/utils/syllabus.js` — `chapterRef()` and `weightageFor()` give provenance
- Missing: NCERT terminology, definitions and worked examples; the grading engine;
  the golden eval set; proactive mistake detection

## Things worth knowing before touching this repo

- **It is not Next.js.** Vite + React SPA, one Express app behind a single
  serverless function. Several briefs assume Next.js.
- **There is no router.** `App.tsx` switches on view state.
- **`tsc` reports 56 pre-existing errors** and `npm run build` does not run
  `tsc`, so they have never blocked a deploy. Treat 56 as the baseline; a PR
  should not raise it.
- **Two auth middlewares existed** — a self-signed JWT verifier and the
  Supabase one. Routes on the wrong one 401'd forever. Only `routes/auth.js`
  still uses the legacy verifier; retiring it is unfinished business.
- **Four SQL migrations** live in `server/db/`. `RUN_ALL_KYNO_MIGRATIONS.sql`
  concatenates them in dependency order.
- **Pure logic lives in `.js`, not `.ts`** (`selectors.core.js`,
  `knowledgeHygiene.js`, `srs.js`, `cleanupLocalData.js`) with a sibling
  `.d.ts`. That is deliberate: the test suite imports the real module instead
  of a transpiled copy. An earlier attempt to regex-transpile a `.ts` module
  in a test failed in a way that looked exactly like a logic bug.
