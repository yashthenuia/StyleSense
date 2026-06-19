-- =================================================================
-- v2g migration: cached color profile for the Aria stylist agent.
-- Run in Supabase SQL Editor. Idempotent.
--
-- One color profile per user, derived once from their primary selfie via
-- Claude vision (undertone, season, flattering/avoid colors). The Aria
-- LangGraph agent reads this to give color- and occasion-aware advice in
-- both the text stylist and the voice avatar.
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS color_profile JSONB;

-- Track which selfie URL the current profile was made from, so we can
-- recompute when the primary selfie changes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS color_profile_source_selfie TEXT;

NOTIFY pgrst, 'reload schema';
