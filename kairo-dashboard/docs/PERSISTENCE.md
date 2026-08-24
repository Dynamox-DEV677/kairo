# The persistence model (audit task 8 — decided, explicit)

One namespace (`kyno:*`, enforced by `no-legacy-keys.test.js`), two tiers.

## Tier 1 — the student's record: SYNCS when sync is on

Lives in the twin store (`kyno:twin:<uid>`), snapshots to Supabase via
`/api/twin/snapshot` when cloud sync is enabled (Settings → Sync;
`kyno:sync:enabled`). Restored on a new device by `reconcileWithCloud()`
("Sync now"). Covered by manual export/import too (`TwinBackupModal` in
Kyno OS → a single JSON file that genuinely never leaves the device).

Contents: the event log, mastery/BKT rows, SRS flashcards + scheduling
state, doubts, concepts, formulas, and XP/streak (`blob.__game`).
Derived surfaces (Mistake Museum, Mistake Analysis, retention, prediction)
recompute from this — sync the twin and they come along free.

## Tier 2 — device-local by design: does NOT sync

UI prefs (theme, sidebar, solver mode, voices), drafts, the goal target
(`kyno:goal`), Focus Lock history + ban list, listen prefs, demo/onboarding
flags. Losing these on a device change costs seconds to redo; syncing them
would cost schema surface. Deliberate.

Known gap, accepted for now: goal target and focus history are personal
enough that a future release may fold them into the twin blob. Until then a
new device starts them fresh.

## The rules the copy must follow

1. Never claim "device only" for Tier-1 data without checking
   `getSyncEnabled()` — the claim is conditional and the UI must condition
   it (KairoOS data card and Concept Map do this now).
2. "Nothing leaves your device" is only ever true of the EXPORT FILE and of
   Tier-2 data while sync is off.
3. When sync is off, Tier-1 surfaces must say the honest consequence —
   "clearing browser data wipes it; a new phone starts empty" — and point
   at the two escape hatches (turn on sync / export a backup).

## New device story

- Sync ON: sign in → "Sync now" → twin restored, prefs fresh.
- Sync OFF: export the backup JSON on the old device → import on the new
  one (Kyno OS → data card). No silent survival is implied anywhere.
