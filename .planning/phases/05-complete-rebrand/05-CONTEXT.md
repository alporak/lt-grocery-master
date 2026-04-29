# Phase 5: Complete Rebrand - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

## Phase Boundary

Replace every "LT Grocery" textual and visual reference with "Krepza" across the web app, scraper User-Agent, favicons, and static pages. This is a text/asset replacement phase — no behavior changes, no new features.

## Implementation Decisions

### Logo Display
- **D-01:** Render Krepza logo as an inline SVG React component (consistent with existing lucide-react icon pattern, customizable via Tailwind classes). Replace the 🛒 emoji in the desktop sidebar with the Krepza-Logo.svg, keeping the app name text beside it.

### Legal Page Text
- **D-02:** Full rewrite of privacy policy (privacy/page.tsx) and data deletion (data-deletion/page.tsx) pages to reflect Krepza context. Not just a find-replace of "LT Grocery" → "Krepza" — review and update all legal copy to be accurate for the Krepza-branded application.

### Scraper Git Identity
- **D-03:** Leave scraper git identity as-is (`lt-grocery-bot` bot name/email, `lt-grocery-master-db` default repo URL in scrape-job.ts). Treat as infrastructure identity separate from user-facing app branding.

### the agent's Discretion
None — all gray areas were explicitly decided by user.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/ROADMAP.md` — Phase 5 goal, requirements BRAND-01 through BRAND-07, 5 success criteria
- `.planning/REQUIREMENTS.md` — Full requirements list with checkboxes, traceability table

### Project Context
- `.planning/PROJECT.md` — Tech stack (Next.js 14 App Router, Prisma + SQLite, Docker Compose), constraints (self-hosted, SQLite WAL mode), OAuth-only auth

## Existing Code Insights

### Reusable Assets
- `useI18n()` hook from `packages/web/src/components/i18n-provider.tsx` — provides `t()` for i18n key lookups, app name flows through `common.appName` and `auth.loginTitle`
- `safeT()` helper in `packages/web/src/components/navigation.tsx:48-56` — i18n key → display text with fallback
- Existing `AdSlot.tsx` pattern — reusable React component structure for display elements

### Established Patterns
- i18n via JSON files (`en.json`, `lt.json`) keyed by section
- Next.js Metadata API (export `metadata` from `layout.tsx`) for `<title>` and `<meta>` tags
- "use client" directive for interactive components (header, sidebar)
- Tailwind CSS classes for all styling (no separate CSS files except globals.css)

### Integration Points
- `packages/web/src/app/layout.tsx:9` — metadata title: `"LT Grocery - Price Checker"`
- `packages/web/src/components/client-providers.tsx:22` — mobile header: `🛒 LT Grocery` (hardcoded, NOT using i18n)
- `packages/web/src/components/navigation.tsx:66` — sidebar branding: `🛒 {t("common.appName")}`
- `packages/web/src/app/privacy/page.tsx:32,41,60` — 3 references to "LT Grocery"
- `packages/web/src/app/data-deletion/page.tsx:19,30` — 2 references to "LT Grocery"
- `packages/web/src/messages/en.json:3,224` — `common.appName` and `auth.loginTitle`
- `packages/web/src/messages/lt.json:3,224` — Lithuanian equivalents
- `packages/web/src/app/api/stores/fetch-locations/route.ts:34` — User-Agent: `lt-grocery-master/1.0`
- `packages/scraper/src/scrape-job.ts:243,256,275-276` — git bot identity (leave as-is per D-03)
- `assets/logo/` — Krepza-Logo.svg, favicon.ico, icon.svg, icon.png, icon.ico, icon.icns

## Specific Ideas

- Logo should replace 🛒 emoji in sidebar but keep the app name text beside it
- Full legal page rewrite should maintain the same structure (sections on data collection, usage, storage, rights, contact/deletion) but in Krepza voice
- All i18n strings referencing "LT Grocery" must become "Krepza" — Lithuanian translations should match ("Sveiki atvykę į Krepza")
- Favicon files from assets/logo/ need to be served from the web app's public directory (Next.js serves from `public/` or `app/favicon.ico` convention)

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 5-Complete Rebrand*
*Context gathered: 2026-04-29*
