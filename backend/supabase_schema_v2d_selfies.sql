-- =================================================================
-- v2d migration: support multiple selfies per user.
-- Run in Supabase SQL Editor. Idempotent.
-- =================================================================

-- Array of all uploaded selfie URLs (newest last). avatar_selfie_url stays
-- as the "primary" pointer for backward compat. selfie_urls[0] is the same
-- as avatar_selfie_url after this migration runs.
ALTER TABLE users ADD COLUMN IF NOT EXISTS selfie_urls JSONB DEFAULT '[]'::jsonb;

-- Backfill: existing single selfie becomes the first (and only) entry
UPDATE users
SET selfie_urls = jsonb_build_array(avatar_selfie_url)
WHERE avatar_selfie_url IS NOT NULL
  AND (selfie_urls IS NULL OR selfie_urls = '[]'::jsonb);

NOTIFY pgrst, 'reload schema';
