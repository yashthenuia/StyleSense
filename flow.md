# StyleSense UX Redesign Plan

## Context
Major UX overhaul across Studio, Dashboard, Chat, and Stylist to create a more immersive "user is the model" experience. The core concept: the user's AI-generated default body (already generated as `stylizedAvatarUrl`) becomes the persistent canvas across the entire app — try-ons render onto it, it stands in the Studio closet, it appears in the Dashboard as a scrollable model grid.

---

## 1. Avatar Onboarding Enhancement

### What changes
- Onboarding selfie flow adds an **optional "full body" standing photo upload**
- If user provides it: backend cuts background (rembg or Runway), runs Claude vision analysis for body proportions + color palette (skin tone, hair, undertones)
- Analysis stored as JSON on the `users` table (new column `body_analysis`)
- Used later by the stylist as personalization context

### Backend changes
**`backend/routers/avatar.py`** — add new endpoint:
```
POST /api/avatar/upload-body-photo
```
- Accepts multipart `file` + `gender` ("male"|"female") form fields
- Runs `garment_cleaner` with `clean="rembg"` to cut background
- Calls Claude vision (`anthropic_service`) with the cleaned photo to extract body structure (height/build estimate) and color analysis (skin tone, hair color, undertone)
- Stores `body_analysis` JSON on `users` row via `supabase_service`
- Returns `{nobg_url, body_analysis}`

**`backend/models/schemas.py`** — add `BodyAnalysis` Pydantic model:
```python
class BodyAnalysis(BaseModel):
    build: str          # "petite" | "slim" | "athletic" | "curvy" | "tall"
    skin_tone: str      # e.g., "warm medium"
    hair_color: str
    undertone: str      # "warm" | "cool" | "neutral"
    notes: str          # free-text from Claude
```

**`backend/services/anthropic_service.py`** — add `analyze_body_photo(image_url) → BodyAnalysis` function using Claude vision.

**`backend/routers/stylist.py`** — fetch `body_analysis` from users table and inject into system prompt for richer personalization.

**Database:** Apply a new `supabase_schema_v2g_body.sql` adding `body_analysis JSONB` to `users`.

### Frontend changes
**`frontend/app/onboarding/page.tsx`** — after selfie upload step, add optional "Upload a full-body standing photo" step with body/gender selector. POST to new endpoint. Store `bodyAnalysis` in Zustand app store.

**`frontend/store/app.ts`** — add `bodyAnalysis: BodyAnalysis | null` state field.

---

## 2. Studio — Digital Walk-in Closet

### What changes
Complete visual redesign of the Studio page to feel like a walk-in closet:
- **Left panel**: virtual closet with category sections (hangers rail for clothing, shelf rows for accessories). Background-removed item images hung on SVG hanger icons or placed on shelf surfaces. Horizontally scrollable within each category row.
- **Center**: default body stands on a round circular platform/ramp. Shows `stylizedAvatarUrl` when no items selected. Shows generated try-on result when available.
- **Right panel**: generation controls (same as today but cleaner).

### Frontend changes — `frontend/app/studio/page.tsx` (major rewrite)

**Closet layout structure:**
```
[Closet Rail — Tops]       ←→ scroll
[Closet Rail — Bottoms]    ←→ scroll
[Closet Rail — Outerwear]  ←→ scroll
[Shelf — Accessories (shoes, bags, glasses, jewellery, belts)] ←→ scroll
```

- Each item in the rail renders as a `WardrobeItem` image inside an SVG/CSS hanger component, or on a stylized shelf plank for accessories.
- Items clickable to select/deselect (same `selectedItemIds` logic as today).
- Selected items show a gold ring / checkmark overlay.
- Body canvas in center: circular "ramp" platform (SVG circle + subtle gradient). Shows `stylizedAvatarUrl`. When try-on generated, transitions to result with framer-motion crossfade.
- "Manifesting this" button below the body triggers try-on using the **stylized avatar** as the base selfie (not raw selfie) to keep all try-ons consistent with the same default body pose.

**Key reuse:**
- `store/app.ts` — `selectedItemIds`, `stylizedAvatarUrl`, `stylizedAvatarStatus`
- `store/tasks.ts` — `startTryOn`, task polling
- `lib/api.ts` — `apiPost` for all generation calls
- `components/studio/GeneratingState.tsx` — reuse loading screen

**New components:**
- `components/studio/HangerRail.tsx` — horizontal scroll rail with SVG hanger per item
- `components/studio/AccessoryShelf.tsx` — horizontal scroll shelf row
- `components/studio/BodyCanvas.tsx` — circular platform + avatar display + before/after slider

---

## 3. Dashboard — "User Is the Model" Horizontal Scroll

### What changes
- Replace the current 4-step onboarding cards with a hero section showing the user's stylized avatar video (already exists: `stylizedVideoUrl`)
- Below: **horizontal scrolling grid of recent try-ons**, each displayed as a cut-out (background removed via `nobgUrl` if available, else result image) on a subtle neutral background chip
- Caption: outfit name or item names used
- Each card tappable → opens `TryOnDetailModal`
- "You are the model" label above the scroll

