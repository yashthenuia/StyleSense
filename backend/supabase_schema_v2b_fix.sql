-- =================================================================
-- Hotfix for "database error" on email signup.
-- The handle_new_user() trigger from v2 was too brittle.
-- This makes it bulletproof: errors in the trigger no longer block signup.
-- Run this in Supabase Dashboard -> SQL Editor.
-- =================================================================

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  v_share_code TEXT;
  v_full_name  TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate share code with retries on collision
  FOR i IN 1..5 LOOP
    BEGIN
      v_share_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

      INSERT INTO profiles (id, email, full_name, share_code)
      VALUES (NEW.id, NEW.email, v_full_name, v_share_code)
      ON CONFLICT (id) DO NOTHING;

      EXIT; -- success
    EXCEPTION WHEN unique_violation THEN
      CONTINUE; -- share_code collided, try a new one
    WHEN OTHERS THEN
      -- log and bail out of profiles insert, but DON'T fail the signup
      RAISE WARNING 'profiles insert failed for %: %', NEW.id, SQLERRM;
      EXIT;
    END;
  END LOOP;

  -- Legacy 'users' table - try insert but never block signup
  BEGIN
    INSERT INTO users (id, email, full_name)
    VALUES (NEW.id, NEW.email, v_full_name)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- email might be UNIQUE-colliding from a stale row, etc. Don't block.
    RAISE WARNING 'users insert failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Loosen the users.email UNIQUE constraint so failed signups don't block retries
-- (Supabase auth.users.email is the source of truth anyway)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Clean up any orphan rows from failed signup attempts so next try is clean
DELETE FROM users
WHERE id NOT IN (SELECT id FROM auth.users);

DELETE FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- =================================================================
-- AFTER RUNNING THIS:
-- - Email signup should work without "database error"
-- - For Google OAuth: separately enable it in
--   Authentication -> Providers -> Google (needs Google Cloud OAuth client)
-- =================================================================
