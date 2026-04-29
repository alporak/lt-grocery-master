# Krepza — Lithuanian Grocery Price Tracker

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

### Active

- [ ] Full rebrand from "LT Grocery" to "Krepza" (i18n, metadata, layout, favicons, static pages)
- [ ] Google AdSense integration across all existing ad slots (5 types, 9 pages)
- [ ] Domain-agnostic deployment (env-var-driven, no hardcoded URLs)
- [ ] Updated privacy and data deletion pages with Krepza branding

### Out of Scope

- Email/password login — OAuth-only for seamlessness
- Real-time WebSocket sync — polling/SSE sufficient
- Offline write capability — read-only cache offline
- Dietary preferences per user — already per-list
- Mobile app — web-first

## Context

- Next.js 14 App Router, Prisma + SQLite, Docker multi-service (web/scraper/embedder)
- next-auth@4 with JWT strategy, Prisma adapter for user/account persistence
- 17 new files created across auth, data isolation, sync, and session management layers
- Single `NEXTAUTH_URL` env var controls all OAuth redirects — works on any domain
- Device session tracking via User-Agent parsing + DeviceSession model
- SSE + polling for cross-device list sync with optimistic concurrency
- Placeholder ad components exist (5 types across 9 pages) — need real AdSense wiring
- Brand logos in assets/logo/ (icon.svg, icon.png, icon.ico, icon.icns, favicon.ico, Krepza-Logo.svg)
- App name referenced in 10+ locations: i18n JSON (en.json, lt.json), layout metadata, client-providers header, privacy/TOS pages

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

## Current Milestone: v2.0 Krepza Rebrand + Ad Monetization

**Goal:** Rebrand from "LT Grocery" to "Krepza" with Google AdSense monetization and domain-agnostic deployment.

**Target features:**
- Full rebrand (i18n, metadata, layout, favicons, static pages)
- Google AdSense in all 5 existing ad slot types across 9 pages
- Domain-agnostic deployment (env-var-driven, no hardcoded URLs)
- Updated privacy/data-deletion pages with Krepza branding

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

---
*Last updated: 2026-04-29 — milestone v2.0 started*
