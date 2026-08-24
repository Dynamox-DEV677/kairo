# AUDIT-MAP — Phase 0 reconnaissance

Produced 2026-08-24 against `main` (post Update 15, `ddf32b8`). Read-only pass;
no behaviour changed. Line references are approximate by design — they rot.

---

## 1 · Route / screen registry

There is **no URL router**. Navigation is a single `useState` in
`src/pages/Dashboard.tsx`:

- `active: string` — the current page id. Exposed globally as
  `window.__kairoSetActive` (used by pages to cross-navigate, e.g. Goal → Quiz).
- Pages are **all mounted lazily-then-forever**: a `visited` Set adds a page id
  on first visit; after that the page stays mounted and is shown/hidden with
  `display:flex/none` (`pageStyle()`). Consequence: page-local state survives
  tab switches, and *mount-time computations go stale* (two components already
  work around this with IntersectionObserver refresh: `MistakeMuseum`,
  `FocusTodayCard`).
- `PAGE_TITLES` in Dashboard.tsx is the id → title registry (~44 ids).
- Desktop nav: `src/components/Sidebar.tsx` (`STUDENT_NAV` / `TEACHER_NAV` /
  `ADMIN_NAV`, with a `beta:` annotation convention and a DEFAULT_VISIBLE
  fold). Mobile: `src/components/MobileShell.tsx` (bottom bar + drawer groups
  `DRAWER_STUDENT` etc.).
- One page renders exclusively (`camera-live`) because unmounting releases the
  camera. `ErrorBoundary resetKey={active}` clears errors on nav *without*
  remounting (deliberate — a `key=` here previously wiped Study Room state).
- The URL stays `/#` forever → no deep links, no back button, no per-screen
  analytics. Task 9's premise is **correct**.

Student-visible modules (sidebar + drawer union): home, kairo-os, doubt
(Solver, chat/classic), quiz, flashcards, camera, mistakes, museum, goal,
notebook, exam-planner, exam-hall, bridge, reels, listen, rooms, stream,
focus, study-plan, knowledge, formula, essay, teach-back, league,
topic-architect, writing, camera-live, concept-map, battle, simulator,
explain-mistake, concept, pomodoro, school, labs, settings. (~35 — matches
the brief.)

---

## 2 · Persistence map

Three layers coexist — this is the real story behind Task 7:

**Layer A — typed registry (the intended design).** `src/lib/storage.ts`
owns a `KEYS` map (all `kyno:*`), a `kyno:schema` version key, and a
`kairo:→kyno:` migration scaffold. Its own comment says *"Nothing outside
this module should call localStorage directly."*

**Layer B — direct `kairo*` calls that bypass it** (grep-verified counts):

| Key | Writers/readers | Synced? | Notes |
|---|---|---|---|
| `kairo_token` / `kairo_refresh` | ~40 call sites | n/a | Supabase access/refresh tokens, read raw all over (api.ts, quizzes, tts) — storage.ts's own comment says tokens should live in Supabase SDK storage only |
| `kairo_profile`, `kairo_profile_pic` | ~26 sites | partially (users table) | login/profile blobs |
| `kairo:twin:<uid>` | `twin.ts` (`STORAGE_PREFIX = 'kairo:twin:'`) | **yes** — `/api/twin/snapshot` (persistent cloud model, reconcileWithCloud) | the core learner-model store, still on the legacy prefix |
| `kairo_theme`, `kairo:solver-ui`, `kairo:sidebar:*`, `kairo:onboard*`, `kairo:last_uid`, `kairo:conceptmap:view`, `kairo:writing:draft`, `kairo:decor`, `kairo:device-id`, `kairo:sync:enabled`, `kairo_focus_total_min` | 1–2 sites each | no | UI prefs / flags; several have `kyno:` twins in the KEYS registry → **live divergence risk confirmed** |

**Layer C — new `kyno:*` keys written directly** (recent features, also
bypassing storage.ts): `kyno:goal`, `kyno:focus:history`, `kyno:focus:banlist`,
`kyno:listen:{source,hd,hdvoice,nvoice,voice}`, `kyno:room:active`
(sessionStorage), `kyno_tts_voice`. None synced.

**Supabase-synced data:** twin snapshot (events/mastery/flashcards/doubts/
profile + `blob.__game` XP), users table, school-side tables. Everything else
is device-local.

**Task 7 premise: correct, but reframed** — the migration machinery already
exists in storage.ts; the work is (a) finish routing ALL keys through it,
(b) extend the migration table to every Layer-B key incl. `kairo:twin:*`,
(c) the no-new-`kairo:`-writes test the brief asks for.

**Task 8 premise: correct.** Concept Map / Knowledge Graph copy claims
device-only while the twin syncs via `/api/twin/snapshot`. Note: sync is
opt-in-ish (`kairo:sync:enabled`, "Sync now" reconcile) — the copy/behaviour
mismatch is real in both directions.

---

## 3 · AI call map

All providers are server-side behind one Vercel function (`server/app.js`,
~50 mounted routers). Client "openrouter.ts" is **legacy-named** — it actually
POSTs `/api/ai/chat` (`PROXY_URL`), never OpenRouter.

