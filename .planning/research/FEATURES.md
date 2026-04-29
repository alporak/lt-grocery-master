# Feature Landscape: Production Deployment (v3.0)

**Domain:** Self-hosted Docker app deployment via Cloudflare Tunnel with AdSense monetization
**Researched:** 2026-04-29
**Confidence:** HIGH (primary sources: Cloudflare official docs, Google AdSense help center, Next.js official docs, SQLite official docs, Docker reference)

---

## Table Stakes

Features users (and external services) expect. Missing = deployment fails or product feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cloudflare Tunnel container (cloudflared) in docker-compose | Core deployment mechanism — routes public traffic to internal web container without opening firewall ports | **Med** | cloudflared runs as a Docker service alongside web/scraper/embedder. Uses tunnel token or config.yml with credentials JSON. Ingress rule maps `krepza.lt` → `http://web:3131`. |
| ads.txt served at domain root | AdSense REQUIRES `https://krepza.lt/ads.txt` to verify site ownership and authorize ad serving. Without it, ads won't show. | **Low** | Static file in Next.js `public/ads.txt`. One-line format: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`. Pub ID from AdSense dashboard → Account → Settings → Account information. |
| Health check endpoints for all services | Docker restart policies and Cloudflare Tunnel readiness depend on health signals. Without them, downtime goes undetected. | **Low** | Web: App Router route at `/api/health` (checks DB connection, returns 200/503). cloudflared: built-in `/ready` endpoint on metrics port. Scraper/embedder: minimal HTTP health server. |
| Security headers (CSP, HSTS, X-Content-Type-Options, etc.) | Production-grade HTTP security headers prevent XSS, clickjacking, MIME sniffing. AdSense requires specific CSP directives for `pagead2.googlesyndication.com`. | **Med** | Configure in `next.config.js` `headers()` function. CSP is the complex one — must allow AdSense script-src, frame-src, and connect-src origins. |
| SSL/TLS via Cloudflare | Browsers and OAuth providers require HTTPS. Cloudflare provides automatic SSL from edge to user + secure origin connection via tunnel. | **Low** | Cloudflare Tunnel encrypts traffic end-to-end. Set SSL/TLS mode to "Full (strict)" in Cloudflare dashboard. No cert management needed on the server. |
| Database backup strategy | SQLite is a single file — losing it means losing all user data, lists, and sessions. Backups are insurance against disk failure, corruption, or operator error. | **Med** | sqlite3 `.backup` command runs safely while DB is in WAL mode. Cron-based approach (host-level or backup sidecar container). Keep N days of rolling backups. |
| Environment-based configuration | `NEXTAUTH_URL` must point to `https://krepza.lt` in production so OAuth callbacks, session cookies, and all URL references work correctly. | **Low** | Already built (domain-agnostic deployment). Just set `NEXTAUTH_URL=https://krepza.lt` in `.env`. |

---

## Differentiators

