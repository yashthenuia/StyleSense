-- Migration: full-body photo for body-aware styling (Aria).
-- The face selfie stays the identity source for try-on; this is used for body/hair
-- analysis + color profile when present. Apply once to the live Aurora cluster.
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_body_url TEXT;
