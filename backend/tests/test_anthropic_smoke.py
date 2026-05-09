"""Smoke test Anthropic stylist."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from services import anthropic_service


def main():
    print("[INFO] Testing Anthropic stylist...")
    fake_wardrobe = [
        {"id": "abc-123", "name": "Navy linen blazer", "category": "outerwear", "color": "navy", "occasion": "formal", "tags": ["work", "summer"]},
        {"id": "def-456", "name": "White cotton t-shirt", "category": "tops", "color": "white", "occasion": "casual", "tags": []},
        {"id": "ghi-789", "name": "Beige chinos", "category": "bottoms", "color": "beige", "occasion": "casual", "tags": []},
        {"id": "jkl-012", "name": "Brown leather loafers", "category": "shoes", "color": "brown", "occasion": "formal", "tags": []},
    ]
    reply = anthropic_service.stylist_chat(
        messages=[{"role": "user", "content": "What should I wear to a casual Friday at the office?"}],
        wardrobe_items=fake_wardrobe,
    )
    print("[OK]   Reply received:")
    print("       " + reply.replace("\n", "\n       "))
    ids = anthropic_service.extract_item_ids(reply)
    print(f"[OK]   Extracted item IDs: {ids}")
    assert ids, "Expected at least one [ITEM:id] mention in the reply"
    print("\n[PASS] ANTHROPIC IS WORKING.")


if __name__ == "__main__":
    main()
