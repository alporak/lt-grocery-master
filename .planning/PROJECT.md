# Krepza — Lithuanian Grocery Price Tracker

## Current Milestone: v3.0 Production Deployment

**Goal:** Deploy Krepza to krepza.lt via Cloudflare Tunnel with production hardening, AdSense registration, and best-practice security.

**Target features:**
- Cloudflare account + domain setup (krepza.lt, DNS)
- Cloudflare Tunnel as Docker container (cloudflared) in docker-compose
- Web container served publicly via tunnel on krepza.lt
- Scraper/embedder stay internal (health endpoints only exposed)
- AdSense site verification + ads.txt + approval submission
- Production hardening (security headers, health checks, monitoring, backups, logging)

## What This Is

Krepza is a self-hosted Lithuanian grocery price tracker with seamless social login (Google/Facebook), per-user grocery lists, cross-device sync, session management, and Google AdSense monetization.

## Core Value

User logs in with one click (Google/Facebook) and their grocery lists follow them to any device.

## Requirements

### Validated

- ✓ Sign in with Google — v1.0
- ✓ Sign in with Facebook — v1.0
- ✓ Session persistence across browser refresh — v1.0
- ✓ Sign out — v1.0
- ✓ Route protection for grocery lists — v1.0
- ✓ Per-user grocery list isolation — v1.0
- ✓ Per-user settings (language, theme, address) — v1.0
- ✓ Existing data migration (ghost user) — v1.0
- ✓ Cross-device list sync (polling + SSE) — v1.0
- ✓ Conflict handling on simultaneous edits — v1.0
- ✓ Session management page — v1.0
- ✓ Account linking (same email via multiple providers) — v1.0
- ✓ Full rebrand to "Krepza" (i18n, metadata, logos, static pages) — v2.0
- ✓ Google AdSense across 5 ad component types — v2.0
- ✓ GDPRed consent banner before ads — v2.0
- ✓ Domain-agnostic deployment via env vars — v2.0

### Active

- [ ] Cloudflare account and domain setup (krepza.lt)
- [ ] Cloudflare Tunnel via Docker container (cloudflared)
- [ ] Web container served publicly on krepza.lt
- [ ] Scraper/embedder health endpoints
- [ ] AdSense site verification, ads.txt, and approval
- [ ] Production hardening (security headers, health checks, monitoring, backups, logging)

### Out of Scope

- Email/password login — OAuth-only for seamlessness
- Real-time WebSocket sync — polling/SSE sufficient
- Offline write capability — read-only cache offline
- Dietary preferences per user — already per-list
- Mobile app — web-first

## Context

- Next.js 14 App Router, Prisma + SQLite, Docker multi-service (web/scraper/embedder)
- next-auth@4 with JWT strategy, Prisma adapter for user/account persistence
- Single `NEXTAUTH_URL` env var controls all OAuth redirects — works on any domain
- Device session tracking via User-Agent parsing + DeviceSession model
- SSE + polling for cross-device list sync with optimistic concurrency
- Google AdSense integrated via next/script with GDPR consent banner
- Krepza logo as inline SVG component (matching lucide-react pattern)
- Ad components conditionally rendered via NEXT_PUBLIC_ADSENSE_ID env var
- ~6 new files created: logo.tsx, consent-banner.tsx, plus asset files in public/
- Domain purchased (krepza.lt), deploying via Cloudflare Tunnel with cloudflared Docker container

## Constraints

- **Database**: SQLite — single writer, WAL mode. JWT sessions (not DB) to avoid write contention
- **Self-hosted**: No SaaS auth (no Clerk, no Auth0). next-auth@4 self-hosted.
- **Seamless**: OAuth-only, no passwords. One-click login.
- **Existing data**: Ghost user migration preserves pre-auth grocery lists

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| next-auth@4 (not v5) | Stable, mature. v5 beta has SQLite edge cases | ✓ Good |
| JWT strategy only | Avoids SQLite write contention on session table | ✓ Good |
| Google + Facebook only | Covers 95% of users. No password management | ✓ Good |
| Split Settings table | UserSetting (per-user) + AppSetting (global). Clean separation | ✓ Good |
| Ghost user migration | Existing lists assigned to placeholder, claimable on first login | ✓ Good |
| Polling + SSE hybrid | SSE for tab sync, 5s polling for cross-device. No WebSocket | ✓ Good |
| Last-Write-Wins conflicts | Optimistic concurrency with version bump. CRDTs overkill | ✓ Good |
| Single NEXTAUTH_URL env var | One variable to change per deployment. No hardcoded URLs | ✓ Good |
| Inline SVG logo component | Consistent with lucide-react icon pattern, Tailwind-customizable | ✓ Good |
| Custom GDPR consent banner | No external dependency, fixed bottom bar, localStorage persistence | ✓ Good |
| AdSense via next/script | afterInteractive strategy, conditional on NEXT_PUBLIC_ADSENSE_ID | ✓ Good |
| Scraper git identity unchanged | Infrastructure identity separate from user-facing branding | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---\n*Last updated: 2026-04-29 after v3.0 milestone start*
