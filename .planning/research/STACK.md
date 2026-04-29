# Technology Stack — Production Deployment (v3.0)

**Project:** Krepza — Lithuanian Grocery Price Tracker
**Researched:** 2026-04-29
**Confidence:** HIGH

## Recommended Stack

### Tunnel / Reverse Proxy

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| cloudflared (Cloudflare Tunnel) | latest (Docker: `cloudflare/cloudflared`) | Reverse proxy tunnel — routes public traffic from krepza.lt to internal web container without opening ports | Official Cloudflare solution. Zero firewall configuration. Automatic SSL from edge to user. Built-in DDoS protection. Docker image maintained by Cloudflare. |
| Cloudflare DNS | — | DNS for krepza.lt, proxied through Cloudflare (orange cloud) | Required for Tunnel to work. Provides CDN, SSL, and hides origin IP. |

**Decision: cloudflared with tunnel token (not config file).** For a single-service tunnel (just web:3131), the token approach is simpler: one `TUNNEL_TOKEN` env var. Config file is better for multi-service tunnels but adds a mounted file dependency.

### Infrastructure (Existing — No Change)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker Compose | v2+ | Multi-service orchestration (web + scraper + embedder + cloudflared) | Already the project standard. Adding cloudflared as a 4th service. |
| Next.js (standalone output) | 14 (App Router) | Web application server | Already built. `output: "standalone"` in next.config.js enables optimized Docker deployment. |
| SQLite (WAL mode) | 3.x | Application database | Already built. WAL mode enables concurrent reads during backup. Single-file, no separate DB container needed. |
| Prisma | 5.x | ORM and schema management | Already built. Prisma adapter for next-auth@4. |

### Supporting Libraries / Tools (New)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sqlite3 CLI | (included in web Docker image via `apk add sqlite`) | Database backup via `.backup` command | Cron-based backup script. Already installed in web Dockerfile. |
| curl/wget | (included in alpine base image) | Health check probing in docker-compose `healthcheck:` | Docker health checks for web and cloudflared containers. |
| cron (or busybox crond) | (included in alpine) | Scheduled backup execution | Run in a lightweight sidecar or on host. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Tunnel | cloudflared Docker container | ngrok | ngrok is a commercial service with bandwidth limits, custom domains require paid plan. cloudflared is free, maintained by Cloudflare, and integrates with existing Cloudflare DNS. |
| Tunnel | cloudflared Docker container | FRP (Fast Reverse Proxy) | FRP requires a public server with open ports. Cloudflare Tunnel requires zero open ports. FRP doesn't provide SSL/CDN/DDoS. |
| Reverse proxy | None (Cloudflare Tunnel IS the proxy) | nginx / Caddy / Traefik | Adding a local reverse proxy creates an unnecessary hop: Cloudflare → proxy → web. Tunnel already handles routing, SSL, and header management. YAGNI. |
| SSL | Cloudflare-provided (Full strict mode) | Let's Encrypt via Certbot | Cloudflare provides SSL certificates automatically. Tunnel encrypts from edge to origin. No cert renewal scripts needed. |
| Monitoring | cloudflared /ready endpoint + Docker health checks | Prometheus + Grafana stack | Overkill for single-server self-hosted app. Health checks provide sufficient operational awareness. Add later if needed. |
| Backups | sqlite3 `.backup` + cron | Litestream (continuous SQLite replication) | Litestream requires S3-compatible storage and adds operational complexity. For a single-server app, periodic `.backup` snapshots are sufficient and simpler. |
| Logging | stdout with Docker json-file driver | ELK stack / Loki / Datadog | Overkill for this scale. `docker logs` with JSON output provides grep-able, structured logs without additional infrastructure. |

## Installation

```bash
# No new npm packages required for deployment features.
# All infrastructure is Docker-based.

# Pull cloudflared image:
docker pull cloudflare/cloudflared:latest

# The web Docker image already includes sqlite3:
#   apk add --no-cache sqlite  (in packages/web/Dockerfile)
```

## Environment Variables (New for v3.0)

| Variable | Where | Purpose |
|----------|-------|---------|
| `TUNNEL_TOKEN` | docker-compose.yml (cloudflared service) | Cloudflare Tunnel authentication token. Created via `cloudflared tunnel token <tunnel-id>`. |
| `NEXTAUTH_URL` | .env → docker-compose.yml (web service) | Must be set to `https://krepza.lt` for production OAuth callbacks and session cookies. |
| `NEXT_PUBLIC_ADSENSE_ID` | .env → docker-compose.yml (web service) | Already exists. Must be set with real AdSense pub ID for production. |

## Sources

- Cloudflare Tunnel configuration: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/ — HIGH
- cloudflared Context7: `/cloudflare/cloudflared` — HIGH
- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting — HIGH (Context7)
- SQLite backup: https://www.sqlite.org/backup.html — HIGH
- Docker HEALTHCHECK: https://docs.docker.com/reference/dockerfile/#healthcheck — HIGH
