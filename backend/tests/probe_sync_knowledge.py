"""Probe live /api/avatar/sync-wardrobe-knowledge endpoint."""
import os, sys, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import httpx
from supabase import create_client

admin = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
anon = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))
BACKEND = "http://localhost:8000"

email = f"probe-sync-{uuid.uuid4().hex[:8]}@example.com"
res = admin.auth.admin.create_user({"email": email, "password": "P@ssword123!", "email_confirm": True})
uid = res.user.id
print(f"[1] Created user {uid}")

signin = anon.auth.sign_in_with_password({"email": email, "password": "P@ssword123!"})
jwt = signin.session.access_token

# Need to (a) create a character, (b) add a wardrobe item so sync has something to upload
print("[2] Create character")
char_res = httpx.post(f"{BACKEND}/api/avatar/create-character",
    headers={"Authorization": f"Bearer {jwt}"},
    json={"selfie_url": "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800", "name": "Probe"},
    timeout=120.0)
print(f"    {char_res.status_code}: {char_res.text[:200]}")

print("[3] Add a wardrobe item directly via service role (skip cleaner to be fast)")
admin.table("wardrobe_items").insert({
    "user_id": uid, "name": "Test blazer", "category": "outerwear",
    "occasion": "formal", "color": "navy", "image_url": "https://example.com/x.jpg",
}).execute()

print("[4] Call /api/avatar/sync-wardrobe-knowledge")
sync_res = httpx.post(f"{BACKEND}/api/avatar/sync-wardrobe-knowledge",
    headers={"Authorization": f"Bearer {jwt}"},
    json={}, timeout=60.0)
print(f"    status: {sync_res.status_code}")
print(f"    body  : {sync_res.text[:1500]}")

print("[5] Cleanup")
admin.auth.admin.delete_user(uid)
