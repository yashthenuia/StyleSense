"""
Smoke test for the multi-item wardrobe vision pipeline.

Downloads a known multi-item flat-lay (or uses a local file if you drop one
at testing/multi_outfit.jpg), runs detect_items_from_bytes once, and prints
the results. Costs ~$0.01 in Anthropic credits, no Runway spend.

Usage:
  cd backend
  .\\venv\\Scripts\\python.exe -m tests.probe_detect_items
  .\\venv\\Scripts\\python.exe -m tests.probe_detect_items <local_image_path>
"""
import os
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from services.wardrobe_vision_service import detect_items_from_bytes

# A public flat-lay image with multiple distinct garments (Unsplash, free use).
# Switch to a local file via CLI arg if Unsplash hotlinking ever breaks.
DEFAULT_URL = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1024"


def load_bytes(arg: str | None) -> tuple[bytes, str]:
    if arg and Path(arg).exists():
        path = Path(arg)
        ctype = "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
        return path.read_bytes(), ctype

    # Try the testing/multi_outfit.jpg convention
    fallback = Path(__file__).resolve().parent.parent.parent / "testing" / "multi_outfit.jpg"
    if fallback.exists():
        return fallback.read_bytes(), "image/jpeg"

    import httpx
    print(f"[INFO] Downloading test image from {DEFAULT_URL}")
    with httpx.Client(follow_redirects=True, timeout=20.0) as c:
        r = c.get(DEFAULT_URL)
        r.raise_for_status()
        return r.content, r.headers.get("content-type", "image/jpeg").split(";")[0]


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    img_bytes, ctype = load_bytes(arg)
    print(f"[INFO] Image: {len(img_bytes)} bytes, {ctype}")

    detected = detect_items_from_bytes(img_bytes, ctype)
    print(f"\n[RESULT] {len(detected)} items detected\n")
    print(json.dumps(detected, indent=2))

    if not detected:
        print("\n[FAIL] No items detected. Either the image is wrong or the prompt needs tuning.")
        sys.exit(1)

    missing_name = [d for d in detected if not d.get("name")]
    missing_cat = [d for d in detected if not d.get("category")]
    if missing_name or missing_cat:
        print(f"\n[WARN] {len(missing_name)} item(s) missing name, {len(missing_cat)} missing category.")
        sys.exit(2)

    print(f"\n[OK] All {len(detected)} items have name + category.")


if __name__ == "__main__":
    main()
