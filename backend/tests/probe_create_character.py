"""Probe the LIVE backend /api/avatar/create-character endpoint with a JWT."""
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import httpx
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
BACKEND = "http://localhost:8000"

if not SUPABASE_ANON_KEY:
    print("[FAIL] SUPABASE_ANON_KEY not set in backend/.env")
    print("       Copy NEXT_PUBLIC_SUPABASE_ANON_KEY value into backend/.env as SUPABASE_ANON_KEY=")
    sys.exit(1)

admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
anon = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Create a temporary test user
email = f"probe-{uuid.uuid4().hex[:8]}@example.com"
password = "TestPassword123!"
print(f"[1] Create test user: {email}")
res = admin.auth.admin.create_user({
    "email": email, "password": password, "email_confirm": True,
    "user_metadata": {"full_name": "Probe"},
})
test_user_id = res.user.id
print(f"    user id: {test_user_id}")

print("[2] Sign in to get JWT")
signin = anon.auth.sign_in_with_password({"email": email, "password": password})
jwt = signin.session.access_token
print(f"    JWT: {jwt[:30]}...")

print("[3] Call /api/avatar/create-character")
resp = httpx.post(
    f"{BACKEND}/api/avatar/create-character",
    headers={"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
    json={
        "selfie_url": "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800",
        "name": "My Stylist",
    },
    timeout=60.0,
)
print(f"    status: {resp.status_code}")
print(f"    body  : {resp.text[:1500]}")

print("\n[4] Cleanup: delete test user")
admin.auth.admin.delete_user(test_user_id)
print("    done")
