---
phase: 5
plan: 5-2
subsystem: branding
tags: [privacy, tos, data-deletion, user-agent]
key-files:
  created: []
  modified:
    - packages/web/src/app/privacy/page.tsx
    - packages/web/src/app/data-deletion/page.tsx
    - packages/web/src/app/api/stores/fetch-locations/route.ts
metrics:
  tasks_completed: 3
  commits: 1
---

# Plan 5-2 Summary: Static Pages + Scraper User-Agent

**Completed:** 2026-04-29

## What Was Built

Updated all static legal pages (privacy policy, data deletion) to reference "Krepza" instead of "LT Grocery". Updated the scraper HTTP User-Agent header from "lt-grocery-master/1.0" to "krepza/2.0". Scraper git bot identity in scrape-job.ts was intentionally left unchanged per D-03.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Rewrite privacy policy page | ✓ |
| 2 | Rewrite data deletion page | ✓ |
| 3 | Update scraper User-Agent header | ✓ |

## Commits

| Commit | Description |
|--------|-------------|
| aedf27a | feat(5-2): update privacy/TOS pages and scraper User-Agent for Krepza |

## Deviations

None — plan executed exactly as specified.

## Self-Check

PASSED — All acceptance criteria verified:
- No "LT Grocery" in privacy/page.tsx
- No "LT Grocery" in data-deletion/page.tsx
- User-Agent header reads "krepza/2.0"
- Scraper git bot identity in scrape-job.ts untouched (D-03)
