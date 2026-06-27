# Claude Usage — Efficiency Plan

> Written from usage stats: 97% subagent-heavy · 74% sessions 8h+ · 32% >150k context

---

## The Three Leaks

### 1. Subagents (97% of usage)

Subagents are expensive — each one starts a fresh request, often at full context cost.

**When a subagent is worth it:**
- Genuinely parallel tasks with no shared state (e.g. two independent bug fixes in different files)
- Tasks the main context shouldn't see (large file dumps, search results)
- Specialized agents: `code-reviewer`, `Explore` for codebase search

**When you're wasting credits:**
- Asking Claude to "explore the codebase" → just use Grep/Glob directly
- Any task that touches 1–3 known files → inline, not subagent
- Clarifying questions → never needs a subagent

**Rule of thumb:** If you can point to the file, don't spawn. Subagents are for "I don't know where this lives."

**Cheaper model for subagents:** In settings, set subagent model to Haiku for read-only tasks (Explore, search, summarize). Only use Sonnet/Opus for tasks that write code.

---

### 2. Long sessions (74% sessions 8h+)

An 8-hour session accumulates context even when idle. Each new message re-sends the full history.

**Session hygiene rules:**

| Trigger | Action |
|---|---|
| Switching to a different page/feature | `/clear` — fresh context is cheaper than stale context |
| Mid-task, context feels bloated | `/compact` — summarizes history, keeps working |
| Task is done, committing | `/clear` after commit |
| Background loop running | Kill it when you leave — loops charge per wakeup |

**Target:** No session longer than 2–3 focused tasks. After that, `/clear` and start fresh with a one-line summary of where you left off.

---

### 3. High context (32% >150k tokens)

Context grows from: reading large files, tool output, failed attempts, long back-and-forth.

**What inflates context fast:**
- Asking vague questions (Claude reads more files to compensate)
- Multiple failed fix attempts without `/compact`
- Pasting full file contents when you only needed a section
- Not using line numbers (Claude reads the whole file)

**What keeps context lean:**
- Give file + line number when you know it: `studio/page.tsx:266`
- Use Grep instead of asking Claude to find things
- `/compact` after every 3–4 tool calls in a long session
- One task per session for complex work

---

## Per-Task Playbook

### Starting a session
```
1. State the single task: "[file]:[line] — [what's wrong] → [what I want]"
2. No preamble, no context-setting unless essential
3. If you need background: paste .remember/remember.md, not the full issues list
```

### During a session
```
- After Claude reads 3+ files → /compact if no fix yet
- After a fix is applied → commit immediately, then /clear if switching tasks
- If Claude is going in circles (2+ attempts, same result) → /compact and restate
```

### Ending a session
```
1. Commit what works (even partial)
2. Write 1-line handoff: "Fixed X in [file]. Next: Y"
3. /clear
```

---

## Skills Worth Using (Token ROI)

| Skill | When | Saves |
|---|---|---|
| `/code-review low` | After a non-trivial change | Catches bugs before they become long debug sessions |
| `/commit` | After every working state | Snapshot prevents rework |
| `/compact` | Mid-session when context is long | 40–60% context reduction |
| `/verify` | After UI change | One browser check vs back-and-forth |
| `design-taste-frontend` | Before building any new UI | Prevents wrong-direction rework |
| `impeccable` (once installed) | Design audit | Targeted feedback vs vague iteration |

**Skills you're underusing:** `/verify` and `/compact` have near-zero cost and prevent expensive sessions.

---

## StyleSense-Specific Rules

**Frontend tasks (most of your work):**
- Know the file → inline edit, no subagent
- Don't know which file → `Explore` subagent (cheap, read-only)
- Visual issue → screenshot + 1 sentence, not a paragraph

**Backend tasks:**
- Backend is stable — don't touch unless B-prefixed bug
- SQL migrations go to Supabase dashboard manually, not via Claude

**Design tasks:**
- Use `design-taste-frontend` or `impeccable` skill before implementing
- Reference a site/app you like instead of describing design vocabulary

---

## Quick Reference — Decision Tree

```
Got a task?
│
├─ Do I know the exact file + rough line?
│   YES → Give Claude the path + problem. No subagent.
│   NO  → Spawn Explore agent (cheap) to find it, then work inline.
│
├─ Is context getting long (3+ files read, 2+ attempts)?
│   YES → /compact before continuing
│
├─ Is this a new task after finishing the last one?
│   YES → /clear first
│
└─ Has this session been running 2h+?
    YES → Commit, /clear, restart fresh
```

---

## One-Month Target

| Metric | Now | Target |
|---|---|---|
| Subagent % | 97% | <40% |
| 8h+ sessions | 74% | <20% |
| >150k context | 32% | <10% |
| Skills used | /code-review only | + /compact /verify /commit regularly |
