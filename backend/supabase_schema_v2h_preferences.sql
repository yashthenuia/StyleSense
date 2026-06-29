-- =================================================================
-- v2h migration: "This or That" style preferences.
-- Run in Supabase SQL Editor. Idempotent.
--
-- Accumulates A/B preference signals from the stylist "This or That" tab.
-- Stored as a JSONB array (most recent 50 kept), each entry:
--   { question_id, question, chosen ("a"|"b"), chosen_label }
-- Used to refine future stylist suggestions.
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS style_preferences JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
