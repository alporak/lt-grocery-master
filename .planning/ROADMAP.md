# Roadmap: Krepza

## Overview

Krepza evolves from a working grocery price tracker with OAuth auth and AdSense integration to a production-deployed application at krepza.lt. The v3.0 milestone adds Cloudflare Tunnel infrastructure for zero-open-port deployment, AdSense verification artifacts, production hardening (health checks, backups, security headers), and end-to-end verification for launch readiness.

## Milestones

- ✅ **v2.0 Krepza Rebrand + Ad Monetization** — Phases 5-7 (shipped 2026-04-29)
- 🚧 **v3.0 Production Deployment** — Phases 8-11 (in progress)

## Phases

<details>
<summary>✅ v2.0 Krepza Rebrand + Ad Monetization (Phases 5-7) — SHIPPED 2026-04-29</summary>

- [x] Phase 5: Complete Rebrand (3/3 plans) — completed 2026-04-29
- [x] Phase 6: AdSense Integration (2/2 plans) — completed 2026-04-29
- [x] Phase 7: Domain-Agnostic Deployment (1/1 plan) — completed 2026-04-29

</details>

### 🚧 v3.0 Production Deployment (In Progress)

**Milestone Goal:** Deploy Krepza to krepza.lt via Cloudflare Tunnel with AdSense verification and production hardening.

- [ ] **Phase 8: Tunnel Infrastructure** — Cloudflare Tunnel routes HTTPS traffic to web container, OAuth configured for production
- [ ] **Phase 9: AdSense Readiness** — ads.txt, CSP, and security headers for AdSense verification and approval
- [ ] **Phase 10: Production Hardening** — Health checks, Docker auto-restart, SQLite backups, logging, and security headers
- [ ] **Phase 11: Verification & Launch** — E2E OAuth testing, CSP audits, backup restore tests, and crawl verification

## Phase Details

### Phase 8: Tunnel Infrastructure
**Goal**: Public HTTPS traffic flows from krepza.lt to the web container via Cloudflare Tunnel with OAuth callbacks correctly configured for production
**Depends on**: Nothing (first phase of v3.0 milestone)
**Requirements**: [TUNN-01, TUNN-02, TUNN-03, TUNN-04, TUNN-05, TUNN-06]
**Success Criteria** (what must be TRUE):
  1. Visiting `https://krepza.lt` in a browser serves the Krepza application — no Cloudflare errors or connection failures
  2. HTTPS is enforced end-to-end — any attempt to access `http://krepza.lt` redirects to `https://krepza.lt`
  3. OAuth login flow works with Google and Facebook using the production callback URLs at `https://krepza.lt`
  4. The tunnel operates without exposing any ports on the host machine — `ss -tlnp` shows no public-facing ports
  5. Zero hardcoded domain references remain — all routing uses env vars (`NEXTAUTH_URL`, `TUNNEL_TOKEN`)
**Plans**: 3 plans

Plans:
- [ ] 08-01-PLAN.md — Docker Tunnel Configuration: add cloudflared service to docker-compose.yml, update .env.example with TUNNEL_TOKEN and NEXTAUTH_URL=https://krepza.lt
- [ ] 08-02-PLAN.md — Cloudflare Infrastructure Setup Guide: step-by-step Cloudflare account/domain/tunnel creation, OAuth callback URL configuration in Google Cloud Console and Facebook Developers
- [ ] 08-03-PLAN.md — Tunnel Verification & Port Hardening: deploy cloudflared, verify HTTPS end-to-end, confirm OAuth login, remove web port exposure per D-02

### Phase 9: AdSense Readiness
**Goal**: All AdSense verification artifacts are in place and the site is submitted for review with correct monetization configuration
**Depends on**: Phase 8
**Requirements**: [ADSN-01, ADSN-02, ADSN-03, ADSN-04, ADSN-05]
**Success Criteria** (what must be TRUE):
  1. Visiting `https://krepza.lt/ads.txt` returns the publisher ID in plain text with `Content-Type: text/plain`
  2. No CSP violations appear in browser DevTools Console when loading ad components on any page of the site
  3. AdSense ad units render on the site using the real publisher ID — confirmed via browser Network tab showing ad requests
  4. AdSense site review dashboard shows "In review" status with site ownership verified
