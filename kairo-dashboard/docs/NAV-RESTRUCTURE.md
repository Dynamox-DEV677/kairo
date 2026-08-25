# Task 11 — nav restructure: instrumentation shipped, cut deferred on purpose

The brief's own sequence: instrument first, two weeks of numbers, THEN
propose the cut. The instrumentation shipped with task 9:

- every screen view logs to a local ring buffer; `usageSummary(days)` in
  `src/lib/usage.ts` returns per-module visit counts;
- every view beacons `POST /api/analytics/screen` — production counts come
  from grep'ing `[screen] <id>` in Vercel logs.

## What is already promotable without data (the brief names them)

SRS (Reels/Flashcards), the Mistake Museum, and Focus Lock + receipts are
the three things no competitor ships. They are already in the sidebar's
above-the-fold block.

## The proposal comes ~two weeks after this deploys

Read production `[screen]` counts (and on-device `usageSummary(14)` from a
few real users), then propose: keep the top-N by usage + the three
differentiators pinned; everything else behind "More tools" + search.
Demotion only — every module stays reachable (the never-lock rule).

Until the numbers exist, cutting by taste would repeat the exact mistake
the audit flags. Deferred is the correct state, not an omission.
