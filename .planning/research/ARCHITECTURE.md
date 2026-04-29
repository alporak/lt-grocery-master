# Architecture Patterns — Production Deployment (v3.0)

**Domain:** Self-hosted Docker app with Cloudflare Tunnel
**Researched:** 2026-04-29
**Confidence:** HIGH

## Recommended Architecture

```
                        INTERNET
                           │
                    ┌──────▼──────┐
                    │  Cloudflare  │
                    │    Edge      │
                    │ (SSL + CDN)  │
                    └──────┬──────┘
                           │ outbound-initiated
                           │ encrypted tunnel (QUIC/HTTP2)
                           │
                    ┌──────▼──────┐
                    │ cloudflared │  ← Docker container
                    │  container  │     port: (none exposed)
                    │  ingress:   │     metrics: :49312
                    │  krepza.lt  │
                    │  → web:3131 │
                    └──────┬──────┘
                           │ Docker network (internal)
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌────▼────┐  ┌───▼──────┐
     │    web     │  │ scraper │  │ embedder │
     │  :3131     │  │  (no    │  │  (no     │
     │  public    │  │  port)  │  │  port)   │
     │  /api/     │  │internal │  │internal  │
     │  health    │  │ only    │  │ only     │
     └────┬───────┘  └────┬────┘  └───┬──────┘
          │               │           │
          └───────────────┼───────────┘
                          │ shared volume
                   ┌──────▼──────┐
                   │ packages/   │
                   │   data/     │
                   │ grocery.db  │
                   │ (SQLite     │
                   │  WAL mode)  │
                   └─────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Cloudflare Edge | SSL termination, DDoS protection, CDN caching, DNS | cloudflared container (via outbound tunnel), end users |
| cloudflared container | Tunnel management, ingress routing, metrics | Web container (via Docker network), Cloudflare Edge (via outbound QUIC/HTTP2) |
| Web container (Next.js) | Serve app, handle API routes, manage auth, serve ads.txt/robots.txt | SQLite DB (shared volume), embedder (HTTP), OAuth providers (Google/Facebook) |
| Scraper container | Periodic price scraping from Lithuanian grocery sites | SQLite DB (shared volume), embedder (HTTP), external grocery sites |
| Embedder container | Gemini API embeddings for product data | SQLite DB (shared volume), Gemini API |
| SQLite DB | Persistent data storage (users, lists, products, sessions) | All three containers via shared volume. WAL mode for concurrent reads. |

### Data Flow

**User request flow:**
```
User Browser → https://krepza.lt → Cloudflare Edge → Tunnel → cloudflared → web:3131 → Next.js handler → SQLite DB → Response
```

**AdSense flow:**
```
Page load → GDPR consent check → (consented) → next/script loads pagead2.googlesyndication.com → AdSense serves ad iframe from googleads.g.doubleclick.net
```

**AdSense verification flow:**
```
Google crawler → https://krepza.lt/ads.txt → Cloudflare Edge → Tunnel → cloudflared → web:3131 → public/ads.txt → Response (text/plain)
```

**Health check flow:**
```
Docker daemon → curl http://web:3131/api/health → Next.js route handler → (optional) DB ping → { status: "ok" } or 503
Docker daemon → curl http://cloudflared:49312/ready → cloudflared → 200 (tunnel connected) or 503
```

**Backup flow (cron):**
```
Cron trigger → sqlite3 /app/data/grocery.db ".backup /backups/grocery-$(date).db" → SQLite Online Backup API → consistent snapshot → /backups/ volume
```

## Patterns to Follow

### Pattern 1: Tunnel Token (not Config File) for Single-Service Deployments

**What:** Use `TUNNEL_TOKEN` environment variable to authenticate cloudflared, with a minimal command that routes all traffic to web:3131. No config file needed.

**When:** Single public service (just the web container). The tunnel has one ingress rule: all traffic for `krepza.lt` goes to `http://web:3131`.

**Example:**
```yaml
# docker-compose.yml (new service)
cloudflared:
  image: cloudflare/cloudflared:latest
  command: tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}
  environment:
    - TUNNEL_METRICS=0.0.0.0:49312
    - TUNNEL_LOGLEVEL=info
  restart: unless-stopped
```

### Pattern 2: Health Check Endpoint as App Router Route Handler

**What:** A simple `route.ts` in the Next.js App Router that returns 200 if the app is healthy, 503 if not. Can optionally check DB connectivity.

**When:** Every production Next.js app should have one. Used by Docker health checks and external monitoring.

**Example:**
```typescript
// src/app/api/health/route.ts
export function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() })
}
```

### Pattern 3: SQLite Backup via Online Backup API (WAL-safe)

