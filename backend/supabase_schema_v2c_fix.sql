-- =================================================================
-- v2c hotfix: ensure users.avatar_document_id exists.
-- Pre-existing 'users' tables created before the column was declared
-- need this. Safe to re-run.
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_document_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_voice_id    TEXT;

-- Force PostgREST to reload its schema cache so the new columns
-- are visible to the API immediately (otherwise takes ~10 minutes).
NOTIFY pgrst, 'reload schema';
