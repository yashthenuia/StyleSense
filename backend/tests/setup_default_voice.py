"""
ONE-TIME SETUP: create a shared default Runway voice for all users' avatars.

Uses Microsoft Edge's neural TTS (`edge-tts` library) for high-quality female
voice. Defaults to `en-US-AriaNeural` (warm, friendly female).

Usage:
  cd backend
  venv\\Scripts\\python.exe -m tests.setup_default_voice
  # Re-run with FORCE=1 to replace an existing voice
  $env:FORCE="1"; venv\\Scripts\\python.exe -m tests.setup_default_voice
"""
import os
import sys
import asyncio
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import httpx
from services import supabase_service

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"
RUNWAY_KEY = os.getenv("RUNWAY_API_KEY") or os.getenv("RUNWAYML_API_SECRET")
API_BASE = "https://api.dev.runwayml.com/v1"

# Choices (all female, en-US):
#   en-US-JennyNeural   - bright, energetic, unmistakably feminine (recommended)
#   en-US-AriaNeural    - warm, friendly, slightly playful
#   en-US-AvaMultilingualNeural - very natural conversational
#   en-US-EmmaNeural    - confident, polished
VOICE_NAME = os.getenv("EDGE_VOICE", "en-US-JennyNeural")

# Longer, expressive sample. More variation in pitch/intonation = better clone fidelity.
VOICE_TEXT = (
    "Hi sweetie! I'm so happy to be your personal stylist. "
    "Oh my goodness, I just love putting outfits together. "
    "Tell me where you're going and what mood you're in, and I'll pick out "
    "something absolutely gorgeous from your wardrobe. "
    "I love a good blazer with cream chinos, or maybe a flowy dress for date night. "
    "We're going to have so much fun. I can't wait to dress you up for every "
    "moment of your beautiful life. You're going to look amazing today, "
    "I just know it. Let's get started, darling!"
)


def step(msg):
    print(f"\n{'='*72}\n  {msg}\n{'='*72}")


async def generate_neural_tts_mp3(text: str, voice: str, out_path: str):
    """Generate high-quality neural TTS audio using Microsoft Edge's voices."""
    import edge_tts
    # Slightly slower + slightly higher pitch for warmer, sweeter feel
    communicate = edge_tts.Communicate(text, voice, rate="-8%", pitch="+5Hz")
    await communicate.save(out_path)


def main():
    if not RUNWAY_KEY:
        print("[FAIL] RUNWAY_API_KEY not set"); sys.exit(1)

    existing = os.getenv("RUNWAY_DEFAULT_VOICE_ID")
    if existing and existing != "PASTE_HERE" and not os.getenv("FORCE"):
        print(f"[INFO] RUNWAY_DEFAULT_VOICE_ID already set: {existing}")
        print("       Set $env:FORCE=\"1\" to recreate.")
        sys.exit(0)

    step(f"[1/4] Generate neural TTS sample with edge-tts (voice={VOICE_NAME})")
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        mp3_path = f.name
    try:
        asyncio.run(generate_neural_tts_mp3(VOICE_TEXT, VOICE_NAME, mp3_path))
        mp3_bytes = Path(mp3_path).read_bytes()
        print(f"  [OK] Generated {len(mp3_bytes)//1024} KB MP3")
    finally:
        try: os.unlink(mp3_path)
        except Exception: pass

    step("[2/4] Upload MP3 to Supabase Storage")
    public_url = supabase_service.upload_to_storage(
        bucket="selfies", user_id=DEMO_USER_ID,
        file_bytes=mp3_bytes, filename="default-voice.mp3",
        content_type="audio/mpeg",
    )
    print(f"  [OK] {public_url}")
    with httpx.Client(timeout=15.0) as c:
        r = c.head(public_url, follow_redirects=True)
    print(f"  [OK] HEAD {r.status_code} ({r.headers.get('content-type')})")

    step("[3/4] POST /v1/voices to clone")
    payload = {
        "name": f"StyleAI Stylist ({VOICE_NAME})",
        "from": {"type": "audio", "audio": public_url},
    }
    with httpx.Client(timeout=120.0) as c:
        r = c.post(f"{API_BASE}/voices",
            headers={
                "Authorization": f"Bearer {RUNWAY_KEY}",
                "X-Runway-Version": "2024-11-06",
                "Content-Type": "application/json",
            }, json=payload)
    if r.status_code >= 400:
        print(f"  [FAIL] {r.status_code}: {r.text[:600]}"); sys.exit(2)
    voice_id = r.json().get("id")
    if not voice_id:
        print(f"  [FAIL] No id in response: {r.json()}"); sys.exit(3)
    print(f"  [OK] Voice created: {voice_id}")

    step("[4/4] Add this to backend/.env")
    print(f"\n  RUNWAY_DEFAULT_VOICE_ID={voice_id}\n")


if __name__ == "__main__":
    main()
