# From Supabase to Aurora: The Data Modeling Journey Behind StyleSense

**Published:** June 28, 2026  
**Event:** AWS H0Hackathon + Runway API Hackathon  
**Author:** StyleSense Team  

---

## The Problem We Set Out to Solve

Online fashion returns cost **$816 billion annually**. The root cause? Shoppers can't visualize how clothes actually look on *their* body. Existing virtual try-on tools use generic models — not *you*.

We built **StyleSense**: an AI-powered wardrobe where your avatar literally looks like you, knows every item in your closet, and talks to you about fashion in real time.

This post documents the data modeling decisions that made this possible — from a Supabase-first prototype to an Aurora PostgreSQL backend built for the AWS hackathon.

---

## Phase 1: The Supabase Prototype (Days 1–3)

### Why Supabase First?

Speed. We needed:
- Auth (email/password + Google OAuth) — zero config
- PostgreSQL with Row Level Security — instant multi-tenancy
- Storage buckets for images — public HTTPS URLs for Runway API
- Realtime subscriptions — for chat/friends features
- Free tier generous enough for a hackathon

### Initial Schema (v1)

```sql
-- Core domain tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  avatar_character_id TEXT,      -- Runway Character UUID
  avatar_selfie_url TEXT,        -- Supabase Storage URL
  avatar_voice_id TEXT
);

CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('tops','bottoms','dresses','outerwear','shoes','accessories')),
  occasion TEXT CHECK (occasion IN ('casual','formal','evening','sport','beach','any')),
  color TEXT,
  brand TEXT,
  tags TEXT[] DEFAULT '{}',
  image_url TEXT NOT NULL,       -- Supabase Storage public URL
  source_url TEXT,               -- Original retailer URL
  thumbnail_url TEXT
);

CREATE TABLE try_on_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wardrobe_item_id UUID REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  result_image_url TEXT,
  result_video_url TEXT,         -- gen4.5 animation
  event_scene_url TEXT,          -- gen4_image with background
  event_context TEXT,
  prompt_used TEXT,
  model_used TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  credits_used INTEGER
);

CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_ids UUID[] NOT NULL DEFAULT '{}',
  occasion TEXT,
  preview_image_url TEXT
);
```

### What Worked Beautifully

- **RLS policies** = instant per-user isolation. No backend auth logic needed for data access.
- **Storage buckets** = public HTTPS URLs that Runway accepts natively. No signed URL complexity.
- **Realtime** = chat and friend notifications worked out of the box with Supabase JS client.
- **Auth triggers** = `handle_new_user()` auto-created `profiles` + legacy `users` rows.

### What Started Hurting

| Pain Point | Impact |
|------------|--------|
| **Free tier limits** | 500MB database, 1GB storage — wardrobe images + try-on results + videos add up fast |
| **Connection pooling** | Supavisor (PgBouncer) caused occasional "prepared statement does not exist" errors under load |
| **No IAM auth** | Service role key in backend = elevated privileges we didn't need |
| **Schema migrations** | 8 SQL files (`v2`, `v2b`, `v2c`...`v2h`) — fragile, no version control integration |
| **AWS credibility** | Hackathon judges expect *Aurora* on the architecture diagram |

---

## Phase 2: The Aurora Migration (Day 4)

### Why Aurora Serverless v2?

1. **Hackathon requirement** — "Built on AWS" means using AWS services visibly
2. **True serverless PostgreSQL** — scales to zero, pay-per-use, no connection pooling surprises
3. **IAM authentication** — no database passwords in env vars; short-lived tokens per connection
4. **Millisecond latency** — critical for the demo path (wardrobe loads, try-on saves)
5. **PostgreSQL compatibility** — zero code changes to SQLAlchemy models

### The Hybrid Architecture Decision

We didn't move *everything* to Aurora. The split:

| Data Layer | Technology | Rationale |
|------------|------------|-----------|
| **Core domain** (users, wardrobe, try-ons, outfits) | **Aurora PostgreSQL** | Relational, needs ACID, primary hackathon showcase |
| **Auth** (signup, login, JWT) | **Supabase Auth** | Battle-tested, OAuth providers, zero maintenance |
| **Storage** (images, videos) | **Supabase Storage** | Public HTTPS URLs, CDN, Runway-compatible |
| **Social** (friends, chat, realtime) | **Supabase Tables + Realtime** | WebSocket infrastructure already built |

