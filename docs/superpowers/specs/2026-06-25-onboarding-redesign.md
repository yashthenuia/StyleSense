# Onboarding Page Redesign

## Goal
Redesign `/onboarding` to fit in one viewport without scrolling, improve contrast, rename the page, add DiceBear illustrated defaults, and add a full-body section.

---

## Layout

Two-column, fixed-height (fills the content area, no scroll):

```
LEFT (55%)                   RIGHT (45%)
──────────────────────────   ──────────────────────────
[Face Photo section]         [Default Avatars section]
  3 upload slots               6 DiceBear open-peeps tiles
  star/delete on hover         label: "Or start with a look"
  ink border on primary        selecting one sets avatar_url

[Full Body section]
  upload zone OR
  preset buttons: ♀ Female / ♂ Male silhouette
```

---

## Sections

### Page header
- Title: **"Your Look"** (was "Add your selfies")
- Subtitle: "Set your face photo for try-ons and choose a body silhouette."
- Eyebrow: "Setup"

### Left — Face Photo
- Existing 3-slot selfie gallery (upload, set-primary, delete)
- Contrast fix: primary badge → `background: #513229, color: #fff`
- Upload zone border: `2px dashed rgba(81,50,41,0.6)` (was faint)
- Section label: "Face photo" in `var(--ink)` font-display

### Left — Full Body
- Compact section below face photo
- Two preset buttons: **Female** and **Male** (SVG silhouette icon + label)
  - Selecting stores `body_type: "female" | "male"` in Zustand (frontend-only state for now, no backend call needed for hackathon)
  - Selected state: `background: var(--parchment), border: 2px solid var(--ink)`
- Upload zone: same dashed style, label "or upload your own"
  - Uploaded URL stored as `body_photo_url` in Zustand

### Right — Default Avatars
- 6 DiceBear `open-peeps` SVGs, different seeds:
  ```
  seeds: ["Felix", "Mia", "Jordan", "Alex", "Sam", "Taylor"]
  url: https://api.dicebear.com/10.x/open-peeps/svg?seed={seed}
  ```
- Rendered as `<img>` tags in a 2×3 grid
- Clicking one sets it as `avatarSelfieUrl` in Zustand (displayed in topbar)
- Selected state: `outline: 2px solid #513229, outline-offset: 2px`
- Label above grid: "Or start with a look" in `var(--text-muted) text-xs uppercase`
- If user uploads a real selfie, selfie takes precedence

---

## State

All frontend-only (no new backend endpoints needed):

| State | Location | Notes |
|-------|----------|-------|
| `selfies[]` + `primaryUrl` | component state | existing, unchanged |
| `avatarSelfieUrl` | Zustand `useAppStore` | existing; set on DiceBear select |
| `bodyType` | Zustand (new field) | `"female" | "male" | null` |
| `bodyPhotoUrl` | Zustand (new field) | URL if user uploads full-body |

Add `bodyType` and `bodyPhotoUrl` to `store/app.ts`.

---

## Contrast changes
- Section headings: `color: var(--ink)` (was `var(--text-muted)`)
- Primary selfie badge: `background: #513229, color: white`
- Upload dropzone border: `2px dashed rgba(81,50,41,0.6)`

---

## Files to change
- `frontend/app/onboarding/page.tsx` — full rewrite of layout
- `frontend/store/app.ts` — add `bodyType`, `bodyPhotoUrl`, `setBodyType`, `setBodyPhotoUrl`

No backend changes. No new API endpoints.