**What:** Use sqlite3's `.backup` command which uses the SQLite Online Backup API internally. This is safe while the database is in use (WAL mode) because it takes a consistent snapshot without blocking writers for the entire duration.

**When:** Backing up a live SQLite database. WAL mode must be enabled (already the case for this project).

**Example:**
```bash
# Safe to run while app is running:
sqlite3 /app/data/grocery.db ".backup /backups/grocery-$(date +%Y%m%d-%H%M).db"
```

### Pattern 4: CSP via next.config.js headers() (with AdSense origins)

**What:** Configure Content-Security-Policy and other security headers in `next.config.js` using the `headers()` async function. AdSense requires specific origins in `script-src`, `frame-src`, `connect-src`, and `img-src`.

**When:** Setting HTTP security headers. Use `next.config.js` headers() for App Router — it works for all routes and doesn't require middleware.

**Example:**
```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },  // NOT DENY — AdSense needs iframes
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://www.googletagmanager.com",
            "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
            "img-src 'self' data: https://pagead2.googlesyndication.com https://*.google-analytics.com",
            "connect-src 'self' https://pagead2.googlesyndication.com https://www.google.com",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
          ].join('; ')
        },
      ],
    },
  ]
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding a Local Reverse Proxy (nginx/Caddy/Traefik)

**What:** Placing nginx, Caddy, or Traefik between cloudflared and the web container.

**Why bad:** Cloudflare Tunnel IS the reverse proxy. Adding a local one creates an unnecessary hop (Cloudflare → Tunnel → nginx → web), adds latency, and creates a second point of failure and configuration surface. The tunnel's ingress rules already handle routing, and Cloudflare's edge already handles SSL, caching, and header management.

**Instead:** Configure cloudflared's ingress rules to route directly to `http://web:3131`. Let Next.js handle any path-level routing internally via the App Router.

### Anti-Pattern 2: Exposing Ports on the Host

**What:** Using `ports: "3131:3131"` in docker-compose for the web service when also using Cloudflare Tunnel, or opening port 3131 on the router/firewall.

**Why bad:** Defeats the security model of Cloudflare Tunnel. The tunnel exists precisely to avoid exposing ports. Exposing ports creates an attack surface that bypasses Cloudflare's DDoS protection and WAF.

**Instead:** Remove the `ports:` mapping from the web service (or keep it for localhost-only access during development). All public traffic flows through the tunnel. For local debugging: `ports: "127.0.0.1:3131:3131"` (localhost only).

### Anti-Pattern 3: X-Frame-Options: DENY with AdSense

**What:** Setting `X-Frame-Options: DENY` as a security header.

**Why bad:** AdSense serves ads in iframes. `DENY` blocks ALL framing, including legitimate ad iframes. Ads will silently not appear.

**Instead:** Use `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` in CSP. This allows your own pages to be framed (needed for some routing patterns) while blocking external sites from framing your content (clickjacking protection).

### Anti-Pattern 4: CSP Without Testing AdSense Tags

**What:** Deploying CSP and assuming it works, without checking browser console for blocked AdSense resources.

**Why bad:** AdSense loads scripts, images, and iframes from multiple Google domains. A CSP that's too restrictive will silently block these resources — ads won't appear, but the page won't visibly error. Revenue is lost without any obvious symptom.

**Instead:** After deploying CSP, open browser DevTools Console and check for CSP violation reports. Look for blocked `pagead2.googlesyndication.com` or `googleads.g.doubleclick.net` resources. Test with multiple ad formats (display, in-article, multiplex).

## Scalability Considerations

| Concern | At 1-100 users | At 1K users | At 10K+ users |
|---------|---------------|-------------|---------------|
| Tunnel capacity | Single cloudflared instance — handles thousands of concurrent connections | Still fine — cloudflared is lightweight | May need multiple cloudflared replicas for HA |
| Web server | Single Next.js container — handles ~100s req/s | Single container still fine for a grocery tracker (low req/s per user) | May need horizontal scaling (multiple web containers + load balancer) |
| Database | SQLite WAL — handles concurrent reads well, single writer | SQLite still fine at this scale (reads are concurrent, writes are infrequent for this app) | SQLite may become bottleneck for writes. Consider migration only if profiling shows contention. |
| Backups | Daily snapshots — <1GB DB, backup takes seconds | Daily snapshots still fine | May need incremental or continuous backup |

## Sources

- Cloudflare Tunnel architecture: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/ — HIGH
- Cloudflare Tunnel config YAML: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/ — HIGH
- Next.js headers configuration: https://nextjs.org/docs/app/api-reference/next-config-js/headers — HIGH (Context7)
- Google CSP guide for tags: https://developers.google.com/tag-platform/security/guides/csp — HIGH
- SQLite backup API: https://www.sqlite.org/backup.html — HIGH
