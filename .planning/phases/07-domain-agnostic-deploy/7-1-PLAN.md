---
phase: 7
plan: 7-1
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.yml
  - .env.example
autonomous: true
requirements:
  - DEPLOY-01
  - DEPLOY-02
  - DEPLOY-03
---

# Plan 7-1: Domain-Agnostic Deployment Config

## Objective

Add NEXT_PUBLIC_ADSENSE_ID to docker-compose.yml web service. Document PUBLIC_URL as the domain env var in .env.example. Verify no hardcoded URLs remain in the codebase. Ensure `docker compose up` deploys a fully branded Krepza with ads on any domain by changing only env vars.

## Tasks

### Task 1: Add NEXT_PUBLIC_ADSENSE_ID to docker-compose.yml

<type>execute</type>
<files>docker-compose.yml</files>

<read_first>
docker-compose.yml
</read_first>

<action>
In docker-compose.yml, add `NEXT_PUBLIC_ADSENSE_ID=${NEXT_PUBLIC_ADSENSE_ID:-}` to the web service environment block (after NEXTAUTH_URL line):

```yaml
- NEXTAUTH_URL=${NEXTAUTH_URL}
- NEXT_PUBLIC_ADSENSE_ID=${NEXT_PUBLIC_ADSENSE_ID:-}
```

This passes the AdSense publisher ID to the web service at build/runtime. The `:-` default ensures it's empty (ads disabled) when not set.
</action>

<acceptance_criteria>
- grep 'NEXT_PUBLIC_ADSENSE_ID' docker-compose.yml exits 0
</acceptance_criteria>

### Task 2: Document PUBLIC_URL in .env.example

<type>execute</type>
<files>.env.example</files>

<read_first>
.env.example
</read_first>

<action>
In .env.example, update the NEXTAUTH_URL comment to also mention PUBLIC_URL as the canonical domain variable:

Current:
```
# Public URL of this instance — the ONLY variable to change per deployment
NEXTAUTH_URL=http://localhost:3131
```

Change to:
```
# Public URL of this instance — the ONLY variable to change per deployment
# Sets the domain for OAuth redirects, session cookies, and all URL references
# Also available as PUBLIC_URL (same value — just copy to PUBLIC_URL if needed)
NEXTAUTH_URL=http://localhost:3131
PUBLIC_URL=${NEXTAUTH_URL}
```

Also add a deployment quick-start comment at the top of the file:
```
# Krepza deployment — copy to .env and fill in values
# Minimum required: NEXTAUTH_URL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# For ads: also set NEXT_PUBLIC_ADSENSE_ID
```
</action>

<acceptance_criteria>
- grep 'PUBLIC_URL' .env.example exits 0
- grep 'Krepza deployment' .env.example exits 0
- grep 'NEXT_PUBLIC_ADSENSE_ID' .env.example exits 0 (already present from Phase 6)
</acceptance_criteria>

### Task 3: Verify no hardcoded URLs in codebase

<type>execute</type>
<files>packages/web/src/</files>

<read_first>
.planning/ROADMAP.md (Phase 7 success criteria)
</read_first>

<action>
Run a scan for hardcoded URLs that would break on a new domain:

```bash
grep -rn "localhost:3131\|http://localhost" packages/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".env"
```

Expected: no output (NEXTAUTH_URL handles all dynamic URL needs — NextAuth uses it internally, not from hardcoded references).

If any hardcoded URLs are found, replace them with `process.env.NEXTAUTH_URL` references.
</action>

<acceptance_criteria>
- Hardcoded localhost URLs in source code: 0 found
- All URL references use NEXTAUTH_URL env var or relative paths
</acceptance_criteria>

## Verification

Run:
```bash
# Verify docker-compose config
grep -c 'NEXT_PUBLIC_ADSENSE_ID' docker-compose.yml
# Should return 1

# Verify .env.example
grep -c 'PUBLIC_URL' .env.example
# Should return >= 1

# Verify no hardcoded URLs
grep -rn "localhost:3131" packages/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules || echo "CLEAN"
```

## Success Criteria

- [ ] docker-compose.yml includes NEXT_PUBLIC_ADSENSE_ID env var
- [ ] .env.example documents PUBLIC_URL and deployment instructions
- [ ] No hardcoded domain URLs in source code
- [ ] `docker compose up` deploys Krepza with branding + ads on any domain by changing env vars
