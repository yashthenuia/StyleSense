-- Add the transparent-cutout URL used by the premium closet wardrobe UI.
-- The cutout is DISPLAY-ONLY; try-on keeps using image_url (white background).
-- Idempotent. Apply once to the live Aurora cluster.
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS cutout_url TEXT;