### Frontend changes — `frontend/app/page.tsx`
- Fetch recent try-ons from `GET /api/tryon/recent` (already exists in `tryon.py`)
- Render horizontal `overflow-x-auto` flex row of try-on cards
- Try-on card component: fixed height ~280px, uses `result_image_url` (or `nobg_url` if added to schema), shows item name footer
- Hero above: `stylizedVideoUrl` autoplay muted loop, or `stylizedAvatarUrl` still, with user name + "your style reel" text

**New component:** `components/dashboard/TryOnReel.tsx` — horizontal scroll strip of try-on cards

---

## 4. Chat — Photo Upload + Studio Send

### What changes
**a) User photo upload in chat:** add a camera/image icon in the chat input bar. User picks a photo; it gets uploaded to Supabase and the URL is sent to the stylist endpoint alongside the message. Backend Claude vision analyzes the uploaded photo as additional context.

**b) Suggested items → Studio:** when the stylist reply includes `suggested_item_ids`, a "Try in Studio" button appears in the chat bubble. Clicking it sets `selectedItemIds` in Zustand and navigates to `/studio`, where the items auto-appear selected in the closet.

### Backend changes
**`backend/routers/stylist.py`** — add optional `image_url: str | None` field to `StylistChatRequest`. When provided, Claude vision describes the image and it's prepended to the user message as context.

**`backend/models/schemas.py`** — update `StylistChatRequest` to include `image_url`.

### Frontend changes
**`frontend/app/stylist/page.tsx`** (and/or `chat/page.tsx`):
- Add file input icon in message input footer
- On file select: `apiUpload` to `POST /api/avatar/upload-selfie` or a new generic storage endpoint → get back URL → attach to next message send
- On suggested items reply: render "Try in Studio →" button that runs `setSelected(ids)` then `router.push('/studio')`

---

## 5. Stylist — "This or That" Daily Tab

### What changes
New second tab in the Stylist page: **"This or That"**. Agent presents two outfit options (from user's actual wardrobe items or hypothetical styles) and the user picks one. The agent accumulates these preference signals to refine future suggestions. Simple binary A/B swipe card UI.

### Backend changes
**`backend/routers/stylist.py`** — add:
- `GET /api/stylist/this-or-that` — generates a new A/B pair from wardrobe. Returns `{option_a: {item_ids, label, preview_url}, option_b: {item_ids, label, preview_url}, question: str}`
- `POST /api/stylist/this-or-that/vote` — body `{chosen: "a"|"b", question_id: str}`. Appends preference to `users.style_preferences JSONB[]`. Used in next stylist session prompt.

**`backend/models/schemas.py`** — add `ThisOrThatResponse`, `ThisOrThatVoteRequest`.

**`backend/services/anthropic_service.py`** — add `generate_this_or_that(wardrobe_items) → ThisOrThatResponse` using Claude to pick two contrasting styles from user's wardrobe.

**Database:** `supabase_schema_v2h_preferences.sql` — add `style_preferences JSONB[]` to `users`.

### Frontend changes
**`frontend/app/stylist/page.tsx`** — add "This or That" tab alongside existing "Chat" and "Voice" tabs:
- Fetches a question on tab open: `GET /api/stylist/this-or-that`
- Displays two cards side by side (item images + outfit label)
- User taps A or B → POST vote → fetch next question
- Framer-motion card swipe animation
- After 5 votes: "All done for today! Come back tomorrow"

---

## Critical Files Modified

| File | Change |
|------|--------|
| `frontend/app/studio/page.tsx` | Complete rewrite — closet layout |
| `frontend/app/page.tsx` | Dashboard hero + try-on reel |
| `frontend/app/stylist/page.tsx` | This or That tab + photo upload + Studio send |
| `frontend/app/onboarding/page.tsx` | Standing photo upload step |
| `frontend/store/app.ts` | Add `bodyAnalysis`, preserve existing state |
| `frontend/types/index.ts` | Add `BodyAnalysis`, `ThisOrThat` types |
| `backend/routers/avatar.py` | `upload-body-photo` endpoint |
| `backend/routers/stylist.py` | This or That endpoints + image_url in chat |
| `backend/services/anthropic_service.py` | `analyze_body_photo`, `generate_this_or_that` |
| `backend/models/schemas.py` | New Pydantic models |
| `backend/supabase_schema_v2g_body.sql` | New (create file) |
| `backend/supabase_schema_v2h_preferences.sql` | New (create file) |

**New frontend components:**
- `frontend/components/studio/HangerRail.tsx`
- `frontend/components/studio/AccessoryShelf.tsx`
- `frontend/components/studio/BodyCanvas.tsx`
- `frontend/components/dashboard/TryOnReel.tsx`

---

## Verification

1. **Studio closet**: Start frontend, go to `/studio`, confirm wardrobe items render on hangers by category, confirm body canvas shows `stylizedAvatarUrl`, select 2 items → "Manifesting this" → triggers try-on using stylized avatar as base.
2. **Dashboard reel**: Go to `/` after generating some try-ons, confirm horizontal scroll shows try-on cards.
3. **Onboarding body photo**: Go to `/onboarding`, complete selfie step, see optional standing photo upload, upload a photo, confirm analysis returns in network tab.
4. **Chat studio send**: In Stylist, receive a suggestion with item IDs, click "Try in Studio" button, confirm Studio opens with those items pre-selected.
5. **This or That**: Open Stylist → "This or That" tab, confirm A/B cards render, vote, confirm next question loads.
