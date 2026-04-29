# Project Research Summary

**Project:** Krepza — Lithuanian Grocery Price Tracker (v3.0 Production Deployment)
**Domain:** Self-hosted Docker app, Cloudflare Tunnel, AdSense monetization
**Researched:** 2026-04-29
**Confidence:** HIGH

## Executive Summary

Krepza is a self-hosted Docker-based grocery price tracker (Next.js + SQLite + background scrapers) that needs to go live at krepza.lt with zero open firewall ports and AdSense monetization. The production deployment milestone adds infrastructure — a Cloudflare Tunnel container (cloudflared) for reverse proxying — plus AdSense verification artifacts (ads.txt, CSP), Docker health checks, and automated database backups. No application code changes are needed; the existing v2.x app is deployment-ready.

Experts building self-hosted production deployments use Cloudflare Tunnel to avoid exposing ports: the cloudflared container makes an **outbound** connection to Cloudflare's edge, which then routes public HTTPS traffic inward through an encrypted tunnel. This eliminates firewall configuration, provides automatic SSL from edge to user with full-strict mode at the origin, and includes built-in DDoS protection — all without requiring a traditional reverse proxy (nginx/Caddy) or port forwarding. The tunnel token pattern (single `TUNNEL_TOKEN` env var) is preferred over config file management for single-service deployments.

The top risks to prevent are, in order: (1) CSP silently blocking AdSense scripts — zero revenue with no visible error, (2) `NEXTAUTH_URL` misconfigured as `http://` instead of `https://` breaking OAuth login, (3) SQLite backup via raw `cp` instead of `.backup` API producing corrupt snapshots, and (4) `TUNNEL_TOKEN` accidentally committed to git creating a security breach. All four have straightforward prevention strategies outlined below.

## Key Findings

### Recommended Stack

The deployment layer adds one new Docker service (cloudflared) and three environment variables. No new npm packages, no database migration, no reverse proxy software.

**Core technologies:**

- **cloudflared (Cloudflare Tunnel)** — reverse proxy tunnel routing krepza.lt → web:3131 internally via Docker network. Uses `TUNNEL_TOKEN` env var for authentication. Provides SSL, CDN, DDoS protection without opening firewall ports.
- **SQLite WAL with `.backup` API** — already the project database. WAL mode enables concurrent reads during backup. `sqlite3 grocery.db ".backup backup.db"` produces consistent snapshots safely.
- **Next.js App Router `headers()`** — injects security headers (CSP, HSTS, X-Frame-Options, etc.) via `next.config.js`. AdSense requires specific origins in CSP `script-src`, `frame-src`, `connect-src`, and `img-src` directives.
- **Docker Compose `healthcheck:`** — curl-based health checks on web (`/api/health`) and cloudflared (`/ready` on metrics port) enable `restart: unless-stopped` auto-recovery.
- **cron + sqlite3 CLI** — scheduled backup to timestamped files on mounted `/backups` volume. Alpine's built-in `crond` or host-level crontab.

**Environment variables (new for v3.0):**
| Variable | Purpose |
|----------|---------|
| `TUNNEL_TOKEN` | cloudflared authentication token (never commit!) |
| `NEXTAUTH_URL` | Must be `https://krepza.lt` in production for OAuth callbacks |
| `NEXT_PUBLIC_ADSENSE_ID` | Must be set to real `pub-XXXXXXXXXXXXXXXX` — empty = no ads |

### Expected Features

**Must have (table stakes) — deployment fails without these:**

1. **Cloudflare Tunnel container in docker-compose** — The entire deployment mechanism. Routes krepza.lt traffic to the web container via Docker internal network. No ports exposed.
2. **ads.txt at domain root** (`public/ads.txt`) — AdSense REQUIRES this file for verification. One-line format: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`.
3. **Security headers with AdSense-compatible CSP** — CSP is critical. Must include `pagead2.googlesyndication.com` (script-src), `googleads.g.doubleclick.net` + `tpc.googlesyndication.com` (frame-src). `X-Frame-Options: SAMEORIGIN` (NOT DENY — that breaks ad iframes).
4. **Health check endpoints** — `/api/health` (web) returns 200/503, cloudflared `/ready` on `:49312` returns 200/503. Docker uses these for restart decisions.
5. **Database backup strategy** — `sqlite3 .backup` command via cron, writing to mounted `/backups` volume. WAL-safe, produces consistent snapshots.
6. **Environment-based production config** — `NEXTAUTH_URL=https://krepza.lt`, real `NEXT_PUBLIC_ADSENSE_ID`, and `TUNNEL_TOKEN` all set correctly.

