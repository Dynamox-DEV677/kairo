# Task 12 — native wrapper for Focus Lock: assessment (and what already exists)

## Premise update — the brief was overtaken by events

A native Android blocker **already exists and is built**: **Kyno Focus**
(`remotion/out/kyno-focus`, app id `app.kairo.focus`, v1.0 APK shipped
2026-08-24). Capacitor shell + ~400 lines of Java:

- `PACKAGE_USAGE_STATS` polling (1s, foreground service, wall-time clock),
- `SYSTEM_ALERT_WINDOW` full-screen wall the instant a banned app opens,
- blocked-attempt counts per app (the native session receipt),
- launcher-intent `<queries>` for the ban-list picker (no
  QUERY_ALL_PACKAGES), fully offline, zero network permissions used.

So the Capacitor-vs-RN-vs-thin-shell question is settled empirically:
**Capacitor**, because the main app is already Capacitor (`app.kairo.kyno`
v1.0.4 on Play closed test) and the whole web codebase survives unchanged —
the blocker itself needed only the one Java plugin.

## What the platforms actually permit

- **Android**: usage-access + overlay is exactly how Forest/AppBlock/Stay
  Focused work. Both are "special app access" grants the user flips in
  Settings (the app deep-links to the right screens). No root, no
  accessibility service (deliberately avoided — Play scrutinises it
  hardest).
- **iOS**: real blocking needs the Screen Time / FamilyControls
  entitlement, which Apple grants case-by-case and which requires a paid
  developer account — out of scope at $0. Not planned.

## Store review risk (the real cost)

Merging the blocker INTO `app.kairo.kyno` adds, at review time:
1. a sensitive-permission declaration for usage access (digital-wellbeing
   category — Kyno genuinely qualifies, but it is human-reviewed),
2. an overlay justification,
3. a foreground-service `specialUse` declaration **plus a demo video**
   (target SDK 34 requirement).

Each is passable; together they are review friction and rejection risk on
an account still inside its 20-tester/14-day closed test. Hence the
standing decision (owner's call, 2026-08-24): **the blocker stays a
separate sideloaded APK until the Play app is stable in production**, then
merges as an update, gated in the dashboard on
`Capacitor.isPluginAvailable('FocusBlocker')` — native users get the real
wall, web users keep the witness mode. Declarations drafted at merge time;
the ~30s demo video must be recorded by the owner.

## Cost estimate

- Already spent: ~1 day (the standalone app exists and is delivered).
- Merge into main app when green-lit: ~half a day of code (copy plugin +
  manifest, gate the Focus Lock page) + the Play declaration/video cycle
  (days-to-weeks of review latency, minutes of actual work).
- Codebase survival: 100% of the web app; the plugin is additive.
