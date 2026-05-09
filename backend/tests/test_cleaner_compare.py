"""
Compare rembg models on multiple input image types to show what works
for what. Demonstrates that:
  1. Clean product photos (Uniqlo-style) clean perfectly with any model.
  2. Occluded "person wearing it" photos can't be fixed by ANY rembg model -
     they need re-synthesis (Runway).

Outputs Supabase URLs for browser comparison.
"""
import sys
import io
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import httpx
from PIL import Image
from rembg import remove, new_session

from services import supabase_service

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

TEST_IMAGES = [
    {
        "label": "CLEAN product photo (Uniqlo t-shirt)",
        "url": "https://image.uniqlo.com/UQ/ST3/us/imagesgoods/465185/item/usgoods_00_465185_3x4.jpg",
        "expected": "Should already look great. Cleaner is a no-op here.",
    },
    {
        "label": "OCCLUDED photo (Wikipedia blazer - hands cover most of it)",
        "url": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Blazer.JPG",
        "expected": "Will look bad with any cutout model. Needs Runway re-synthesis.",
    },
    {
        "label": "FULL person photo (model wearing dress)",
        "url": "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=800",
        "expected": "u2net_cloth_seg should isolate the dress from background+body.",
    },
]

MODELS = ["u2net_cloth_seg", "u2net_human_seg", "isnet-general-use"]

HEADERS = {"User-Agent": "Mozilla/5.0"}


def fit_3x4(img: Image.Image, bg=(255, 255, 255)) -> Image.Image:
    img.thumbnail((768, 1024), Image.LANCZOS)
    canvas = Image.new("RGB", (768, 1024), bg)
    x = (768 - img.width) // 2
    y = (1024 - img.height) // 2
    if img.mode == "RGBA":
        canvas.paste(img, (x, y), mask=img.split()[3])
    else:
        canvas.paste(img, (x, y))
    return canvas


def main():
    rows = []  # collected URL pairs for the final summary
    sessions = {}

    for entry in TEST_IMAGES:
        print(f"\n{'='*72}")
        print(f"INPUT: {entry['label']}")
        print(f"  Source URL: {entry['url']}")
        print(f"  Expected: {entry['expected']}")
        print('='*72)

        # Download original
        try:
            with httpx.Client(timeout=20.0, follow_redirects=True, headers=HEADERS) as c:
                r = c.get(entry['url'])
                r.raise_for_status()
            original_bytes = r.content
        except Exception as e:
            print(f"  [SKIP] Could not download: {e}")
            continue

        # Re-host original to Supabase
        original_supabase = supabase_service.upload_to_storage(
            bucket="wardrobe", user_id=DEMO_USER_ID,
            file_bytes=original_bytes, filename="original.jpg",
            content_type="image/jpeg",
        )
        print(f"  [OK] Original re-hosted: {original_supabase}")

        per_model_urls = {"original": original_supabase}

        for model in MODELS:
            print(f"\n  Trying model: {model}")
            t0 = time.time()
            try:
                if model not in sessions:
                    sessions[model] = new_session(model_name=model)
                cutout_png = remove(original_bytes, session=sessions[model])
                cutout = Image.open(io.BytesIO(cutout_png)).convert("RGBA")
                canvas = Image.new("RGB", cutout.size, (255, 255, 255))
                canvas.paste(cutout, mask=cutout.split()[3])
                fitted = fit_3x4(canvas)
                buf = io.BytesIO()
                fitted.save(buf, format="JPEG", quality=88)

                model_url = supabase_service.upload_to_storage(
                    bucket="wardrobe", user_id=DEMO_USER_ID,
                    file_bytes=buf.getvalue(), filename=f"clean-{model}.jpg",
                    content_type="image/jpeg",
                )
                per_model_urls[model] = model_url
                print(f"    [OK] {time.time()-t0:.1f}s -> {model_url}")
            except Exception as e:
                print(f"    [FAIL] {e}")

        rows.append({"label": entry["label"], "urls": per_model_urls})

    print("\n" + "="*72)
    print("SUMMARY - open URLs in your browser to compare")
    print("="*72)
    for row in rows:
        print(f"\n{row['label']}")
        print(f"  Original                  : {row['urls'].get('original')}")
        for m in MODELS:
            if m in row['urls']:
                print(f"  After {m:<22}: {row['urls'][m]}")


if __name__ == "__main__":
    main()
