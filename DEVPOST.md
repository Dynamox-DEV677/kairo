# Kyno

## Inspiration

I am in Class 9 in Chennai, and I built this for the version of me that gets
stuck at 11pm.

The problem was never a shortage of lessons. There is more free explanation
online than anyone could watch. The problem is that none of it knows anything
about *me*. I would watch a chapter, feel like I understood it, and find out
two months later in a test that I did not. Nothing I used could tell me which
of the things I "knew" in June were quietly gone by March — and that gap is
where marks actually go.

Every app I tried sold the same shape: recorded lectures as a course, priced
monthly. A lecture is identical for everyone who buys it. What I wanted was
something that had actually been paying attention to my mistakes.

## What it does

Kyno keeps one record of what you know, and every screen is a view onto it.

- **Solver** — type a doubt or photograph the question. It names the chapter
  first, then works it the way the board awards marks: formula, substitution,
  units. A blurry photo is refused rather than guessed at.
- **Revision Reels** — a swipe deck built from your own formulas and misses.
  Each card tracks how firmly you hold it *and* how hard you find it, and the
  next date comes from both. As your exam approaches, the spacing compresses.
- **Mistake Museum** — every wrong answer is kept with the full question and
  comes back later as a fresh attempt, **with the options reshuffled**, so
  remembering "it was B" cannot save you.
- **Syllabus Map** — one cell per chapter across every subject, coloured from
  never-opened to solid to fading, each carrying the marks it is typically
  worth. Seeing the untouched region is the feature.
- **Exam Hall** — a board-pattern mock on wall-clock time. No pause button.
  Run out of time and the paper hands itself in.
- **Focus Lock** — a session that reports what you actually did, read from
  your activity rather than from asking you.

Because it is one record, the map, the revision queue and the day plan cannot
disagree with each other.

## How we built it

React 19 + Vite + TypeScript, an Express API behind a single Vercel function,
Supabase for auth and storage, and Groq for every AI call.

Two decisions shaped the codebase more than any framework choice:

**Pure logic lives in plain `.js` with a sibling `.d.ts`.** The scheduler, the
mistake grouping, the syllabus ranking, the error classifier — all importable
by `node --test` with zero build step and zero mocking. That is why there are
441 tests and why they run in twenty seconds.

**The budget was ₹0, and that was a design constraint, not a limitation.**
Groq's free tier, Supabase free tier, Vercel Hobby. It forced choices I now
think are better: on-device neural TTS instead of a paid voice API, a local
memory model instead of a hosted one.

## Challenges we ran into

The honest list, because the interesting failures were not the ones I expected.

**Nearly every real bug was an integration bug.** One page kept a keyboard
listener alive after you navigated away, and because pages stay mounted, it
ate the space bar across the entire app — typing "what is newtons second law"
sent one unreadable word. Two different functions disagreed about where the
auth token lived, and an hour after signing in, seven features started failing
while the rest kept working. Neither was a hard problem. Both were "this is
wider than one person can hold in their head" problems.

**Vercel's 10-second function ceiling.** Every AI endpoint has to finish, or
split, inside it. Exam Hall builds a paper subject by subject for this reason.

**India is not one syllabus.** Seventeen different arrays across fourteen files
each had their own idea of what subjects exist — so a Tamil Nadu student could
be offered Hindi by one screen and not another. It is now one registry built
from the official CBSE codes, and a test fails the build if any module
declares its own list again.

**We shipped a claim that was not true.** Settings said "nothing is sent to
our servers" while the learning record synced continuously. Nobody lied on
purpose; it was written when it was true and never revisited. Fixing it meant
deriving the privacy page from the actual route table, so prose cannot drift
from behaviour again.

## Accomplishments that we're proud of

**Tests that encode decisions, not just code.** The suite asserts things like:
no student-facing string may ever contain an HTTP status; "we're busy" is
unreachable from any status except a real 429; no module may declare its own
subject list; the brand documentation must match the brand code. These make
whole categories of mistake impossible to reintroduce, which matters much more
than the count.

**It refuses to invent things.** If it cannot identify a chapter it writes
"chapter not identified" rather than guessing. If a photo is unreadable it
says so instead of producing five confident, wrong flashcards.

**It never shames you.** No streak-loss guilt, no "you're falling behind". A
missed day is a missed day.

**It is actually shipped** — on Google Play, as a native app.

## What we learned

**The engineering got ahead of the product.** I have 35 screens and no
evidence about how anyone uses them. Every one of those integration bugs was
the cost of building wider instead of deeper.

**Silence is not the same as working.** The AI was down across seven features
and I found out from a screenshot — because errors were being reported to an
in-memory array that dies with every serverless instance. The app said "we've
been alerted" and nobody was. An untested alarm is not an alarm.

**Honest error messages are a feature.** Telling a student "Kyno is busy, a
lot of students are using it" when the real cause was an expired session was
false to them *and* it hid the outage from me. Now a busy message requires an
actual rate limit, and a server fault says "something's broken on our side,
not yours."

## What's next for Kyno

Not more features.

**Ten real students, and I watch three of them use it without helping.** Every
time I want to say "no, tap there", that is a bug, and I write it down instead.
Then I fix only that list. I would bet they use about four of the tools and get
stuck somewhere I would never have predicted.

There is a second reason this is next: Google Play requires 20 testers over 14
days before Kyno can go to production. The product answer and the launch
requirement happen to be the same task.

After that — the two crashing handlers I already know about, and the honest
question of how a free app stays free once real numbers of students are using
it.
