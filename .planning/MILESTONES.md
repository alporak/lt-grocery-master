# Milestones

## v2.0 Krepza Rebrand + Ad Monetization — SHIPPED 2026-04-29

**Phases:** 3 | **Plans:** 6 | **Requirements:** 18/18 complete

### Accomplishments

1. Full rebrand from "LT Grocery" to "Krepza" across all i18n, metadata, layout, and static pages
2. Google AdSense wired into all 5 ad component types (AdBanner, AdLeaderboard, AdNativeCard, AdSideRail, AdSponsoredRow)
3. GDPR-compliant consent banner with localStorage persistence
4. Krepza logo as inline SVG component replacing emoji in desktop sidebar
5. Domain-agnostic deployment — `NEXTAUTH_URL` as single env var, no hardcoded URLs
6. Scraper User-Agent updated to "krepza/2.0", neutral adblock copy replacing desperate begging

### Key Decisions

- Inline SVG logo component (consistent with lucide-react pattern)
- Full legal page rewrite (not just text replacement)
- Custom GDPR consent banner (no external library)
- AdSense via `next/script` with `afterInteractive` strategy
- Conditional ad rendering when `NEXT_PUBLIC_ADSENSE_ID` is set (null when missing)
- Scraper git bot identity left as-is (infrastructure, not branding)

### Files

- 2 new components (logo.tsx, consent-banner.tsx)
- 4 icon files added to public/ (favicon.ico, icon.svg, icon.png, icon.ico)
- ~10 files modified (i18n JSON, layout.tsx, client-providers.tsx, navigation.tsx, AdSlot.tsx, privacy+data-deletion pages, .env.example, docker-compose.yml)

### Archive

- `.planning/milestones/v2.0-ROADMAP.md`
- `.planning/milestones/v2.0-REQUIREMENTS.md`

---

## v1.0 Multi-Device Auth — SHIPPED 2026-04-29

**Phases:** 4 | **Plans:** 11 | **Requirements:** 20/20 complete

### Accomplishments

1. Social login with Google and Facebook via next-auth@4 with JWT strategy
2. Per-user data isolation (grocery lists, settings, preferences) via userId scoping
3. Cross-device grocery list sync via SSE (same-device tabs) + polling (cross-device, 5s)
4. Device session tracking and management with User-Agent parsing
5. Ghost migration for existing grocery lists — claimable on first login
6. Privacy policy and data deletion pages with self-service account deletion

### Key Decisions

- next-auth@4 with JWT strategy (no DB session writes, avoids SQLite contention)
- OAuth-only (Google + Facebook), no password management
- Settings split: UserSetting (per-user) vs AppSetting (global/scraper config)
- Single `NEXTAUTH_URL` env var for all OAuth redirects — deployment-agnostic
- Polling + SSE hybrid for sync (no WebSocket overhead)
- Last-Write-Wins conflict resolution with optimistic concurrency

### Files

- 17 new files (auth layer, sync hooks, session management, privacy/data-deletion pages)
- ~5 files modified (Prisma schema, docker-compose, env config, grocery list APIs)

### Archive

- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

---

*For current project status, see .planning/ROADMAP.md*