This is **not** a "Supabase vs Aurora" choice — it's "right tool for each job."

### Aurora Schema Evolution

The consolidated `aurora_schema.sql` merges 8 Supabase migration files into one idempotent DDL:

```sql
-- Key additions for the hackathon demo:
-- v2d: selfie_urls JSONB array (multiple selfies per user)
-- v2e: stylized_avatar_url + status (editorial 3D full-body avatar)
-- v2f: stylized_avatar_video_url + status (5s ramp-walk video)
-- v2g: color_profile JSONB (Claude Vision body analysis)
-- v2h: saved BOOLEAN on try_on_results (dashboard "save" feature)
```

**No RLS on Aurora** — auth enforced in FastAPI layer (FastAPI layer via `Depends(current_user)`). The backend connects as master user; Supabase JWT verified on every request.

### The Migration Script

One-time, idempotent, safe to re-run:

```python
# backend/scripts/migrate_to_aurora.py
TABLES = ["users", "wardrobe_items", "try_on_results", "outfits"]

for table in TABLES:
    rows = supabase.table(table).select("*").execute().data
    for row in rows:
        # ON CONFLICT (id) DO NOTHING preserves original created_at
        insert_into_aurora(table, row)
```

Run once: `python -m scripts.migrate_to_aurora` — picks up new rows on subsequent runs.

---

## Phase 3: Data Modeling for AI Features

### The Wardrobe Knowledge Base Problem

Runway's **Characters API** accepts a Knowledge Base (`.txt` file) that the avatar reads during WebRTC calls. We needed to sync wardrobe data → text → Knowledge Base → avatar.

**Solution:** Structured text format with strict parsing rules:

```
USER WARDROBE:
- Ivory Linen Blazer | Category: outerwear | Occasion: formal | Color: ivory | Brand: ASOS | Tags: summer,work
- Midnight Silk Dress | Category: dresses | Occasion: evening | Color: midnight | Brand: Uniqlo | Tags: party,date
- Nude Leather Loafers | Category: shoes | Occasion: any | Color: nude | Brand: Everlane | Tags: daily,comfort
```

**Sync endpoint:** `POST /api/avatar/sync-stylist-kb` — called at "Start Session" to patch Aria's personality with current wardrobe.

### The Multi-Modal Selfie Strategy

| Selfie Type | Purpose | Stored In |
|-------------|---------|-----------|
| **Face selfie** (portrait) | Runway Character creation — face accuracy for try-on | `users.avatar_selfie_url` |
| **Full-body photo** (optional) | Claude Vision body analysis → `color_profile` JSONB | `users.full_body_url` |
| **Selfie gallery** | Onboarding — user picks "primary" for avatar | `users.selfie_urls` (JSONB array) |
| **Stylized avatar** | Dashboard hero + Studio idle state (editorial 3D) | `users.stylized_avatar_url` + `stylized_avatar_video_url` |

**Key insight:** Try-on uses the *raw face selfie* for identity preservation. The stylized 3D avatar is for *presentation only* (dashboard, Studio idle).

### The Try-On Result Lifecycle

```
wardrobe_items (source)
       │
       ▼
POST /api/tryon/generate (gen4_image_turbo)
       │
       ▼
try_on_results (result_image_url, status='done')
       │
       ├─▶ POST /api/tryon/event-scene (gen4_image) → event_scene_url
       ├─▶ POST /api/tryon/animate (gen4.5) → result_video_url
       └─▶ "Save Outfit" → outfits (item_ids[], preview_image_url)
```

**Credits tracked per row** — `credits_used` column enables budget dashboards.

---

## Phase 4: Production Hardening (Days 5–6)

### Connection Resilience

Aurora Serverless v2 scales to zero. Cold start = ~2-3s. Our fix:

```python
# db.py — SQLAlchemy engine config
pool_pre_ping=True,        # Revive connections dropped by scale-to-zero
pool_recycle=600,          # < IAM token lifetime (15 min)
pool_size=5, max_overflow=5
```

### IAM Token Injection

