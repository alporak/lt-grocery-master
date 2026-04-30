# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30)

**Core value:** User logs in with one click (Google/Facebook) and their grocery lists follow them to any device.
**Current focus:** v3.0 shipped. Project complete.

## Current Position

Phase: All 11 complete ✓
Status: Milestone v3.0 complete — project finalized
Last activity: 2026-04-30 — v3.0 shipped: krepza.lt live, AdSense submitted, production hardened

Progress: [██████████] 100% (v3.0 milestone)

## Performance Metrics

**Velocity:**
- v3.0: 11 plans across 4 phases (done)
- v2.0: 6 plans across 3 phases (0.5 hours execution)
- v1.0: 11 plans across 4 phases (11.6 hours execution)
- Total plans completed: 28

**Recent Trend:**
- v2.0: 6 plans at stable velocity

*Updated after each plan completion*

## Accumulated Context

### Decisions

Recent decisions affecting current work (full log in PROJECT.md):

- Cloudflare Tunnel (cloudflared) as sole ingress — no nginx/Caddy, no exposed ports
- Tunnel token pattern via `TUNNEL_TOKEN` env var — no config file for single-service deployment
- `NEXTAUTH_URL` as single domain configuration point for OAuth callbacks
- AdSense CSP must include all four directive types (script-src, frame-src, connect-src, img-src)
- SQLite backup via `.backup` API — never raw `cp`

### Pending Todos

None yet.

### Blockers/Concerns

- **DNS propagation delay:** krepza.lt DNS changes may take 24-48 hours to propagate. Use `dig` to verify before proceeding past Phase 8.
- **AdSense site review:** Review can take days to weeks. Submit early (Phase 9) so review runs in parallel with Phase 10.
- **CSP silent failures:** CSP misconfiguration blocks ads with no visible error. Use DevTools Console during Phase 9 and audit fully in Phase 11.
- **TUNNEL_TOKEN security:** Token must never enter git. Verify `.env` is gitignored before any commit.

## Deferred Items

Items acknowledged and carried forward from previous milestones:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Observability | Prometheus/Grafana monitoring dashboards | v2 scope | v3.0 start |
| SEO | Sitemap generation | v2 scope | v3.0 start |
| Backup | Off-VPS backup storage (S3/rsync) | v2 scope | v3.0 start |
| Infra | Automated tunnel token rotation | v2 scope | v3.0 start |

## Session Continuity

Last session: 2026-04-30
Stopped at: v3.0 milestone complete
Resume file: None
