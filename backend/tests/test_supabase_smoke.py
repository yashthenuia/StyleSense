"""Smoke test Supabase: insert + list + storage upload."""
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from services import supabase_service


def main():
    print("[INFO] Testing Supabase connection...")

    # 0. Ensure demo user exists (FK constraint on wardrobe_items)
    fake_user_id = "00000000-0000-0000-0000-000000000001"
    user = supabase_service.upsert_user(
        fake_user_id, email="demo@styleai.local", full_name="Demo User"
    )
    print(f"[OK]   Demo user upserted id={user['id']}")

    # 1. Insert a test wardrobe item
    test_item = supabase_service.insert_wardrobe_item(
        user_id=fake_user_id,
        name=f"smoke-test-{uuid.uuid4().hex[:6]}",
        category="tops",
        image_url="https://example.com/test.jpg",
    )
    print(f"[OK]   Inserted wardrobe item id={test_item['id']}")

    # 2. List items
    items = supabase_service.get_wardrobe_items(fake_user_id)
    print(f"[OK]   Listed {len(items)} items for demo user")

    # 3. Storage upload (tiny PNG: 1x1 transparent pixel)
    PNG_BYTES = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000d49444154789c63000100000005000100020d0a2db40000000049"
        "454e44ae426082"
    )
    try:
        url = supabase_service.upload_to_storage(
            bucket="wardrobe",
            user_id=fake_user_id,
            file_bytes=PNG_BYTES,
            filename="smoke.png",
            content_type="image/png",
        )
        print(f"[OK]   Storage upload returned: {url}")
    except Exception as e:
        print(f"[WARN] Storage upload failed: {e}")
        print("       Did you create the 'wardrobe' bucket in Supabase Storage as PUBLIC?")
        sys.exit(2)

    # 4. Cleanup test item
    supabase_service.delete_wardrobe_item(test_item["id"])
    print("[OK]   Cleaned up test item")

    print("\n[PASS] SUPABASE IS WORKING.")


if __name__ == "__main__":
    main()