| Endpoint | Provider(s) | Fallback path |
|---|---|---|
| `/api/ai/chat` (+ solver variants) | **Groq** chat completions — model race across `GROQ_MODELS`, key pool `services/groqPool.js` (`GROQ_API_KEYS` CSV, per-key cooldown 429=60s/5xx=30s, revive-if-all-dead) | multi-model race → multi-key rotation → error copy in UI |
| `/api/ai/*` vision (Camera Study label/define) | Groq vision + **Gemini** `gemini-2.5-flash-image:generateContent` appears in aiChat.js (image path) | Groq↔Gemini cross-provider fallback (commit `9615248`) |
| `/api/council/brief` | Groq via shared helpers | **`fallbackBrief()`** — data-built brief, omits fabricatable numbers (added after a 500 loop) |
| `/api/quiz/start`, `/complete` | Groq (board-pattern MCQs) | client shows error; ExamHall proceeds if ≥6 questions gathered |
| `/api/tts` | Groq `canopylabs/orpheus-v1-english` | client chain: Neural (on-device Kokoro) → HD → device voice — never stalls |
| `/api/camera/*` (live) | Groq audio (whisper STT + TTS) + chat | UI error states |
| `/api/document`, `/api/exam-planner`, `/api/essay`, `/api/writing`, `/api/concept`, … | Groq chat | per-route error copy, quality varies |
| **Client-side Kokoro** (`ttsNeural.ts`) | on-device, HuggingFace CDN one-time model download | falls back to HD/device |
| `services/imageSearch.js` | **`pollinations.ai/prompt/`** — free public image endpoint | Task 4's target; see premise notes |

Instrumentation: essentially none beyond `console.warn` — Task 3's ask
(status/latency/failure-reason logging) does not exist yet. There is a
`loadLevel`/`withSlot` concurrency guard in `utils/ai.js` and rate limiting
middleware (`apiLimiter`/`aiLimiter`).

---

## 4 · Content-generation map (model output presented as authoritative)

| Screen | What's generated | Verification today |
|---|---|---|
| Adaptive Quiz | MCQs + correct letter + explanation | **none** |
| Exam Hall | full mock paper (same `/quiz/start`) | **none** — and marks/negative marking amplify a wrong key |
| Revision Simulator | MCQs via client `chat()` prompt | **none** |
| Solver / Chat | worked solutions, NCERT-toned answers | none (curriculum-directive prompts only) |
| Camera Study | OCR answer, balanced equations, diagram labels | equation balancer is deterministic (real solve); diagram recall has a confidence gate; rest unverified |
| Teach Back / Essay / Explain Mistake | grading + feedback | none |
| Question Paper / Lesson Plan (teacher) | full papers | none |
| Formula Sheet / Reels / cloze | student-owned or deterministic transforms | n/a (not model-asserted facts) |

Task 5's premise (**nobody has measured accuracy**) is **correct**. Highest
blast radius: Adaptive Quiz + Exam Hall (same generator, scored, negative
marking) — matches the brief's "start with JEE/NEET Physics+Maths batch".

---

## Premises checked against reality (per the brief's ground rules)

- **Task 1 (LaTeX)** — *plausible and probably right*: the pipeline is
  ReactMarkdown + remark-math + rehype-katex, which accepts `$…$`/`$$…$$` but
  **not** `\(…\)`/`\[…\]` by default. Needs the described repro before fixing.
- **Task 4 (pollinations)** — direction right, prescription conflicts with a
  hard project constraint: **$0 budget, no paid contracts**. Pollinations'
  image API also went Cloudflare-gated/paid earlier this year (known). The
  realistic remediation is: cache + graceful no-image fallback + swap to the
  already-integrated Gemini image path where quota allows — not a paid SLA.
- **Task 10 (cold start)** — premise right, half the fix already shipped:
  starter decks exist in Reels (Update 10) exactly as the brief suggests
  ("pull them forward"); Today's 3 falls back to exam/strength tasks. Missing:
  onboarding seeding + forced diagnostic quiz.
- **Task 12 (native wrapper)** — **premise overtaken by events**: a native
  Android blocker already exists and is built —
  `remotion/out/kyno-focus` (separate app id `app.kairo.focus`, usage-stats +
  overlay wall + foreground service, sideloaded APK delivered 2026-08-24).
  The doc the brief asks for should *document this decision* (merge into main
  app deferred until the Play closed test clears) rather than green-field
  assess Capacitor vs RN.
- **Task 2 (demo twin)** — unverified yet; needs the described repro on the
  demo path before touching anything.
- **Task 11's framing** ("promote SRS / Museum / Focus Lock") matches what
  actually differentiates the product; instrumentation-first is the right
  order and depends on Task 9.

*Not in the brief, found during recon:* the stay-mounted page architecture is
why mount-time data goes stale on revisit (bit the Museum once already, fixed
with an IntersectionObserver pattern — any Task-9 router must keep either the
stay-mounted behaviour or adopt that refresh pattern app-wide, or a class of
"stale on revisit" bugs appears).
