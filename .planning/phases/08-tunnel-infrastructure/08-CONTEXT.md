# Phase 8: Tunnel Infrastructure - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

## Phase Boundary

Deploy the Cloudflare Tunnel container (cloudflared) in docker-compose.yml, configure DNS for krepza.lt, route HTTPS traffic to the web container, update OAuth callback URLs for production, and verify end-to-end HTTPS. Zero hardcoded domain references remain — all routing via env vars.

## Implementation Decisions

### Domain & Routing

- **D-01:** Route both `krepza.lt` and `www.krepza.lt` through the tunnel. `www` redirects to apex (`krepza.lt`). Configured via Cloudflare Tunnel ingress rules + Cloudflare Page Rules.
- **D-02:** Incremental migration — add cloudflared service while keeping `ports: "3131:3131"` exposed on web. Test tunnel end-to-end (curl https://krepza.lt), THEN remove port exposure. Prevents unreachable-web scenarios during DNS propagation.

### OAuth

- **D-03:** User has access to both Google Cloud Console and Facebook Developers. They will update Authorized Redirect URIs themselves after tunnel is operational:
  - Google: Add `https://krepza.lt/api/auth/callback/google`
  - Facebook: Add `https://krepza.lt/api/auth/callback/facebook`
  
  The agent provides the exact URIs and verification step but does not need to log into consoles.

### the agent's Discretion

- Cloudflare Tunnel creation (account, domain, nameservers, tunnel, token) — agent provides step-by-step guidance
- Cloudflare SSL/TLS: Full (strict) mode
- cloudflared Docker image: `cloudflare/cloudflared:latest`
- Tunnel command: `tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}`
- Ingress rule: `hostname: krepza.lt, service: http://web:3131` (internal Docker network)
- `depends_on: web` with `condition: service_started` for initial setup (upgrade to `service_healthy` in Phase 10)
- TUNNEL_TOKEN stored in `.env` (never committed, already gitignored)
- Cloudflare DNS managed automatically when domain added to Cloudflare
- NEXTAUTH_URL set to `https://krepza.lt` (replaces `http://localhost:3131`)

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Integration

- `.planning/research/ARCHITECTURE.md` — Tunnel topology, Docker network layout, cloudflared integration points, build order
- `.planning/research/STACK.md` — cloudflared Docker deployment pattern, TUNNEL_TOKEN management, env var dependencies

### Requirements & Scope

- `.planning/REQUIREMENTS.md` § Tunnel Infrastructure — TUNN-01 through TUNN-06 (6 requirements)
- `.planning/ROADMAP.md` § Phase 8 — Goal and success criteria (5 criteria)

### Pitfalls

- `.planning/research/PITFALLS.md` — Critical: TUNNEL_TOKEN in git (#3), NEXTAUTH_URL http vs https (#5), cloudflared on wrong Docker network (#6), DNS propagation delay (#10)

### Existing Configuration

- `docker-compose.yml` — Current 3-service layout (web:3131 exposed, scraper, embedder). Insert cloudflared as 4th service.
- `.env.example` — Env var template. Add TUNNEL_TOKEN entry.
- `packages/web/src/lib/auth.ts` — next-auth config with GoogleProvider + FacebookProvider. OAuth callback URLs derived from NEXTAUTH_URL.

## Existing Code Insights

### Reusable Assets

- `docker-compose.yml`: Existing services use `restart: unless-stopped`, `volumes: ./packages/data:/app/data`, `${ENV_VAR}` interpolation. cloudflared follows same patterns.
- `.env.example`: Well-documented template. Add TUNNEL_TOKEN section.

### Established Patterns

- All services use Docker Compose default network — cloudflared reaches web at `http://web:3131` (service name, not localhost)
- Next.js standalone output on port 3131, exposed via EXPOSE 3131 + ENV PORT=3131 in Dockerfile
- next-auth uses NEXTAUTH_URL for callback URL generation — single env var change covers both providers

### Integration Points

- **docker-compose.yml line 6-7:** `ports: "3131:3131"` — remove after tunnel verified. During incremental migration, keep it.
- **docker-compose.yml line 13:** `NEXTAUTH_URL=${NEXTAUTH_URL}` — already interpolated. Set to `https://krepza.lt` in `.env`.
- **auth.ts line 10-17:** GoogleProvider + FacebookProvider callback URLs — NEXTAUTH_URL change propagates automatically. No code changes needed.

## Specific Ideas

- During incremental migration, test tunnel with `curl -H "Host: krepza.lt" http://localhost:3131` to verify web responds before cutting over DNS
- Use `dig krepza.lt` to verify DNS propagation before removing port exposure
- TUNNEL_TOKEN format: Cloudflare issues a long base64 string — copy from Cloudflare Zero Trust dashboard
- Cloudflare Tunnel setup path: Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create a tunnel → Select "Docker" → Copy token → Paste into .env

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 8-Tunnel Infrastructure*
*Context gathered: 2026-04-29*