**Plans**: 3 plans

Plans:
- [ ] 09-01-PLAN.md — Static AdSense Verification Files: ads.txt, robots.txt, site verification meta tag, and env documentation
- [ ] 09-02-PLAN.md — CSP + Security Headers: Content-Security-Policy with AdSense origins, HSTS, X-Frame-Options (SAMEORIGIN), and all production security headers via next.config.js
- [ ] 09-03-PLAN.md — AdSense Publisher ID + Site Submission: verify all artifacts, guide user through setting publisher ID and submitting site to AdSense for review

### Phase 10: Production Hardening
**Goal**: The deployment is resilient to failures, backed up daily, and follows security best practices for production self-hosting
**Depends on**: Phase 8
**Requirements**: [HRDN-01, HRDN-02, HRDN-03, HRDN-04, HRDN-05, HRDN-06, HRDN-07, HRDN-08, HRDN-09, HRDN-10]
**Success Criteria** (what must be TRUE):
  1. Docker automatically restarts any container that becomes unhealthy, with no manual intervention needed after simulated crashes
  2. A verified, consistent SQLite backup file exists for each of the past 7 days in persistent `/backups` volume storage
  3. All HTTP responses include security headers (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) confirmed by `curl -I https://krepza.lt`
  4. Docker logs are compact and rotated — no single service exceeds the 10 MB / 3 file limit
  5. Search engines can crawl the homepage but are blocked from API routes — verified via `curl https://krepza.lt/robots.txt`
**Plans**: 3 plans

Plans:
- [ ] 10-01-PLAN.md — Health Check Endpoints: /api/health route on web, HTTP health server on scraper (HRDN-01, HRDN-02)
- [ ] 10-02-PLAN.md — Backup System: sqlite3 .backup cron job with 30-day retention in Docker sidecar (HRDN-05, HRDN-06)
- [ ] 10-03-PLAN.md — Docker Hardening: HEALTHCHECK on all services, service_healthy depends_on, json-file log rotation (HRDN-03, HRDN-04, HRDN-08, HRDN-10)

### Phase 11: Verification & Launch
**Goal**: Every production-critical feature is verified through active testing and the deployment is confirmed ready for public use
**Depends on**: Phase 8, Phase 9, Phase 10
**Requirements**: [VERF-01, VERF-02, VERF-03, VERF-04, VERF-05, VERF-06]
**Success Criteria** (what must be TRUE):
  1. A user can log in with Google over `https://krepza.lt` and access their grocery lists
  2. A user can log in with Facebook over `https://krepza.lt` and access their grocery lists
  3. Browser DevTools Console shows zero CSP violations when browsing pages with ad components loaded
  4. A restored SQLite backup passes `PRAGMA integrity_check` with no corruption detected
  5. An unauthenticated (incognito) visitor can access the homepage, `ads.txt`, and `robots.txt` without errors
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — OAuth & Public Access Verification: Google/Facebook login E2E on krepza.lt + incognito crawl test of ads.txt, robots.txt, homepage
- [ ] 11-02-PLAN.md — Ad & Infrastructure Integrity: CSP violation audit, AdSense tag rendering verification, SQLite backup restore integrity test

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 5. Complete Rebrand | v2.0 | 3/3 | Complete | 2026-04-29 |
| 6. AdSense Integration | v2.0 | 2/2 | Complete | 2026-04-29 |
| 7. Domain-Agnostic Deploy | v2.0 | 1/1 | Complete | 2026-04-29 |
| 8. Tunnel Infrastructure | v3.0 | 0/3 | Not started | - |
| 9. AdSense Readiness | v3.0 | 0/3 | Not started | - |
| 10. Production Hardening | v3.0 | 0/3 | Not started | - |
| 11. Verification & Launch | v3.0 | 0/2 | Not started | - |

---
*Roadmap updated: 2026-04-29 after v3.0 roadmapping*
