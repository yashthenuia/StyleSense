Let me give you a clear mental model for each of these — this is a workflow/process question, not a code task, so I'll answer directly.

1. Scoping frontend-only changes
The rule: If it lives in frontend/, it's frontend work. Backend is untouched.

When a frontend page calls an API that isn't ready, add a mock flag at the top of the component:


const MOCK = true; // flip to false when backend is ready
const data = MOCK ? mockWardrobeItems : await api.get('/wardrobe');
This lets you build/style/test UI completely independently. The mock lives in the same file — no separate mock infrastructure needed.

2. How much context per task
One task = one message. Give Claude:

The file path (e.g. frontend/app/studio/page.tsx)
What's wrong or what you want (1-2 sentences)
The specific symptom (screenshot description, error text, or line number)
Bad: "Fix all the issues on the studio page"
Good: "The item grid in studio/page.tsx overflows on mobile — the items stack instead of wrapping"

Batch only tasks that touch the same file or are truly sequential (fix A before B makes sense).

3. Model selection
Task type	Model	Why
Styling tweaks, small fixes	Haiku (fastest/cheapest)	Doesn't need reasoning
Feature additions, bug fixes	Sonnet (default)	Good balance
Architecture decisions, planning	Opus	Best reasoning
/braindump, /graphify	Sonnet	Structured output
In practice: Sonnet handles 90% of coding tasks. Only reach for Opus when you're stuck or planning something complex. Haiku is underused — good for "change this color" or "rename this label."

4. Braindump → tasks flow that actually works
/braindump your raw thoughts → it categorizes into task-tracker rows
After vault write, pick 1–3 tasks max for the session
Start a fresh message: "Work on [specific task] in [file]"
Don't carry the braindump context into code sessions — that wastes tokens
New braindumps mid-session are fine: just /braindump again, write to vault, then continue with the coding task.

5. Bug vs Feature vs Tweak vs Manual
Type	Definition	Do it...
Bug	Broken existing behavior	With Claude
Feature	New capability that doesn't exist	With Claude + /brainstorming first
Tweak	Visual change: spacing, color, font size	Devtools OR Claude (either works)
Copy change	Text labels, headings	Edit the file directly — no Claude needed
Manual/Devtools	One-off: check layout, test hover states	Browser — commit nothing
Devtools is your sandbox. Use it to experiment with CSS, find the right value, then tell Claude the exact change. That's faster than asking Claude to guess.

6. Skills that save tokens (use these constantly)
Skill	When	Why it saves tokens
/commit	After any working change	Snapshots progress before the session dies
/code-review low	After a big change	Catches issues before they compound
/verify	After a UI change	Browser check instead of back-and-forth
/brainstorming	Before building anything new	Prevents wrong-direction implementation
/compact	When context is getting long	Summarizes without losing state
Most token waste comes from: describing problems vaguely (Claude reads more files to figure it out), asking for big sweeping changes (Claude touches many files), and not committing (losing progress means redoing work).

7. When tokens run out mid-task
Before you run out:

/commit whenever something works — even partially
Ask Claude "summarize what's left to do" → copy that text
Start next session: paste the summary + "continue from here"
The handoff note in .remember/remember.md is already being written automatically at session end — check it at the start of the next session to pick up where you left off.

8. The practical session template

Session start:
1. Check .remember/remember.md for last state
2. Pick 1-3 tasks from task-tracker
3. For each: give Claude file + specific problem
4. /commit after each working change
5. /braindump at end if new ideas surfaced
This keeps sessions focused, recoverable, and cheap.



---- 
This is actually a good working style — user flow descriptions are often better than technical descriptions because they capture intent. The issue is just adding the "what's wrong" layer on top.

The prompt template that works for your situation

