-- ════════════════════════════════════════════════════════════════════════════
-- Kairo OS · Twin Snapshot — WIPE
--
-- One-shot cleanup. Run in Supabase SQL Editor.
--
-- Kairo is local-first by design: every user's Twin (events, mastery,
-- doubts, concepts, flashcards) lives on their own device's localStorage.
-- The `twin_snapshots` table was a transient cross-device sync hop. To stop
-- accumulating user blobs (each up to 1.5 MB) in Postgres, this script:
--
--   1. Empties every existing row.
--   2. Optionally drops the whole table.
--
-- Step 1 is safe and reversible. Step 2 is destructive — uncomment if you
-- want the table gone for good.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Wipe every snapshot. Users keep their local Twin; only the cloud copy is removed.
DELETE FROM twin_snapshots;

-- 2. (Optional, destructive) Drop the table entirely. Uncomment to use.
-- DROP TABLE IF EXISTS twin_snapshots CASCADE;

-- ── Sanity check ───────────────────────────────────────────────────────────
SELECT
  count(*)                             AS remaining_rows,
  pg_size_pretty(pg_total_relation_size('twin_snapshots')) AS table_size;
