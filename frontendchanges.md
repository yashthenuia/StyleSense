---

## Where to make easy frontend tweaks yourself

| What you want to change | File | What to edit |
|---|---|---|
| Any page's text/labels | `frontend/app/<tab>/page.tsx` | Search the text, change it |
| Button styles | `frontend/app/globals.css` — `.btn-primary`, `.btn-secondary`, `.chip` | CSS vars |
| Colors everywhere | `frontend/app/globals.css` — `:root` block | `--bg`, `--surface`, `--gold`, `--ink`, `--border` etc |
| Sidebar items/order | `frontend/components/layout/Sidebar.tsx` | The `navItems` array |
| Topbar | `frontend/components/layout/Topbar.tsx` | Direct JSX edits |
| Studio settings panel | `frontend/app/studio/page.tsx` lines ~430-488 | The right sidebar panel |
| Dashboard layout | `frontend/app/page.tsx` (note: feature branch uses `app/dashboard/page.tsx`) | Grid/flex classes |
| Toast messages | `frontend/components/ui/Toast.tsx` | Text + duration |

**The pattern:** every tab is `frontend/app/<name>/page.tsx`. Text, layout, button labels → just search the string and edit it. Color changes → almost always `globals.css` CSS vars.

---


Stash only backend tryon.py and garment_cleaner.py changes
IN
cd "c:\Users\samr1\OneDrive\Documents\GitHub\StyleSense" && git stash push -m "rembg-nobg-stashed" -- backend/routers/tryon.py backend/services/garment_cleaner.py

OUT
Saved working directory and index state On feature/ui-refinements: rembg-nobg-stashed

----

jaxisi8415@anawebs.com
sisin49922@ellbit.com
admin23

---- 