```python
@event.listens_for(engine, "do_connect")
def _inject_iam_token(dialect, conn_rec, cargs, cparams):
    cparams["password"] = rds.generate_db_auth_token(
        DBHostname=HOST, Port=PORT, DBUsername=USER, Region=REGION
    )
```

Fresh token on *every* connection checkout — no expired-token errors.

### Type Coercion Parity

Supabase client returns UUIDs as strings. Psycopg2 returns `uuid.UUID` objects. Our query helper normalizes:

```python
def _coerce(v):
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, list):
        return [str(x) if isinstance(x, uuid.UUID) else x for x in v]
    return v
```

**Result:** Zero frontend changes. `try_on_results.id` stays a string everywhere.

---

## Lessons Learned

### 1. Start with the Right Abstraction Layer

We built a `services/db.py` helper that mirrors Supabase's `.execute().data` return style. When we swapped Supabase → Aurora, **only the helper changed**. Routers stayed identical.

```python
# Old (Supabase)
result = supabase.table("wardrobe_items").select("*").eq("user_id", uid).execute()
return result.data

# New (Aurora) — same caller interface
rows = db.query("SELECT * FROM wardrobe_items WHERE user_id = :uid", {"uid": uid})
return rows
```

### 2. JSONB for Evolving Schemas

`color_profile`, `selfie_urls`, `style_preferences` — all JSONB. Adding a new analysis field = zero migrations.

```json
{
  "undertone": "warm",
  "season": "autumn",
  "colors": ["olive", "rust", "cream"],
  "avoid": ["neon", "pastel"],
  "confidence": 0.87
}
```

### 3. Array Columns for Relationships

`wardrobe_items.tags TEXT[]` and `outfits.item_ids UUID[]` — PostgreSQL arrays beat join tables for:
- **Read performance** (single row fetch)
- **Atomic updates** (push/pop without transactions)
- **Simplicity** (no `outfit_items` junction table)

### 4. Status Columns > Boolean Flags

`try_on_results.status IN ('pending','processing','done','failed')` enables:
- Optimistic UI (show spinner while `'processing'`)
- Retry logic (re-queue `'failed'`)
- Analytics (success rate per model)

### 5. Demo Data as Code

Pre-seeded demo user + 3 wardrobe items in `aurora_schema.sql` = instant demo environment. No manual setup.

---

## The Final Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Vercel    │────▶│   FastAPI    │────▶│  Aurora Serverless│
│  (Next.js)  │     │  (Backend)   │     │     v2 (IAM)      │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌───────────┐  ┌──────────┐
         │Supabase│  │  Runway   │  │ Anthropic│
         │ Auth+  │  │   API     │  │  (Chat)  │
         │Storage │  │(gen4/4.5/ │  └──────────┘
         │Realtime│  │ Characters)│
         └────────┘  └───────────┘
```

---

## What We'd Do Differently

1. **Start with Aurora** — would save the migration sprint
2. **Use SQLAlchemy models from day 1** — raw SQL is fast to write but hard to refactor
3. **Invest in a proper migration tool** (Alembic) — our 8-file Supabase migration chain was technical debt
4. **Separate read/write connections** — Aurora reader endpoint for dashboard queries

---

## Open Source

The full schema, migration scripts, and backend are in the repo:
🔗 `github.com/yourusername/StyleSense`

---

## Bonus: The "Aha!" Moment

The data model that unlocked the **conversational AI stylist**:

```python
# Stylist tool handler receives:
# User: "What should I wear to a beach wedding?"
# Aria (via Knowledge Base) sees:
#   - Ivory Linen Blazer [ITEM:111...]
#   - Midnight Silk Dress [ITEM:222...]
#   - Nude Leather Loafers [ITEM:333...]
#
# Aria responds: "The Midnight Silk Dress [ITEM:222...] would be stunning at a beach wedding!
# Want me to show you the try-on?"
#
# Frontend parses [ITEM:222...] → clickable card → opens Studio with item pre-selected.
```

**Structured wardrobe text + strict mention format = tool-calling that actually works.**

---

*Built for the AWS H0Hackathon + Runway API Hackathon. Architecture diagram, demo video, and live demo at `stylesense.vercel.app`.*