**Should have (differentiators for production quality):**

- Structured JSON logging (grep-able `docker logs` output)
- cloudflared Prometheus metrics on `:49312` (future observability)
- Docker health checks with auto-restart on all services
- GDPR consent-aware ad loading verified over HTTPS (already built)
- Automated daily DB backups with timestamped files
- robots.txt (allow homepage, disallow API routes)

**Defer (v2+/post-MVP):**

- Sitemap generation (SEO, not blocking)
- Prometheus/Grafana monitoring dashboards (overkill for single-server)
- Email notifications for health failures (needs transactional email service)
- Multi-region / load-balanced deployment (not needed at this scale)
- Database migration to PostgreSQL/MySQL (SQLite handles scale well)

### Architecture Approach

The production architecture adds a cloudflared container as the sole entry point for public traffic, sitting between Cloudflare's global edge and the existing Docker services. No local reverse proxy — the tunnel's ingress rules route directly to `http://web:3131`. All containers share the default Docker Compose network. The web container is the only service with an internal port mapping; scraper and embedder are internal-only.

```
Internet → Cloudflare Edge (SSL+CDN+DDoS) → cloudflared (outbound tunnel) → web:3131
                                                                           → scraper (internal)
                                                                           → embedder (internal)
                                                                           → SQLite (shared volume)
```

**Major components and responsibilities:**

1. **cloudflared container** — Tunnel management, ingress routing (`krepza.lt → http://web:3131`), metrics exposition (`:49312`), health signal (`/ready` endpoint). Uses `TUNNEL_TOKEN` env var. No ports exposed.
2. **Web container (Next.js, unchanged)** — Serves app on `:3131` (internal only). Hosts `/ads.txt`, `/robots.txt` from `public/`. Exposes `/api/health`. Injects CSP + security headers via `next.config.js`.
3. **Scraper container (unchanged)** — Periodic price scraping from Lithuanian grocery sites. Reads/writes SQLite via shared volume. Internal-only.
4. **Embedder container (unchanged)** — Gemini API embeddings for product data. Reads/writes SQLite via shared volume. Internal-only.
5. **SQLite database** — Single file on shared `packages/data/` volume. WAL mode enables concurrent reads. Backed up via sqlite3 `.backup` API.

**Key patterns:**
- **Tunnel Token Pattern:** `command: tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}` — simpler than config file for single-service tunnels
- **Health Check as Route Handler:** `export function GET() { return Response.json({ status: 'ok' }) }` — minimal, doesn't need DB query
- **SQLite .backup over raw cp:** `sqlite3 grocery.db ".backup backup.db"` uses Online Backup API for consistent snapshots
- **CSP via next.config.js headers():** All security headers in one place, applies to all routes, no middleware needed

### Critical Pitfalls

1. **CSP blocks AdSense scripts (silent failure)** — CSP deployed without `pagead2.googlesyndication.com` in `script-src` or `googleads.g.doubleclick.net` in `frame-src`. Ads silently fail to load. Zero revenue, no visible error. **Prevention:** Include all AdSense origins in CSP, test with DevTools Console after deploy, consider `Content-Security-Policy-Report-Only` first.

2. **X-Frame-Options: DENY breaks AdSense iframes** — `DENY` blocks ALL framing including legitimate ad iframes. **Prevention:** Use `SAMEORIGIN` + `frame-ancestors 'self'` in CSP. These values are fundamentally incompatible with AdSense.

3. **TUNNEL_TOKEN leaked in git repository** — Token committed to `.env` or docker-compose.yml. Anyone can create tunnel connections to the Cloudflare account. **Prevention:** Never commit the token. Use `.env` (already gitignored) and reference via `${TUNNEL_TOKEN}`. Rotate immediately if exposed.

4. **SQLite backup via `cp` produces corrupt snapshot** — Raw file copy during a write produces an inconsistent database. Backup is useless. **Prevention:** Always use `sqlite3 grocery.db ".backup backup.db"`. Verify WAL mode is enabled. Test restoration periodically with `PRAGMA integrity_check;`.

5. **NEXTAUTH_URL set to `http://` not `https://`** — OAuth providers reject callback URL mismatch. Users can't log in. Session cookies may not persist (browsers require `Secure` flag). **Prevention:** Set `NEXTAUTH_URL=https://krepza.lt` in production. Update OAuth provider dashboards (Google Cloud Console, Facebook Developers) to use `https://` callback URLs.

## Implications for Roadmap

Based on research, deployment features have a clear dependency chain. The suggested phase structure follows "get traffic flowing → verify AdSense → harden → launch."

### Phase 1: Tunnel Infrastructure