Features that go beyond bare-minimum production deployment. Provide reliability, observability, and maintainability.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Structured JSON logging | Makes `docker logs` grep-able and parseable. Critical for debugging production issues when you can't attach a debugger. | **Low** | Next.js can output JSON via a simple logger wrapper. cloudflared supports `TUNNEL_LOGLEVEL` with logfile. Scraper/embedder: write JSON lines to stdout. |
| cloudflared Prometheus metrics | Free observability into tunnel health, connection counts, latency. Can feed into simple monitoring dashboards. | **Low-Med** | `cloudflared tunnel run --metrics 0.0.0.0:49312` exposes `/metrics` endpoint. Pair with a lightweight Prometheus or just query `/ready` for health checks. |
| Docker health checks with auto-restart | Docker restarts unhealthy containers automatically. Prevents silent failures where a container is "running" but not serving. | **Low** | Add `healthcheck:` to each service in docker-compose.yml. Web: `curl -f http://localhost:3131/api/health`. cloudflared: `cloudflared tunnel ready --metrics ...`. |
| GDPR consent-aware ad loading | Ads only load after user consents — already built in v2.0. Production deployment must ensure this works over HTTPS without mixed-content warnings. | **Low** | Verify consent banner + ad components work correctly with Cloudflare's SSL proxy. CSP must not block the consent mechanism. |
| Automated DB backup to timestamped files | Prevents data loss from operator error (e.g., accidental `rm`). Daily automated snapshots are better than manual "did I back up?" anxiety. | **Low-Med** | Script: `sqlite3 /data/grocery.db ".backup /backups/grocery-$(date +%Y%m%d-%H%M).db"`. Cron in a lightweight sidecar or host crontab. |
| robots.txt | Tells search engines what to index. Prevents scraper-bots from hammering dynamic routes. | **Low** | Static file in `public/robots.txt`. Allow homepage, disallow API routes and dynamic search pages. |
| Sitemap (optional, deferred) | Helps Google index product pages for organic traffic, increasing ad impressions. | **Med** | Next.js can generate dynamically. Defer to post-MVP. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom nginx/Caddy/Traefik reverse proxy | Cloudflare Tunnel IS the reverse proxy. Adding another layer adds latency, complexity, and a second point of failure. | Cloudflare Tunnel ingress rules route directly to the web container. No local reverse proxy needed. |
| Port forwarding / firewall holes | The whole point of Cloudflare Tunnel is to avoid exposing ports to the internet. Opening port 3131 on the router defeats the security model. | Only Cloudflare's edge has inbound access. All traffic flows through the encrypted tunnel. |
| Real-time monitoring dashboards (Grafana, Datadog, etc.) | Overkill for a single-server self-hosted app with one developer. Adds dependency on external services and configuration complexity. | `docker logs`, health check endpoints, and cloudflared's `/ready` endpoint provide sufficient observability. Add monitoring later if needed. |
| Multi-region / load-balanced deployment | This is a self-hosted single-server app. Adding distributed infrastructure multiplies complexity with no benefit at this scale. | Single Docker host with `restart: unless-stopped` on all services. Cloudflare handles global CDN/caching. |
| Database migration to PostgreSQL/MySQL | SQLite with WAL mode handles the app's read/write patterns well. Migration would require rearchitecting the Prisma schema and adding a separate DB container. | Keep SQLite. Use `.backup` for safety. |
| Custom backup format or incremental backup tooling | SQLite's `.backup` command produces a perfect, consistent snapshot in standard SQLite format. No need for custom tooling. | `sqlite3 file.db ".backup backup.db"` — simple, reliable, well-documented. |
| Email notifications for health check failures | Self-hosted email delivery is unreliable without a transactional email service (SendGrid, etc.), which adds cost and complexity. | Monitor via `docker logs` and manual health check inspection. Add notifications via a free tier service later if needed. |

---

## Feature Dependencies

```
ads.txt served at root ───────────── depends on ──→ Cloudflare Tunnel serving krepza.lt
Security headers (CSP) ───────────── must allow ──→ AdSense script domains (pagead2.googlesyndication.com, etc.)
Health check endpoints ────────────── enables ────→ Docker auto-restart on failure
DB backup strategy ────────────────── requires ──→ sqlite3 CLI available in container or on host
cloudflared metrics ───────────────── optional ──→ Prometheus (can skip, health check alone is sufficient)
Structured logging ────────────────── standalone feature (no dependencies)
GDPR consent + ads over HTTPS ─────── depends on ──→ Cloudflare SSL working + CSP not blocking consent
```

---

## MVP Recommendation

Prioritize these features for the first production deployment:

1. **Cloudflare Tunnel container in docker-compose** — The deployment doesn't work without this.
2. **ads.txt at domain root** — AdSense won't serve ads without verification. This is 1 file, 1 line.
3. **Security headers (CSP especially)** — CSP must be correct for AdSense to load. Bad CSP = broken ads + security scanner warnings.
4. **Health check endpoints (web + cloudflared)** — Docker restart policies need these. 20 lines of code.
5. **Simple DB backup script** — Insurance against data loss. Cron job, 5 lines of bash.

