"""
ONE-TIME SETUP: animate the shared admin stylist (Aria) into a 5s editorial
ramp-walking video for the Dashboard hero.

Reads the current Aria character's processed image from Runway, calls
runway_animate with the shared RAMP_WALK_PROMPT, rehosts the MP4 to Supabase
Storage, and prints STYLIST_HERO_VIDEO_URL for the user to paste into both
backend/.env and frontend/.env.local.

Cost: ~60-100 credits (veo3.1 or gen4.5 image-to-video). One-time.

Usage (PowerShell):
  cd backend
  .\\venv\\Scripts\\python.exe -m scripts.animate_admin_stylist

  # Re-run with FORCE=1 to replace an existing video URL
  $env:FORCE="1"; .\\venv\\Scripts\\python.exe -m scripts.animate_admin_stylist
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import httpx

from services import supabase_service
from services.runway_service import runway_animate

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"
RUNWAY_KEY = os.getenv("RUNWAY_API_KEY") or os.getenv("RUNWAY_API_SECRET") or os.getenv("RUNWAYML_API_SECRET")
CHAR_ID = os.getenv("STYLIST_CHARACTER_ID")
API_BASE = "https://api.dev.runwayml.com/v1"

# Aria-specific motion prompt - overrides the shared RAMP_WALK_PROMPT because
# Aria's source portrait shows shoulders only; without explicit clothing
# guidance the image-to-video model invents a partial / revealing outfit.
# Per-user videos still use the shared prompt in avatar_pose_service.py.
ARIA_RAMP_WALK_PROMPT = (
    "Editorial 3D fashion runway: the stylist character walks confidently "
    "forward toward the camera in a smooth catwalk strut, model gait, "
    "subtle head movement, gentle hair sway, soft cinematic camera tracking. "
    "She is wearing a complete tailored editorial designer outfit — an "
    "elegant high-neck long-sleeve cream knit top tucked into wide-leg "
    "camel trousers, with sleek pointed-toe heels. Full body visible head "
    "to feet, fully clothed and professionally styled, no exposed shoulders "
    "or midriff, no swimwear, no lingerie. Preserve the stylized 3D "
    "character aesthetic and her exact face from the source image. Clean "
    "neutral warm grey studio background with subtle gold rim light. "
    "Loopable seamless motion, 5 second cinematic clip, 8K fashion editorial."
)


def step(label):
    print(f"\n{'='*72}\n  {label}\n{'='*72}")


async def main():
    if not RUNWAY_KEY:
        print("[FAIL] RUNWAY_API_KEY not set in backend/.env"); sys.exit(1)
    if not CHAR_ID:
        print("[FAIL] STYLIST_CHARACTER_ID not set. Run setup_admin_stylist first.")
        sys.exit(1)

    if os.getenv("STYLIST_HERO_VIDEO_URL") and not os.getenv("FORCE"):
        print(f"[INFO] STYLIST_HERO_VIDEO_URL already set. Set $env:FORCE=\"1\" to replace.")
        sys.exit(0)

    step("[1/4] Fetch current Aria portrait URL from Runway")
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(
            f"{API_BASE}/avatars/{CHAR_ID}",
            headers={"Authorization": f"Bearer {RUNWAY_KEY}", "X-Runway-Version": "2024-11-06"},
        )
    if r.status_code >= 400:
        print(f"[FAIL] Could not fetch avatar ({r.status_code}): {r.text[:200]}")
        sys.exit(2)
    data = r.json()
    aria_image_url = data.get("processedImageUri") or data.get("referenceImageUri")
    if not aria_image_url:
        print(f"[FAIL] No image URL on avatar record: {data}")
        sys.exit(3)
    print(f"  [OK] Aria portrait: {aria_image_url[:90]}...")

    step("[2/4] Animate via runway_animate (~60-100 credits, ~60s)")
    try:
        # Sync call - blocking. Run in thread so the asyncio loop isn't stuck.
        loop = asyncio.get_running_loop()
        # Hero ramp video is landscape - matches the dashboard hero card.
        result = await loop.run_in_executor(
            None,
            lambda: runway_animate(
                aria_image_url,
                motion_prompt=ARIA_RAMP_WALK_PROMPT,
                ratio="1280:720",
            ),
        )
    except RuntimeError as e:
        print(f"[FAIL] Animation failed: {e}")
        sys.exit(4)

    runway_video_url = result.get("video_url")
    if not runway_video_url:
        print(f"[FAIL] No video_url in result: {result}")
        sys.exit(5)
    print(f"  [OK] Runway video: {runway_video_url[:90]}...")
    print(f"  [OK] Model used: {result.get('model_used')}")

    step("[3/4] Rehost to Supabase Storage")
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as c:
        v = await c.get(runway_video_url)
        v.raise_for_status()
    permanent_url = supabase_service.upload_to_storage(
        bucket="selfies",
        user_id=DEMO_USER_ID,
        file_bytes=v.content,
        filename="aria-ramp.mp4",
        content_type="video/mp4",
    )
    print(f"  [OK] Permanent URL: {permanent_url}")

    step("[4/4] DONE - paste this into backend/.env AND frontend/.env.local")
    print(f"\n  STYLIST_HERO_VIDEO_URL={permanent_url}\n")
    print("  Then restart both servers.")


if __name__ == "__main__":
    asyncio.run(main())
