---
phase: 6
plan: 6-2
subsystem: ads
tags: [adsense, ad-component, adblock]
key-files:
  created: []
  modified:
    - packages/web/src/components/ads/AdSlot.tsx
    - packages/web/src/messages/en.json
    - packages/web/src/messages/lt.json
metrics:
  tasks_completed: 3
  commits: 1
---

# Plan 6-2 Summary: Wire All 5 Ad Components to AdSense

**Completed:** 2026-04-29

## What Was Built

Refactored `AdSlot.tsx` to replace placeholder begging content with real Google AdSense `<ins>` elements. All 5 components (AdBanner, AdLeaderboard, AdNativeCard, AdSideRail, AdSponsoredRow) now render AdSense slots when `NEXT_PUBLIC_ADSENSE_ID` is set. Components return null when publisher ID is missing (no fallback rendering). Adblock detection preserved — shows neutral "Ads help keep Krepza free" notice instead of desperate begging. Dismiss behavior (sessionStorage) and AdLabel preserved. Removed HatchImg (hatch pattern placeholder) — no longer needed. Updated i18n with neutral adblock notice strings.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Refactor AdSlot.tsx — add AdUnit component with AdSense `<ins>` | ✓ |
| 2 | Update all 5 exported ad components to use AdUnit | ✓ |
| 3 | Update i18n ad strings (neutral tone) | ✓ |

## Commits

| Commit | Description |
|--------|-------------|
| 0e36501 | feat(6-2): wire all 5 ad components to Google AdSense |

## Deviations

None.

## Self-Check

PASSED — All acceptance criteria verified:
- All 5 components render AdSense `<ins>` elements with data-ad-client + data-ad-slot
- Components return null when NEXT_PUBLIC_ADSENSE_ID is not set
- Adblock detection shows neutral notice (t("ads.adblockNotice"))
- Dismiss behavior preserved via sessionStorage
- AdLabel and DismissBtn remain functional
- Build passes
