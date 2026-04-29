# Phase 5: Complete Rebrand - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 05-complete-rebrand
**Areas discussed:** Logo display, Legal page text, Scraper git identity, Data-deletion page

---

## Logo Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline SVG component | Create React component rendering logo as inline SVG — consistent with lucide-react icon pattern, customizable via Tailwind | ✓ |
| `<img>` tag from /public/ | Place SVG in /public/ and use HTML img tag — simplest | |
| Next.js `<Image>` | Use next/image for optimization — responsive sizing, lazy loading | |

**User's choice:** Inline SVG component (Recommended)
**Notes:** Replace 🛒 emoji in desktop sidebar with the SVG component, keep app name text beside it.

---

## Legal Page Text

| Option | Description | Selected |
|--------|-------------|----------|
| Text replace only | Replace "LT Grocery" with "Krepza", keep all other content | |
| Full rewrite | Full review and rewrite of privacy/data-deletion page copy in Krepza voice | ✓ |

**User's choice:** Full rewrite
**Notes:** Both privacy/page.tsx and data-deletion/page.tsx need complete review — not just find-replace.

---

## Scraper Git Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Rebrand scraper git | Update bot name to "krepza-bot", email, and recommend new repo URL | |
| Leave as-is | Keep lt-grocery-bot identity as infrastructure detail | ✓ |

**User's choice:** Leave scraper git as-is
**Notes:** Treat git backup bot identity as infrastructure separate from user-facing branding.

---

## Data-Deletion Page

| Option | Description | Selected |
|--------|-------------|----------|
| Covered by legal rewrite | Full rewrite of legal pages includes data-deletion page | ✓ |

**User's choice:** Covered by earlier "full rewrite" decision for legal text
**Notes:** data-deletion/page.tsx has 2 references to "LT Grocery" — included in the full rewrite scope.

---

## the agent's Discretion

None — all gray areas were explicitly decided by the user.

## Deferred Ideas

None.
