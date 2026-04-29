# Phase 7: Domain-Agnostic Deployment - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

## Phase Boundary

Make the app deployable on any domain by changing only env vars in docker-compose.yml. No hardcoded URLs remain in the codebase. Add `NEXT_PUBLIC_ADSENSE_ID` and `PUBLIC_URL` to all deployment configs.

## Implementation Decisions

### PUBLIC_URL vs NEXTAUTH_URL
- **D-01:** NEXTAUTH_URL already serves as the canonical domain config for the app (controls OAuth redirects). PUBLIC_URL is an alias/synonym for clarity. Both documented in .env.example.

### Docker Compose env vars
- **D-02:** Add NEXT_PUBLIC_ADSENSE_ID to web service environment in docker-compose.yml so AdSense works in production.

### the agent's Discretion
- Whether to alias PUBLIC_URL to NEXTAUTH_URL or add a separate variable
- Simplest approach: document that NEXTAUTH_URL is the domain config, no code changes needed

## Canonical References

### Phase Requirements
- `.planning/ROADMAP.md` — Phase 7 goal, DEPLOY-01–03, 3 success criteria
- `.planning/REQUIREMENTS.md` — Full requirements list

### Project Context
- `.planning/PROJECT.md` — Tech stack, Docker Compose multi-service

## Existing Code Insights

### Reusable Assets
- `docker-compose.yml` — 3 services (web, scraper, embedder) with env var substitution
- `.env.example` — Template for all env vars
- `NEXTAUTH_URL` already controls domain — used by NextAuth for OAuth redirects

### Integration Points
- `docker-compose.yml` line 8-18 — web service environment block (needs NEXT_PUBLIC_ADSENSE_ID)
- `.env.example` — document all vars needed for deployment
- No hardcoded URLs found in code (layout.tsx, api routes, etc. all use NEXTAUTH_URL or relative paths)

## Specific Ideas

- The app is already domain-agnostic via NEXTAUTH_URL — no code changes needed for DEPLOY-01
- Only docker-compose.yml needs the NEXT_PUBLIC_ADSENSE_ID variable
- .env.example already documents most vars — add PUBLIC_URL documentation

## Deferred Ideas

None.

---

*Phase: 7-Domain-Agnostic Deployment*
*Context gathered: 2026-04-29*
