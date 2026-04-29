---
phase: 5
plan: 5-1
subsystem: branding
tags: [i18n, metadata, header]
key-files:
  created: []
  modified:
    - packages/web/src/messages/en.json
    - packages/web/src/messages/lt.json
    - packages/web/src/app/layout.tsx
    - packages/web/src/components/client-providers.tsx
metrics:
  tasks_completed: 3
  commits: 1
---

# Plan 5-1 Summary: i18n + Metadata Rebrand

**Completed:** 2026-04-29

## What Was Built

Replaced all "LT Grocery" strings in i18n and layout metadata with "Krepza". Converted the hardcoded mobile header text to use the `useI18n()` hook so it reads from `common.appName` dynamically.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Update i18n JSON strings (en.json, lt.json) | ✓ |
| 2 | Update layout metadata (title, description) | ✓ |
| 3 | Fix mobile header to use i18n (useI18n hook) | ✓ |

## Commits

| Commit | Description |
|--------|-------------|
| 17c6535 | feat(5-1): rebrand i18n + metadata + mobile header to Krepza |

## Deviations

None — plan executed exactly as specified.

## Self-Check

PASSED — All acceptance criteria verified:
- No "LT Grocery" in en.json or lt.json
- No "LT Grocery" in layout.tsx
- No hardcoded "LT Grocery" in client-providers.tsx
- Mobile header uses `t("common.appName")` via useI18n hook
- Build passes