**Defer:**
- cloudflared Prometheus metrics — Health check `/ready` endpoint is sufficient for now
- Structured JSON logging — Nice to have, but `docker logs` with plain text works initially
- robots.txt / sitemap — Good for SEO but not blocking deployment
- Docker HEALTHCHECK in Dockerfiles — docker-compose `healthcheck:` is good enough

---

## CSP Design for AdSense Compatibility

The Content Security Policy must allow AdSense to load scripts, frames, and make connections. Based on Google's official CSP documentation (developers.google.com/tag-platform/security/guides/csp), AdSense requires:

| CSP Directive | Required Origins |
|---------------|-----------------|
| `script-src` | `'self'`, `'unsafe-inline'`, `https://pagead2.googlesyndication.com`, `https://www.googletagmanager.com` |
| `frame-src` | `https://googleads.g.doubleclick.net`, `https://tpc.googlesyndication.com` |
| `img-src` | `'self'`, `data:`, `https://pagead2.googlesyndication.com` |
| `connect-src` | `'self'`, `https://pagead2.googlesyndication.com`, `https://www.google.com` |
| `style-src` | `'self'`, `'unsafe-inline'` |

The app also needs:
- `default-src 'self'` — baseline restriction
- `font-src 'self'` — for app fonts (Inter, etc.)
- `object-src 'none'` — block Flash/plugins
- `base-uri 'self'` — prevent base tag injection
- `form-action 'self'` — prevent form hijacking
- `frame-ancestors 'self'` — prevent clickjacking (use `'self'` not `'none'` because AdSense uses iframes)

**Key insight:** `X-Frame-Options: DENY` would break AdSense iframes. Use `frame-ancestors 'self'` in CSP instead, and set `X-Frame-Options: SAMEORIGIN`.

---

## Sources

### AdSense / ads.txt
- Google AdSense ads.txt guide: https://support.google.com/adsense/answer/12171612 — **HIGH confidence** (official Google help center)
- AdSense pub ID format: `pub-XXXXXXXXXXXXXXXX` from Account → Settings → Account information

### Cloudflare Tunnel
- Cloudflare Tunnel configuration file reference: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/ — **HIGH confidence** (official docs)
- cloudflared Context7 library: `/cloudflare/cloudflared` — **HIGH confidence** (verified by Context7)
- Tunnel health check: `curl http://localhost:12345/ready` returns 200 if healthy, 503 otherwise
- Docker deployment: cloudflared supports `TUNNEL_TOKEN` env var for containerized setup

### Security Headers / CSP
- Next.js CSP guide: https://nextjs.org/docs/app/guides/content-security-policy — **HIGH confidence** (official docs via Context7)
- Google Tag/CSP guide: https://developers.google.com/tag-platform/security/guides/csp — **HIGH confidence** (official Google Developers docs)
- Next.js headers config: `next.config.js` `headers()` function — **HIGH confidence** (Context7 docs)
- Required security headers: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP

### Database Backups
- SQLite backup API: https://www.sqlite.org/backup.html — **HIGH confidence** (official SQLite docs)
- SQLite CLI `.backup` command: https://www.sqlite.org/cli.html — **HIGH confidence** (official SQLite docs)
- WAL mode allows concurrent reads during backup — already enabled in this project

### Docker Health Checks
- Docker HEALTHCHECK reference: https://docs.docker.com/reference/dockerfile/#healthcheck — **HIGH confidence** (official Docker docs)
- docker-compose healthcheck: `healthcheck:` key in service definition

### Next.js Health Endpoints
- Next.js Route Handlers: `route.ts` in App Router — **HIGH confidence** (Context7 docs)
- Pattern: `export function GET() { return Response.json({ status: 'ok' }) }`
