# StyleSense — Issues & Backlog
_Last updated: 2026-06-25_

---

## 🐛 Bugs

| # | Description | File | Status |
|---|---|---|---|
| B1 | Studio empty-state canvas uses `aspectRatio: "3/4"` but result renders at natural height (72vh). Should both be `9:16`. | `frontend/app/studio/page.tsx` ~line 370 | ✅ Fixed |
| B3 | Runway rate-limit / load balancing — no retry/backoff on 429s in `runway_service.py`. | `backend/services/runway_service.py` | ❓ Unverified |
| B5 | Some pages overflow their container — content doesn't fit inside the screen (universal, excluding landing). | Multiple pages | ✅ Fixed |

---

## 🎨 Tweaks (Frontend)

| # | Description | File | Status |
|---|---|---|---|
| T3 | "Items in this look" cards in Studio should match wardrobe card style (brown border + same thumbnail treatment). | `frontend/app/studio/page.tsx` ~line 390 | ✅ Fixed |
| T4 | The eyebrow + serif title pattern — consider removing subtitle if eyebrow already identifies the tab. | All page headers | ❓ Decide |
| T5 | `<main>` had `overflow-y-auto` causing nested scroll with page's own scroll divs — changed to `overflow-hidden`. | `frontend/components/layout/LayoutClient.tsx` | ✅ Fixed |
| T6 | Blank canvas state: SVG body silhouette (female default, male if bodyType=male). | `frontend/app/studio/page.tsx` | ✅ Fixed |
| T7 | ♀/♂ body type toggle added to Studio right panel "Selected" section (reads/writes Zustand bodyType). | `frontend/app/studio/page.tsx` right panel | ✅ Fixed |
| T11 | Wardrobe header row: action buttons should stay on one line (no wrap). | `frontend/app/wardrobe/page.tsx` | ✅ Fixed |

---

## ✨ Features (Frontend)

| # | Description | Status |
|---|---|---|
| F1 | **Notifications bell** — dedicated icon that opens a drawer listing all background task history with status and result previews. | ✅ Fixed |
| F3 | **"See previous" generations** — history drawer/tab showing past try-ons from Supabase. | ❌ Open |
| F4 | **Wardrobe sort** — ↓ New / ↑ Old / A–Z chips added to wardrobe header row. | ✅ Fixed |
| F5 | **Default faces to try on** — DiceBear illustrated defaults on /onboarding as placeholders. | 🔶 Partial |
| F6 | **Stylist page redesign** — Aria header with context count; suggestion chips as horizontal scroll strip inside chat; wider layout. | ✅ Fixed |
| F7 | **PNG garments + blank canvas** — when garment is cleaned, show transparent PNG; when outfit generated, blank bg until scene is selected. | ✅ Fixed |
| F8 | **Delete recent try-ons** — hover-reveal trash button on each recent try-on card in dashboard. | ✅ Fixed |

---

## ✨ Features (Backend)

| # | Description | Status |
|---|---|---|
| B_F1 | **Default male body/silhouette** — alternate reference body for fit accuracy on male clothing. | ❌ Open |
| B_F2 | **Rate-limit handling** — exponential backoff on Runway 429s in `wait_for_task_output`. | ❌ Open |

---

## ✅ Already Implemented

| Item | Where / Notes |
|---|---|
| Landing page redesign | `app/page.tsx` — aiuta editorial × stylz.in feature moments; split hero, 3 feature sections, SEO JSON-LD |
| Signout shows sidebar/topbar (B4) | `components/AuthProvider.tsx` — added `router.refresh()` before `router.push("/login")` |
| Topbar: ALL CAPS nav labels (T1) | `components/layout/Topbar.tsx` — DASHBOARD / WARDROBE / STUDIO / OUTFITS / ARIA |
| Topbar: tab styling (T1 / B2) | `components/layout/Topbar.tsx` — removed border on inactive tabs, removed grey bg on active |
| Onboarding redesign — "Your Look" | Two-column (face + full body left, DiceBear grid right), fits viewport, improved contrast, body silhouette presets |
| Settings deduplication | Removed avatar upload (→ /onboarding link); added model picker (tryonModel/videoModel); account section only |
| Topbar: brown border + brown brand name | `components/layout/Topbar.tsx` — `rgba(81,50,41,0.3)` border, `var(--ink)` brand color |
| Topbar: remove Friends + Chat icons | `components/layout/Topbar.tsx` — icons + realtime subscriptions removed |
| Dashboard: wardrobe category cards brown border + badge | `app/dashboard/page.tsx` — `var(--ink)` border + monospace badge overlay |
| Dashboard: remove loading spinner | `app/dashboard/page.tsx` — uses shimmer skeletons |
| Wardrobe: item cards brown border + name badge (T2) | `app/wardrobe/page.tsx` — `var(--ink)` border + bottom badge overlay with name |
| Outfits: remove "N looks" count (T12) | `app/outfits/page.tsx` — count span removed |
| Outfits: remove chevron nav buttons (T13) | `app/outfits/page.tsx` — horizontal drag-to-scroll only |
| Background task processing (non-blocking) | `frontend/store/tasks.ts` |
| Push notification on task complete | `toast.success()` in task callbacks |
| Default background presets (event scene) | `EVENT_PRESETS` array in studio |
| Filter for wardrobe items | Category chip row in `wardrobe/page.tsx` |
| Cancel during try-on generation | `cancelTryOn()` in studio |
| Model picker (try-on + video) | `TRYON_MODELS` / `VIDEO_MODELS` dropdowns |
| Running task count in topbar | Loader2 chip in `Topbar.tsx` |
| 9:16 result display (partial) | `maxHeight: 72vh` on video/result |
| LangGraph agentic stylist | `backend/graphs/aria_graph.py` |
| Error / 404 pages | `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx` |
