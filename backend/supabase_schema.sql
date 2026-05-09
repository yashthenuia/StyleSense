-- =================================================================
-- StyleAI Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- =================================================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT,
  full_name             TEXT,
  avatar_character_id   TEXT,
  avatar_selfie_url     TEXT,
  avatar_voice_id       TEXT,
  avatar_document_id    TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- WARDROBE ITEMS
CREATE TABLE IF NOT EXISTS wardrobe_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN ('tops','bottoms','dresses','outerwear','shoes','accessories')),
  occasion          TEXT CHECK (occasion IN ('casual','formal','evening','sport','beach','any')),
  color             TEXT,
  brand             TEXT,
  tags              TEXT[] DEFAULT '{}',
  image_url         TEXT NOT NULL,
  source_url        TEXT,
  thumbnail_url     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- TRY-ON RESULTS
CREATE TABLE IF NOT EXISTS try_on_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL,
  wardrobe_item_id      UUID,
  result_image_url      TEXT,
  result_video_url      TEXT,
  event_scene_url       TEXT,
  event_context         TEXT,
  prompt_used           TEXT,
  model_used            TEXT,
  runway_task_id        TEXT,
  runway_video_task_id  TEXT,
  status                TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  credits_used          INTEGER,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- SAVED OUTFITS
CREATE TABLE IF NOT EXISTS outfits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  name              TEXT NOT NULL,
  item_ids          UUID[] NOT NULL DEFAULT '{}',
  occasion          TEXT,
  preview_image_url TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seed the demo user (uses a fixed UUID so frontend can hardcode it)
INSERT INTO users (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo@styleai.local', 'Demo User')
ON CONFLICT (id) DO NOTHING;

-- ROW LEVEL SECURITY (permissive for hackathon — service role bypasses anyway)
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wardrobe_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE try_on_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_users"     ON users;
DROP POLICY IF EXISTS "allow_all_wardrobe"  ON wardrobe_items;
DROP POLICY IF EXISTS "allow_all_tryon"     ON try_on_results;
DROP POLICY IF EXISTS "allow_all_outfits"   ON outfits;

CREATE POLICY "allow_all_users"      ON users           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_wardrobe"   ON wardrobe_items  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tryon"      ON try_on_results  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_outfits"    ON outfits         FOR ALL USING (true) WITH CHECK (true);

-- =================================================================
-- AFTER RUNNING THIS SQL: create three Storage buckets in the UI:
-- Storage → New bucket → name: "wardrobe"  → Public bucket: ON
-- Storage → New bucket → name: "selfies"   → Public bucket: ON
-- Storage → New bucket → name: "tryons"    → Public bucket: ON
-- =================================================================
