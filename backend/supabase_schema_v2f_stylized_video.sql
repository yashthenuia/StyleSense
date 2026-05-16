-- =================================================================
-- v2f migration: per-user stylized ramp-walking video.
-- Run in Supabase SQL Editor. Idempotent.
--
-- Chained after the v2e stylized still image: when the still is ready, a
-- background task animates it via runway_animate (gen4.5 / veo3.1) into a
-- 5s editorial catwalk loop. The dashboard shows this as its hero.
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS stylized_avatar_video_url TEXT;

-- 'idle' | 'generating' | 'ready' | 'failed'
ALTER TABLE users ADD COLUMN IF NOT EXISTS stylized_avatar_video_status TEXT DEFAULT 'idle';

-- Tracks which stylized_avatar_url the video was made from, so we can
-- regenerate when the still avatar changes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS stylized_avatar_video_source TEXT;

NOTIFY pgrst, 'reload schema';
