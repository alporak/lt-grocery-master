# Requirements: Krepza — v3.0 Production Deployment

**Defined:** 2026-04-29
**Core Value:** User logs in with one click (Google/Facebook) and their grocery lists follow them to any device.

## v3.0 Requirements

Requirements for production deployment milestone. Each maps to roadmap phases.

### Tunnel Infrastructure

- [ ] **TUNN-01**: Cloudflare account created and krepza.lt domain configured with DNS
- [ ] **TUNN-02**: cloudflared Docker container added to docker-compose.yml via TUNNEL_TOKEN
- [ ] **TUNN-03**: Traffic routed from krepza.lt → web:3131 via Cloudflare Tunnel ingress
- [ ] **TUNN-04**: OAuth callback URLs updated in Google Cloud Console and Facebook Developers to https://krepza.lt
- [ ] **TUNN-05**: NEXTAUTH_URL set to https://krepza.lt for production
- [ ] **TUNN-06**: HTTPS verified end-to-end (curl https://krepza.lt returns app, Cloudflare SSL Full strict)

### AdSense

- [ ] **ADSN-01**: ads.txt served at domain root with publisher ID, Content-Type text/plain
- [ ] **ADSN-02**: CSP configured with all required AdSense origins (script-src, frame-src, connect-src, img-src)
- [ ] **ADSN-03**: X-Frame-Options set to SAMEORIGIN to permit ad iframes
- [ ] **ADSN-04**: NEXT_PUBLIC_ADSENSE_ID set to real publisher ID
- [ ] **ADSN-05**: AdSense site submitted for approval with site ownership verified

### Production Hardening

- [ ] **HRDN-01**: /api/health endpoint on web container returning 200/503
- [ ] **HRDN-02**: Scraper health HTTP endpoint added on dedicated internal port
- [ ] **HRDN-03**: Docker HEALTHCHECK directives on web, cloudflared, scraper, and embedder
- [ ] **HRDN-04**: Docker auto-restart via restart: unless-stopped with health-based dependency ordering
- [ ] **HRDN-05**: SQLite daily backup using .backup API (not file copy), cron-scheduled
- [ ] **HRDN-06**: Backup retention: prune backup files older than 30 days
- [ ] **HRDN-07**: Security headers configured in next.config.js (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [ ] **HRDN-08**: Docker JSON log driver with rotation (max-size 10m, max-file 3) on all services
- [ ] **HRDN-09**: robots.txt in public/ allowing homepage, disallowing API routes
- [ ] **HRDN-10**: Docker Compose depends_on uses condition: service_healthy for startup ordering

### Verification

- [ ] **VERF-01**: OAuth login E2E test with Google over https://krepza.lt
- [ ] **VERF-02**: OAuth login E2E test with Facebook over https://krepza.lt
- [ ] **VERF-03**: CSP violation audit passes (zero violations for ad domains in DevTools Console)
- [ ] **VERF-04**: AdSense tags confirmed rendering with real publisher ID
- [ ] **VERF-05**: Backup restoration test (restore → PRAGMA integrity_check passes)
- [ ] **VERF-06**: Crawl verification: ads.txt, robots.txt, homepage accessible in incognito

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Observability

- **OBSV-01**: Prometheus metrics endpoint on cloudflared (:49312)
- **OBSV-02**: Prometheus/Grafana monitoring dashboards
- **OBSV-03**: Email notifications for health check failures

### Advanced Deployment

- **DEPL-01**: Cloudflare Tunnel token rotation procedure
- **DEPL-02**: Off-VPS backup storage (S3/rsync)
- **DEPL-03**: Sitemap generation for SEO

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time WebSocket sync | Polling/SSE sufficient. WebSocket adds complexity. |
| Mobile app | Web-first, responsive design covers mobile. |
| Email/password login | OAuth-only for seamlessness. |
| Offline write capability | Read-only cache offline sufficient. |
| Multi-region deployment | Overkill for single-server niche tracker. |
| Database migration to PostgreSQL | SQLite handles current scale well. |
| Automated tunnel token rotation | Manual rotation sufficient for single-server. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TUNN-01 | Phase 8 | Pending |
| TUNN-02 | Phase 8 | Pending |
| TUNN-03 | Phase 8 | Pending |
| TUNN-04 | Phase 8 | Pending |
| TUNN-05 | Phase 8 | Pending |
| TUNN-06 | Phase 8 | Pending |
| ADSN-01 | Phase 9 | Pending |
| ADSN-02 | Phase 9 | Pending |
| ADSN-03 | Phase 9 | Pending |
| ADSN-04 | Phase 9 | Pending |
| ADSN-05 | Phase 9 | Pending |
| HRDN-01 | Phase 10 | Pending |
| HRDN-02 | Phase 10 | Pending |
| HRDN-03 | Phase 10 | Pending |
| HRDN-04 | Phase 10 | Pending |
| HRDN-05 | Phase 10 | Pending |
| HRDN-06 | Phase 10 | Pending |
| HRDN-07 | Phase 10 | Pending |
| HRDN-08 | Phase 10 | Pending |
| HRDN-09 | Phase 10 | Pending |
| HRDN-10 | Phase 10 | Pending |
| VERF-01 | Phase 11 | Pending |
| VERF-02 | Phase 11 | Pending |
| VERF-03 | Phase 11 | Pending |
| VERF-04 | Phase 11 | Pending |
| VERF-05 | Phase 11 | Pending |
| VERF-06 | Phase 11 | Pending |

**Coverage:**
- v3.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 after initial definition*
