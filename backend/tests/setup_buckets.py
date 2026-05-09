"""One-time helper: create the three Supabase Storage buckets we need."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from services.supabase_service import supabase

BUCKETS = ["wardrobe", "selfies", "tryons"]


def main():
    for name in BUCKETS:
        try:
            supabase.storage.create_bucket(
                name,
                options={"public": True, "file_size_limit": 16 * 1024 * 1024},
            )
            print(f"[OK]   Created bucket: {name}")
        except Exception as e:
            msg = str(e)
            if "already exists" in msg or "Duplicate" in msg or "409" in msg:
                # Already there - try updating to public just in case
                try:
                    supabase.storage.update_bucket(name, options={"public": True})
                    print(f"[OK]   Bucket exists, ensured PUBLIC: {name}")
                except Exception as e2:
                    print(f"[WARN] Bucket exists but couldn't update: {name} ({e2})")
            else:
                print(f"[FAIL] Could not create bucket {name}: {e}")
                sys.exit(1)
    print("\n[PASS] All buckets ready.")


if __name__ == "__main__":
    main()
