-- =================================================================
-- v2e migration: stylized full-body editorial-3D avatar.
-- Run in Supabase SQL Editor. Idempotent.
--
-- One stylized version per user, generated automatically from their
-- primary selfie. Used as the Studio idle hero + the "before" side of
-- the compare slider. Photoreal try-ons still use selfie_urls for face.
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS stylized_avatar_url TEXT;

-- 'idle' | 'generating' | 'ready' | 'failed'
ALTER TABLE users ADD COLUMN IF NOT EXISTS stylized_avatar_status TEXT DEFAULT 'idle';

-- Track which selfie URL the current stylized was made from, so we can
-- regenerate when the primary selfie changes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS stylized_avatar_source_selfie TEXT;

NOTIFY pgrst, 'reload schema';
