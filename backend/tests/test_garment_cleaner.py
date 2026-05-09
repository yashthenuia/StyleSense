"""
Test the garment cleaner end-to-end on a messy real photo (the Wikipedia blazer
with a person wearing it). Compares before/after.

Runs in this order:
1. Download the messy source image
2. Try Runway cleaning (will fail with 'not enough credits' for now)
3. Run rembg cleaning (always works locally)
4. Upload both to Supabase Storage so user can compare in browser

Usage:
    cd backend
    venv\\Scripts\\python.exe -m tests.test_garment_cleaner
"""
import sys
import io
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import httpx

from services import supabase_service
from services.garment_cleaner import (
    clean_with_rembg, clean_with_runway, clean_garment_bytes,
)

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

# A real "messy" garment photo - person wearing a blazer
MESSY_URL = "https://upload.wikimedia.org/wikipedia/commons/8/8d/Blazer.JPG"


def main():
    print("=" * 72)
    print("GARMENT CLEANER TEST")
    print("=" * 72)

    # 1. Download messy original
    print(f"\n[1/4] Downloading messy source: {MESSY_URL}")
    headers = {"User-Agent": "Mozilla/5.0"}
    with httpx.Client(timeout=20.0, follow_redirects=True, headers=headers) as c:
        r = c.get(MESSY_URL)
        r.raise_for_status()
    raw_bytes = r.content
    print(f"  [OK] Got {len(raw_bytes)//1024} KB")

    # 2. Re-host original to get a public URL (needed for Runway path)
    print(f"\n[2/4] Re-hosting original to Supabase...")
    original_supabase_url = supabase_service.upload_to_storage(
        bucket="wardrobe", user_id=DEMO_USER_ID,
        file_bytes=raw_bytes, filename="messy-original.jpg",
        content_type="image/jpeg",
    )
    print(f"  [OK] Original URL: {original_supabase_url}")

    # 3. Try Runway path (expected to fail without credits)
    print(f"\n[3/4] Attempting Runway clean (gen4_image_turbo, ~2 credits)...")
    t0 = time.time()
    runway_url = clean_with_runway(
        image_url=original_supabase_url,
        item_name="navy wool blazer",
        item_category="outerwear",
    )
    elapsed = time.time() - t0
    if runway_url:
        print(f"  [OK] Runway clean done in {elapsed:.1f}s -> {runway_url}")
        # Re-host to our bucket so it doesn't expire
        with httpx.Client(timeout=30.0, follow_redirects=True) as c:
            runway_bytes = c.get(runway_url).content
        runway_supabase = supabase_service.upload_to_storage(
            bucket="wardrobe", user_id=DEMO_USER_ID,
            file_bytes=runway_bytes, filename="clean-runway.jpg",
            content_type="image/jpeg",
        )
        print(f"  [OK] Re-hosted Runway result: {runway_supabase}")
    else:
        print(f"  [SKIP] Runway path unavailable (no credits / api error)")
        runway_supabase = None

    # 4. rembg path (should always work)
    print(f"\n[4/4] Running rembg clean (first run downloads ~170MB model)...")
    t0 = time.time()
    try:
        rembg_bytes = clean_with_rembg(raw_bytes)
        elapsed = time.time() - t0
        print(f"  [OK] rembg clean done in {elapsed:.1f}s ({len(rembg_bytes)//1024} KB output)")
        rembg_supabase = supabase_service.upload_to_storage(
            bucket="wardrobe", user_id=DEMO_USER_ID,
            file_bytes=rembg_bytes, filename="clean-rembg.jpg",
            content_type="image/jpeg",
        )
        print(f"  [OK] Uploaded rembg result: {rembg_supabase}")
    except Exception as e:
        print(f"  [FAIL] rembg crashed: {type(e).__name__}: {e}")
        rembg_supabase = None

    # 5. Test the unified pipeline (which picks Runway then falls back to rembg)
    print(f"\n[5/5] Unified pipeline (auto mode)...")
    pipe_bytes, method = clean_garment_bytes(
        image_bytes=raw_bytes,
        item_name="navy wool blazer",
        item_category="outerwear",
        item_image_url=original_supabase_url,
        prefer="auto",
    )
    print(f"  [OK] Unified pipeline produced {len(pipe_bytes)//1024} KB via method='{method}'")

    print("\n" + "=" * 72)
    print("RESULTS - open these URLs in your browser to compare:")
    print("=" * 72)
    print(f"\n  ORIGINAL (messy, person wearing it):")
    print(f"  {original_supabase_url}")
    if runway_supabase:
        print(f"\n  RUNWAY CLEAN (re-synthesized as studio shot):")
        print(f"  {runway_supabase}")
    else:
        print(f"\n  RUNWAY CLEAN: skipped (Runway has 0 credits)")
    if rembg_supabase:
        print(f"\n  REMBG CLEAN (background removed, garment on white):")
        print(f"  {rembg_supabase}")
    print()


if __name__ == "__main__":
    main()