[What I'm trying to do]:  I want to add a top to my wardrobe
[What happens]:           I click Add Item, the modal opens, I upload a photo
[What feels wrong]:       The modal is too big and the button to confirm is hidden below the fold
[What I want instead]:    Everything fits without scrolling, or the button is always visible
That's it. You don't need design vocabulary. "Hidden below the fold," "too cramped," "it jumps around," "doesn't feel connected" — these are all valid descriptions I can act on.

DevTools: what else you can do beyond padding/margins
In the Styles panel (right side when you inspect an element):

Property	What it does	Example
color	Text color	Click the color swatch → color picker appears
background-color	Background	Same — color picker
font-size	Text size	Change 16px to 14px
border-radius	Rounded corners	0 = sharp, 8px = soft, 50% = circle
opacity	Transparency	0.5 = half transparent
gap	Space between flex/grid items	More useful than margin usually
display: none	Hide element	Toggle to see what page looks like without it
z-index	Which element is on top	Higher = on top
The color picker trick: Click any colored square in the Styles panel → an eyedropper appears → you can sample any color on the page. This is how you match colors exactly.

How to give me a screenshot
The fastest prompt is:

Take a screenshot of what looks wrong (Windows: Win + Shift + S)
Paste it into the chat
Say "this feels [cramped / off / wrong] — I want it to [feel lighter / be easier to reach / look like one thing instead of two]"
I can read screenshots and identify exactly which element to change.

Reference sites are valid design vocabulary
Instead of knowing terms like "visual hierarchy" or "whitespace," just say:

"I want the cards to feel like Notion's"
"The nav should feel minimal like Linear"
"The buttons look cheap — something more like Apple's style"
These are real design references I can translate into CSS changes.

What you can actually fix yourself in DevTools (no Claude needed)
Once you find the right value in DevTools, you can make the permanent change in the file yourself:

Find the value in DevTools (e.g. padding: 8px)
Change it to what looks right (e.g. 24px)
Find that class name in the file (Grep or Ctrl+F in VS Code)
Change the number
For Tailwind (which this project uses), the class names like p-2 or px-6 map to padding. p-2 = 8px, p-6 = 24px. So if something looks cramped: find the p- class on that element in DevTools, try increasing the number, then update the file.

Bottom line: Your instinct for what looks wrong is the skill. You just need a way to hand that instinct to me. Screenshot + "this feels X, I want it to feel Y" is enough. I'll handle the translation to code.

i wanted to learn design vocabulary then what
Good — this is worth learning properly. Here's the vocabulary that actually matters for web UI, organized by what you'll use most.

Layout & Space
Hierarchy — the visual order of importance. Big headline = high hierarchy. Tiny gray text = low. When something "doesn't stand out enough," hierarchy is the problem.

Whitespace — empty space used intentionally. Not wasted space — it's what makes things feel premium vs cluttered. "This feels cramped" = needs more whitespace.

Alignment — elements lining up on an invisible grid. Misalignment is why things feel "off" even when you can't name why.

Density — how much information per screen. Dense = lots of small items (data tables). Airy = few large items (landing pages). Most apps live in between.

Container — a box that groups related content. "Put this in a card" = wrap it in a container with a background and padding.

Grid — invisible columns everything snaps to. "The items aren't lining up" usually means broken grid.

Typography
Weight — thickness of text. font-weight: 400 = regular. 700 = bold. "Make this more prominent" = increase weight.

Scale — the size relationship between headings and body text. Good scale = clear difference. Bad scale = everything looks the same size.

Leading (line height) — vertical space between lines. Tight leading = cramped. Loose = airy and readable.

Tracking (letter spacing) — horizontal space between letters. Small caps + wide tracking = sophisticated. Normal text + wide tracking = weird.

Contrast — how different the text color is from the background. Low contrast = hard to read. WCAG accessibility rule: body text needs at least 4.5:1 ratio.

Color
Value — lightness/darkness of a color. Light blue vs dark blue = different values of the same hue.

Saturation — how vivid a color is. Muted/desaturated = sophisticated, calm. Vivid/saturated = loud, energetic.

Tint — a color mixed with white (lighter). Shade — mixed with black (darker).

Accent color — the one color that's different from everything else. Draws the eye. Use sparingly (buttons, key actions).

Neutral — grays, off-whites, beiges. Most of your UI should be neutrals with one accent.

Components & Patterns
Card — a contained block with background, padding, sometimes a border or shadow. Groups related content.

Modal — overlay dialog that blocks the rest of the page. Requires a close action.

Toast / Snackbar — temporary notification that appears and disappears (bottom corner usually).

Skeleton — loading placeholder shaped like the content it's replacing (gray animated bars).

CTA (Call to Action) — the primary button you want people to click. Should be visually dominant.

Empty state — what a page shows when there's no data yet. Often missed, always needed.

Interaction & Motion
Hover state — what an element looks like when your mouse is over it. Signals "this is clickable."

Focus state — the highlight around an element when keyboard-navigating. Accessibility requirement.

Affordance — visual cues that signal how something works. A button that looks pressable has good affordance.

Feedback — the UI's response to an action. Click a button → spinner appears → success toast. No feedback = feels broken.

Transition — animation between states. Short (150–200ms) = snappy. Long (500ms+) = sluggish.

"Feel" Words (Design Direction)
These are actually the most useful for prompting me:

You want it to feel...	Design direction
Expensive / premium	More whitespace, less color, serif fonts, subtle
Clean / modern	High contrast, geometric sans-serif, minimal decoration
Warm / approachable	Rounded corners, warm neutrals, slightly loose spacing
Bold / confident	Large type, strong color, tight layout
Editorial / magazine	Mixed type sizes, asymmetry, grid-breaking elements
Calm / focused	Muted colors, generous whitespace, low density
StyleSense currently aims for editorial + warm (EB Garamond, earth tones) — so when something feels off, you can ask "does this match the editorial warmth we're going for?"

The shortest path to using this
When you open DevTools and see something that bothers you, ask:

Is it a space problem? (whitespace, padding, gap)
Is it a size problem? (font-size, element dimensions)
Is it a color problem? (contrast, saturation, value)
Is it a hierarchy problem? (something important doesn't look important)
Is it a feel problem? (right elements, wrong mood)
Name which of these 5 it is, describe what's wrong, and that's a complete design brief — no further vocabulary needed.