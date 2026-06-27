-- =================================================================
-- v2g migration: optional full-body photo analysis.
-- Run in Supabase SQL Editor. Idempotent.
--
-- Stores the Claude-vision read of the user's body + coloring from an
-- optional standing photo uploaded during onboarding. Injected into the
-- Aria stylist prompt for richer, proportion-aware personalization.
-- Shape: { build, skin_tone, hair_color, undertone, notes, gender }
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS body_analysis JSONB;

NOTIFY pgrst, 'reload schema';