**Rationale:** Nothing works without the tunnel. Cloudflare Tunnel is the deployment's single public entry point. All other deployment features (ads.txt serving, HTTPS, health checks over the tunnel) depend on traffic flowing through it first. Get the tunnel operational on a staging domain or temporary URL before exposing krepza.lt.

**Delivers:** cloudflared container in docker-compose, tunnel connected to Cloudflare edge, traffic routing `krepza.lt → web:3131`, SSL via Cloudflare (Full strict mode). Verify with `curl https://krepza.lt` returns the app.

**Features addressed:**
- Cloudflare Tunnel container in docker-compose (table stake)
- SSL/TLS via Cloudflare (table stake)
- NEXTAUTH_URL set to `https://krepza.lt` (table stake)
- OAuth provider callback URLs updated to production (prerequisite)

**Pitfalls to avoid:**
- Pitfall 3: TUNNEL_TOKEN leaked (never commit)
- Pitfall 5: NEXTAUTH_URL http:// instead of https://
- Pitfall 6: cloudflared not on same Docker network → 502 errors
- Pitfall 10: DNS propagation delay (wait 24-48h, use dig to verify)

**Research flag:** Standard patterns — Cloudflare Tunnel Docker deployment is well-documented by Cloudflare. **Skip research-phase.**

### Phase 2: AdSense Readiness

**Rationale:** AdSense is the monetization model. Ads won't serve without ads.txt verification and correct CSP. Setting these up early allows time for AdSense site review (can take days to weeks). Do this as soon as the tunnel is operational so Google can crawl the production domain.

**Delivers:** `ads.txt` served at root (verified with `curl -I`), CSP with all required AdSense origins, full security header set (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy), AdSense publisher ID set in env.

**Features addressed:**
- ads.txt at domain root (table stake)
- Security headers with AdSense CSP (table stake)
- CSP design from AdSense official docs (differentiator)
- NEXT_PUBLIC_ADSENSE_ID set to real value (table stake)
- GDPR consent ads verified over HTTPS (differentiator)

**Pitfalls to avoid:**
- Pitfall 1: CSP silently blocks AdSense scripts (TEST in DevTools Console!)
- Pitfall 2: X-Frame-Options: DENY breaks ad iframes (use SAMEORIGIN)
- Pitfall 7: AdSense rejection for insufficient content (check incognito mode)
- Pitfall 9: NEXT_PUBLIC_ADSENSE_ID empty → no ads render
- Pitfall 11: robots.txt accidentally blocks ads.txt crawler

**Research flag:** Standard patterns — CSP for AdSense is documented by Google. **Skip research-phase.**

### Phase 3: Production Hardening

**Rationale:** Health checks enable Docker auto-restart, and backups protect against data loss. Both are operationally critical but don't block Phase 1 or 2 from progressing. Can be built while waiting for AdSense review.

**Delivers:** `/api/health` endpoint (web), Docker health checks on web and cloudflared, `restart: unless-stopped` with health-based restart, automated DB backup script with cron, structured JSON logging (web + cloudflared), robots.txt.

**Features addressed:**
- Health check endpoints (table stake)
- Docker health checks with auto-restart (differentiator)
- Database backup strategy (table stake)
- Structured JSON logging (differentiator)
- Automated DB backup to timestamped files (differentiator)
- robots.txt (differentiator)
- cloudflared metrics endpoint (future use, deferred)

**Pitfalls to avoid:**
- Pitfall 4: SQLite backup via `cp` instead of `.backup` → corrupt backup
- Pitfall 8: Health check pollutes DB logs (keep it lightweight, skip DB query)
- Phase warning: Backup script writes to ephemeral storage (mount `/backups` volume)
- Phase warning: curl not in web Docker image (alpine needs `apk add curl`)

**Research flag:** Standard patterns — Docker HEALTHCHECK and SQLite backup are well-documented. **Skip research-phase.**

### Phase 4: Verification & Launch

**Rationale:** Before declaring production ready, verify every table-stake feature works end-to-end. CSP violations are a silent failure mode — the only way to catch them is active testing with DevTools open. Backup integrity must be tested with actual restoration. This phase is about validation, not new feature development.

**Delivers:** CSP violation audit (DevTools Console), AdSense tag verification (real publisher ID, confirm impressions in AdSense dashboard), backup restoration test (`PRAGMA integrity_check;` on restored backup), OAuth login test with Google and Facebook over production HTTPS, full-page crawl verification (ads.txt, robots.txt, homepage accessible without login).

**Features validated:**
- All table-stake features from Phase 1-3
- CSP not blocking any ad resources
- AdSense site review passed or in progress
- Backup restores successfully

