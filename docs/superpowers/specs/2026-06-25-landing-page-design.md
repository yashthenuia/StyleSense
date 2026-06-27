# Landing Page Design — StyleSense
**Date:** 2026-06-25  
**Route:** `/` (public, unauthenticated only — authenticated users redirect to `/dashboard`)

---

## Goal

Convert visitors into sign-ups by making them *feel* what StyleSense does before reading about it. Aesthetic-first, copy-minimal — an editorial fashion experience, not a product page.

**Inspiration:** aiuta.com (editorial restraint, near-silence) × stylz.in (feature showcase moments)

---

## Scroll & Overflow

`globals.css` sets `overflow: hidden` on `html, body` for the app shell. The landing page overrides this by wrapping its content in a `<div className="landing-scroll">` with:

```css
.landing-scroll {
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}
```

No changes to `globals.css` or `middleware.ts`.

---

## Page Sections

### 1. Navbar
- Logo "StyleSense" left — Cormorant Garamond, `var(--gold)` color
- Right: "Sign in" (text link) + "Get started" (minimal outlined button)
- Transparent background, no border, no shadow
- Position: `sticky top-0 z-50` with subtle backdrop blur on scroll

### 2. Hero — Split Screen (100vh)
- **Left half**: Full-height editorial image — tall portrait fashion photo. Placeholder: a high-quality Unsplash fashion editorial. Object-fit cover, no border-radius.
- **Right half**: Vertically centered, left-aligned text block
  - Eyebrow: `AI WARDROBE · VIRTUAL TRY-ON` — `font-mono text-xs tracking-[0.25em]` in `var(--text-dim)`
  - H1: `"Wear it\nbefore\nyou buy it."` — Cormorant Garamond, ~6vw, `var(--text)`, line-height 1.0
  - Subline: one sentence max — `"Upload a selfie. Try on any outfit. See yourself anywhere."` — DM Sans, muted
  - CTA: `"Get started — it's free"` — minimal pill button, `var(--ink)` bg, white text
  - Secondary: `"Sign in"` text link below, dimmed

### 3. Feature Section 1 — Try-On (100vh)
- **Right**: Full-height editorial mockup image (try-on result visual)
- **Left**: Vertically centered
  - Label: `"01"` — mono, `var(--text-dim)`
  - H2: `"See yourself\nin anything."` — Cormorant Garamond, large
  - One sentence: `"Upload a photo. Add any garment. AI places it on you in seconds."`
- Alternating: image right, text left

### 4. Feature Section 2 — Scene Placement (100vh)
- **Left**: Full-height editorial scene image (model in environment)
- **Right**: Vertically centered
  - Label: `"02"` — mono
  - H2: `"Any outfit.\nAny world."` — Cormorant Garamond
  - One sentence: `"Place yourself on a runway, a rooftop, a beach. One prompt, any scene."`
- Alternating: image left, text right

### 5. Feature Section 3 — AI Stylist (100vh)
- **Right**: Full-height editorial chat/stylist visual
- **Left**: Vertically centered
  - Label: `"03"` — mono
  - H2: `"A stylist that\nknows your closet."` — Cormorant Garamond
  - One sentence: `"Chat with an AI that has read every piece you own and knows what works."`
- Alternating: image right, text left

### 6. Closing CTA Section (~50vh)
- Centered, full-width
- One typographic statement: `"Your wardrobe, finally intelligent."` — Cormorant Garamond, large italic
- CTA button: `"Get started — it's free"` centered below
- Secondary: `"Already have an account? Sign in"` — dimmed text link
- No background variation — same cream as page

---

## Images

All images are editorial fashion photography from Unsplash (free, no attribution required for non-commercial use). Chosen for: tall portrait orientation, minimal/neutral backgrounds, diverse subjects. Placeholders until real screenshots exist.

Future swap: replace with actual StyleSense try-on result screenshots once generated.

---

## SEO

- `<title>`: `StyleSense — AI Wardrobe & Virtual Try-On` (already set)
- `<meta name="description">`: Keep existing, already good
- `canonical`: `/`
- `<h1>` on hero headline, `<h2>` on each feature headline — only one H1 on the page
- OG tags: `og:title`, `og:description`, `og:image` (placeholder `/og-image.png` for now)
- Twitter card meta
- `JSON-LD` SoftwareApplication schema block in `layout.tsx` or page head:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "StyleSense",
    "applicationCategory": "LifestyleApplication",
    "description": "AI-powered wardrobe, virtual try-on, and personal stylist.",
    "operatingSystem": "Web"
  }
  ```

---

## Typography & Color (using existing tokens)

| Element | Font | Size | Color |
|---|---|---|---|
| H1 / H2 | Cormorant Garamond | clamp(3rem, 6vw, 5.5rem) | `var(--text)` |
| Eyebrow / Labels | JetBrains Mono | 0.7rem, tracking-wide | `var(--text-dim)` |
| Body / sublines | DM Sans | 1rem–1.1rem | `var(--text-muted)` |
| CTA button | DM Sans 500 | 0.9rem | white on `var(--ink)` |

---

## What's NOT in this page

- No numbered step cards (cut)
- No feature icons or badges
- No testimonials / social proof grid
- No pricing
- No footer nav (just copyright line at very bottom if needed)

---

## Files to touch

| File | Change |
|---|---|
| `frontend/app/page.tsx` | Full rewrite — new section structure |
| `frontend/app/globals.css` | Add `.landing-scroll` utility class |
| `frontend/app/layout.tsx` | Add OG + JSON-LD meta to `<head>` (or keep in page.tsx metadata export) |

---

## Success criteria

- Unauthenticated visitor lands on `/`, sees editorial hero immediately, can scroll through 3 feature moments, hits "Get started" → `/signup`
- Authenticated user still redirects to `/dashboard` (middleware unchanged)
- Lighthouse SEO score ≥ 90
- Page renders without hydration errors
- No layout shift from font loading (fonts already in globals.css import)
