-- =================================================================
-- v2h migration: "only persist when saved" for try-ons.
-- Run in Supabase SQL Editor. Idempotent.
--
-- Every generation still writes a try_on_results row (needed so event-scene,
-- animate, and share can reference it during the session), but it starts as
-- saved=false and is hidden from history/dashboard. Clicking "Save" in Studio
-- flips it to saved=true. This removes the saved-looks vs try-ons mismatch.
-- =================================================================

ALTER TABLE try_on_results ADD COLUMN IF NOT EXISTS saved BOOLEAN DEFAULT false;

-- Backfill: treat existing try-ons as saved so current history isn't wiped.
UPDATE try_on_results SET saved = true WHERE saved IS NULL OR saved = false;

NOTIFY pgrst, 'reload schema';