**Pitfalls to avoid:**
- Pitfall 1 (revisited): CSP still blocking after Phase 2 config — active testing catches this
- Phase warning: OAuth callbacks still point to localhost → login fails
- Phase warning: ads.txt served with wrong Content-Type (must be `text/plain`)

**Research flag:** No research needed — verification/testing phase. **Skip research-phase.**

### Phase Ordering Rationale

- **Tunnel first** because it's the gateway. Ads.txt, CSP, OAuth — everything depends on HTTPS traffic flowing through the tunnel. You can't verify ads.txt is reachable without the tunnel working.
- **AdSense second** because the site review process takes time (days to weeks). Submitting early means review happens in parallel with hardening work. If CSP blocks ads, you want to discover that before the reviewer checks.
- **Hardening third** because health checks and backups are self-contained — they don't block AdSense review and don't depend on CSP being finalized. Work on them while waiting.
- **Verification last** because it validates everything built in Phases 1-3. CSP validation especially can't happen until security headers are deployed and real AdSense tags are loading.
- **Key dependency:** `NEXTAUTH_URL` must be set in Phase 1 because OAuth providers need the production callback URL configured before any login testing. Set this immediately when the tunnel is up.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | cloudflared Docker deployment, Next.js standalone output, and SQLite backup API are all verified against official Cloudflare, Vercel/Next.js, and SQLite documentation. Context7 sources confirm. |
| Features | HIGH | ads.txt format from official Google AdSense help center. CSP origins from Google Tag Platform security guide. Health check pattern from Docker reference + Next.js Context7 docs. Table stakes clearly identified. |
| Architecture | HIGH | Tunnel ingress pattern verified in Cloudflare Tunnel config reference. No reverse proxy anti-pattern confirmed. Component boundaries map to existing docker-compose structure. Data flows traced end-to-end. |
| Pitfalls | HIGH | All critical pitfalls derived from primary sources (Google CSP guide, SQLite backup docs, Cloudflare Tunnel troubleshooting). Silent AdSense failure mode is a known real-world problem. Token leakage is a well-understood security risk. |

**Overall confidence:** HIGH — all findings backed by official vendor documentation (Cloudflare, Google, SQLite, Docker, Next.js) via Context7 verification and direct source review.

### Gaps to Address

- **AdSense site review outcome:** Research confirms the technical requirements (ads.txt, CSP, content visibility) but cannot guarantee AdSense approval. The incognito-mode content check (Pitfall 7) is the best mitigation. If the homepage is a login wall, AdSense will reject — verify this in Phase 4.
- **Cloudflare Tunnel token lifecycle:** Research covers token creation and usage but not token rotation procedures in production. If token rotation is needed, follow Cloudflare's token management docs.
- **Backup retention and pruning:** Research establishes the backup mechanism (`.backup` command + cron) but leaves retention policy (how many days to keep, when to prune) as an operational decision. Implement simple `find /backups -mtime +30 -delete` as a starting point.
- **Docker image health check dependencies:** The web Dockerfile needs `curl` (Alpine: `apk add curl`) for the compose-level health check to work. Verify this is in the existing Dockerfile or add it during Phase 3.

## Sources

### Primary (HIGH confidence)

- Cloudflare Tunnel config reference: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/ — ingress rules, token auth, metrics
- Cloudflare Tunnel Context7: `/cloudflare/cloudflared` — Docker deployment, TUNNEL_TOKEN env var
- Google AdSense ads.txt guide: https://support.google.com/adsense/answer/12171612 — file format, publisher ID location
- Google Tag/CSP security guide: https://developers.google.com/tag-platform/security/guides/csp — required AdSense CSP origins
- Next.js CSP guide: https://nextjs.org/docs/app/guides/content-security-policy — headers() configuration
- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting — standalone output, production deployment
- SQLite backup API: https://www.sqlite.org/backup.html — Online Backup API, WAL-safe snapshots
- SQLite CLI: https://www.sqlite.org/cli.html — `.backup` command syntax
- Docker HEALTHCHECK reference: https://docs.docker.com/reference/dockerfile/#healthcheck — health check format and restart behavior
- Next.js Route Handlers: Context7 docs — `/api/health` pattern

### Secondary (MEDIUM confidence)

- next-auth OAuth callback URLs: https://next-auth.js.org/configuration/providers/oauth — NEXTAUTH_URL configuration

### Tertiary (LOW confidence)

- None — all deployment domain sources are first-party official documentation.

---
*Research completed: 2026-04-29*
*Ready for roadmap: yes*
