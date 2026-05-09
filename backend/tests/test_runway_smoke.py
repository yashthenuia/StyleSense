"""
Smoke test for Runway API connectivity.
Run BEFORE doing any other backend work.

Usage:
  cd backend
  venv\\Scripts\\python.exe -m tests.test_runway_smoke
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from runwayml import RunwayML, TaskFailedError, TaskTimeoutError


def main():
    api_key = os.getenv("RUNWAY_API_KEY") or os.getenv("RUNWAYML_API_SECRET")
    if not api_key or api_key.startswith("PASTE"):
        print("[FAIL] RUNWAY_API_KEY not set (still PASTE_HERE). Edit backend/.env first.")
        sys.exit(1)

    print(f"[OK]   Loaded Runway key: {api_key[:12]}...{api_key[-4:]}")

    client = RunwayML(api_key=api_key)
    print("[OK]   RunwayML client initialized")

    # Use picsum.photos (stable CDN designed for testing) as reference
    TEST_REF = "https://picsum.photos/seed/styleai/512/768.jpg"

    print("\n  -> Generating test image (gen4_image_turbo, ~2 credits, 10-20s)...")
    try:
        task = client.text_to_image.create(
            model="gen4_image_turbo",
            prompt_text="A photorealistic landscape inspired by @ref, golden hour lighting",
            ratio="1280:720",
            reference_images=[{"uri": TEST_REF, "tag": "ref"}],
        ).wait_for_task_output(timeout=180)
    except TaskFailedError as e:
        print(f"[FAIL] Task failed: {e.task_details}")
        sys.exit(2)
    except TaskTimeoutError:
        print("[FAIL] Timed out (3 min)")
        sys.exit(3)
    except Exception as e:
        print(f"[FAIL] Unexpected error: {type(e).__name__}: {e}")
        sys.exit(4)

    if not task.output:
        print(f"[FAIL] Task succeeded but no output: {task}")
        sys.exit(5)

    image_url = task.output[0]
    print(f"[OK]   Generated image URL: {image_url}")
    print(f"[OK]   Task ID: {task.id}")
    print("\n[PASS] RUNWAY API IS WORKING. Safe to build the rest.")


if __name__ == "__main__":
    main()
