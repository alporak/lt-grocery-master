# Phase 6: AdSense Integration - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

## Phase Boundary

Wire Google AdSense into the 5 existing ad component types (AdBanner, AdLeaderboard, AdNativeCard, AdSideRail, AdSponsoredRow) across 9 pages. Add GDPR-compliant consent banner, conditional loading via `NEXT_PUBLIC_ADSENSE_ID` env var, and preserve existing adblock detection + dismiss behavior.

## Implementation Decisions

### AdScript loading
- **D-01:** Inject Google AdSense script via `next/script` with `strategy="afterInteractive"`. Load only when `NEXT_PUBLIC_ADSENSE_ID` is set.

### GDPR consent
- **D-02:** Implement a lightweight custom consent banner (no external library). Store consent in localStorage. Only load AdSense script after user accepts. Banner shows: "This site uses ads to stay free. Accept or dismiss."

### Conditional rendering
- **D-03:** When `NEXT_PUBLIC_ADSENSE_ID` is missing, all ad slots render nothing (return null). No fallback placeholder, no begging copy. This replaces the current fallback behavior.

### Adblock handling
- **D-04:** Preserve existing `useAdblockDetect()` hook and `useDismiss()` hook in AdSlot.tsx. When adblock is detected AND publisher ID is set, show a minimal "ads help keep this site free" message. The current desperate begging copy is removed in favor of a neutral tone.

### the agent's Discretion
- Exact consent banner UI design (placement, styling — use Tailwind, match existing design system)
- Whether to wrap the consent banner in a provider/context for app-wide access

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/ROADMAP.md` — Phase 6 goal, requirements ADS-01 through ADS-08, 5 success criteria
- `.planning/REQUIREMENTS.md` — Full requirements list with checkboxes

### Project Context
- `.planning/PROJECT.md` — Tech stack (Next.js 14 App Router), constraints

## Existing Code Insights

### Reusable Assets
- `AdSlot.tsx` — 5 components already defined with adblock detection, dismiss, HatchImg placeholder, BegCopy
- `useAdblockDetect()` hook — existing DOM-based adblock detection
- `useDismiss()` hook — sessionStorage-based dismiss persistence
- `useI18n()` — existing i18n with `ads.*` keys
- `cn()` from `@/lib/utils` — existing className merging utility

### Established Patterns
- `next/script` for external script injection (if used elsewhere)
- "use client" components with hooks pattern
- i18n keys for all user-facing text
- Tailwind CSS for all styling

### Integration Points
- `packages/web/src/components/ads/AdSlot.tsx` — All 5 ad components (AdBanner, AdLeaderboard, AdNativeCard, AdSideRail, AdSponsoredRow) — primary file to modify
- `packages/web/src/messages/en.json` lines 71-75 — `ads.*` i18n keys (label, pleaseWhitelist, pleaseWhitelistDesperate)
- `packages/web/src/messages/lt.json` — Lithuanian ad copy
- 9 pages using ad components: Dashboard, Search, Search/Compare, Grocery Lists, Stores, Products, Categories, Categories/[category], Watch/Trends
- `packages/web/src/app/layout.tsx` — Root layout for inserting consent provider/script
- `packages/web/src/components/client-providers.tsx` — Client-side provider wrapper

## Specific Ideas

- Consent banner should appear as a fixed bottom bar (mobile-friendly)
- When publisher ID is missing, ad components should render null (not the placeholder hatch images or begging text)
- Adblock detection should still work but show a neutral message instead of desperate begging
- Google AdSense publisher ID format: `pub-XXXXXXXXXXXXXXXX`

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 6-AdSense Integration*
*Context gathered: 2026-04-29*
