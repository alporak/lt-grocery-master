---
phase: 6
plan: 6-1
subsystem: ads
tags: [adsense, consent, gdpr, env-var]
key-files:
  created:
    - packages/web/src/components/consent-banner.tsx
  modified:
    - .env.example
    - packages/web/src/app/layout.tsx
    - packages/web/src/components/client-providers.tsx
    - packages/web/src/messages/en.json
    - packages/web/src/messages/lt.json
metrics:
  tasks_completed: 5
  commits: 1
---

# Plan 6-1 Summary: AdSense Script + GDPR Consent + Env Var

**Completed:** 2026-04-29

## What Was Built

Added `NEXT_PUBLIC_ADSENSE_ID` env var to `.env.example`. Created `ConsentBanner` component with `useConsent()` hook — a lightweight GDPR consent banner (fixed bottom bar, localStorage persistence). Wired consent banner into the app layout via `client-providers.tsx`. Added Google AdSense `<Script>` tag to root layout — only loaded when `NEXT_PUBLIC_ADSENSE_ID` is set, using `next/script` with `afterInteractive` strategy. Updated i18n files with neutral ad copy replacing the desperate begging strings.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Add NEXT_PUBLIC_ADSENSE_ID to .env.example | ✓ |
| 2 | Create ConsentBanner component | ✓ |
| 3 | Add ConsentBanner to client-providers | ✓ |
| 4 | Add AdSense script loading to layout | ✓ |
| 5 | Update i18n with consent + ad strings | ✓ |

## Commits

| Commit | Description |
|--------|-------------|
| 899caae | feat(6-1): add AdSense script loading + GDPR consent banner + env var |

## Deviations

None.

## Self-Check

PASSED — All acceptance criteria verified:
- NEXT_PUBLIC_ADSENSE_ID in .env.example
- ConsentBanner component created with useConsent() hook
- Consent banner rendered in client-providers
- AdSense script conditionally loaded in layout
- i18n strings updated (consentText, consentAccept, adblockNotice) in both languages
- Build passes
