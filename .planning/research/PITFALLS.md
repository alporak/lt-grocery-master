# Domain Pitfalls — Production Deployment (v3.0)

**Domain:** Self-hosted Docker app with Cloudflare Tunnel + AdSense
**Researched:** 2026-04-29
**Confidence:** HIGH

## Critical Pitfalls

Mistakes that cause deployment failure, silent breakage, or data loss.

### Pitfall 1: CSP Blocks AdSense Scripts (Silent Failure)

**What goes wrong:** Content-Security-Policy is deployed with restrictive `script-src` or `frame-src` that doesn't include AdSense domains. AdSense scripts and iframes are blocked by the browser. No visible error on the page — ads simply don't appear. Revenue is zero with no indication why.

**Why it happens:** Developer tests CSP locally without real AdSense tags. CSP is deployed to production. AdSense requests are blocked by browser CSP enforcement. The blocked resources appear in DevTools Console as CSP violations, but users don't see them.

**Consequences:** Zero ad revenue. Days or weeks before anyone notices. Site may be rejected from AdSense review if reviewer sees no ads loading.

**Prevention:**
1. Include ALL required AdSense origins in CSP: `script-src ... https://pagead2.googlesyndication.com`, `frame-src ... https://googleads.g.doubleclick.net https://tpc.googlesyndication.com`, `img-src ... https://pagead2.googlesyndication.com`, `connect-src ... https://pagead2.googlesyndication.com https://www.google.com`
2. Use `Content-Security-Policy-Report-Only` header first (in addition to enforcing CSP) to log violations without blocking.
3. After deployment, check browser DevTools → Console for CSP violation messages.
4. Test with real AdSense publisher ID (not a placeholder).

**Detection:** Open DevTools Console on production site. Look for red CSP violation messages mentioning `pagead2.googlesyndication.com` or `googleads.g.doubleclick.net`. Also check AdSense dashboard — if impressions are zero but the site has traffic, CSP is likely the culprit.

### Pitfall 2: X-Frame-Options: DENY Breaks AdSense Iframes

**What goes wrong:** `X-Frame-Options: DENY` is set as a security header. This blocks ALL framing of the page — including AdSense ad iframes that need to render within the page. Ads don't show.

**Why it happens:** `X-Frame-Options: DENY` is a common copy-paste security recommendation. It's correct for apps that should never be framed (banking, etc.), but wrong for pages that host ad iframes. The `DENY` value blocks framing in both directions.

**Consequences:** Same as Pitfall 1 — zero ad revenue, no obvious error.

**Prevention:** Use `X-Frame-Options: SAMEORIGIN` instead of `DENY`. Supplement with `frame-ancestors 'self'` in CSP (modern equivalent). This allows the page to host its own iframes while preventing external sites from framing your content. **Do not mix `X-Frame-Options: DENY` with AdSense — it is fundamentally incompatible.**

**Detection:** Check response headers with `curl -I https://krepza.lt`. If `X-Frame-Options: DENY` is present, ads will break.

### Pitfall 3: Tunnel Token Leaked in Public Repository

**What goes wrong:** `TUNNEL_TOKEN` is committed to git (in `.env`, `docker-compose.yml`, or documentation). Anyone with the token can create a tunnel connection to the Cloudflare account.

**Why it happens:** Developer adds `TUNNEL_TOKEN=...` to `.env` for convenience, forgets to add it to `.gitignore`, and commits. Or the token is hardcoded in docker-compose.yml for testing.

**Consequences:** Unauthorized tunnel connections to your Cloudflare account. Potential data exfiltration or service hijacking.

**Prevention:**
1. NEVER commit `TUNNEL_TOKEN` to git. Use `.env` (already in `.gitignore`) and reference via `${TUNNEL_TOKEN}` in docker-compose.yml.
2. Add `TUNNEL_TOKEN` to a `.env.example` with an empty/placeholder value and a warning comment.
3. Rotate the tunnel token if it's ever exposed (Cloudflare dashboard → Zero Trust → Networks → Tunnels → [tunnel] → Configure → Regenerate).

**Detection:** `git log -p | grep TUNNEL_TOKEN` — check git history for exposed tokens. Also scan: `rg TUNNEL_TOKEN --no-ignore` to find any hardcoded instances.

### Pitfall 4: SQLite Backup While Database Is Being Written (Without WAL)

**What goes wrong:** `cp grocery.db backup.db` is used to back up the database while the app is writing to it. The backup file is in an inconsistent state — partially written pages, corrupt data.

**Why it happens:** Developer thinks "SQLite is just a file, I can copy it." Without proper backup API, a copy made during a write is inconsistent.

**Consequences:** Backup is unusable. Restoration would result in a corrupt database. False sense of security.

**Prevention:**
1. Always use `sqlite3 grocery.db ".backup backup.db"` — this uses the SQLite Online Backup API, which takes a consistent snapshot even during concurrent writes.
2. Verify WAL mode is enabled: `PRAGMA journal_mode=WAL;` (already the case for this project per PROJECT.md).
3. Test restoration: periodically restore a backup to a test location and verify data integrity.

**Detection:** Run `PRAGMA integrity_check;` on the backup file after creation. A corrupt backup will fail this check.

### Pitfall 5: NEXTAUTH_URL Set to http:// (Not https://) in Production

**What goes wrong:** `NEXTAUTH_URL=http://krepza.lt` is used in production. OAuth providers (Google, Facebook) may reject the redirect because the callback URL doesn't match (OAuth configs use `https://`). Session cookies may not be set as `Secure` (browsers increasingly require `Secure` flag for cookies set over HTTPS).

**Why it happens:** Copy-paste from development config. Cloudflare provides SSL, so the app "works" over HTTPS, but NEXTAUTH_URL still says `http://`.

**Consequences:** OAuth login fails with "redirect_uri_mismatch" error. Users can't sign in. Session cookies may not persist.

**Prevention:** Set `NEXTAUTH_URL=https://krepza.lt` in production `.env`. Verify in the OAuth provider dashboards (Google Cloud Console, Facebook Developers) that the callback URL uses `https://`.

**Detection:** Visit `https://krepza.lt` and attempt Google/Facebook login. If it fails with redirect mismatch, NEXTAUTH_URL is wrong.

## Moderate Pitfalls

### Pitfall 6: cloudflared Container Not on Same Docker Network

**What goes wrong:** cloudflared container is launched but can't reach `http://web:3131` because it's not on the same Docker network. Tunnel connects to Cloudflare successfully but returns 502 Bad Gateway for all requests.

**Prevention:** All services in docker-compose.yml share the default network automatically. If using a custom network, ensure cloudflared is on it. Verify with `docker exec cloudflared curl http://web:3131/api/health`.

### Pitfall 7: AdSense Site Review Rejected for "Insufficient Content"

**What goes wrong:** AdSense reviews the site and rejects it because there's "not enough content" — the homepage looks empty when not logged in, or product listings are sparse.

**Prevention:** Ensure the site has meaningful, crawlable content visible without login. The homepage should show product listings, categories, or at minimum a clear value proposition. Google's crawler won't log in. If all content is behind auth, the site will be rejected.

**Detection:** Open an incognito browser window and visit `https://krepza.lt`. Can you see useful content? If the page is just a login wall, AdSense will reject it.

### Pitfall 8: Health Check Pollutes Database Logs

**What goes wrong:** The `/api/health` endpoint opens a database connection on every check (every 30 seconds). With SQLite's single-writer constraint, frequent health checks could theoretically contend with real writes — though in practice this is negligible.

**Prevention:** Keep the health check lightweight. Don't run expensive queries. A simple `SELECT 1` or just returning `{ status: 'ok' }` without a DB query is sufficient. The container being alive + responding is the primary health signal.

### Pitfall 9: Ads Not Showing Because NEXT_PUBLIC_ADSENSE_ID Is Empty

**What goes wrong:** `NEXT_PUBLIC_ADSENSE_ID` is not set (or set to empty string) in production `.env`. The app's existing conditional logic (`if (adsenseId)`) skips all ad rendering. Site deploys successfully but has no ads.

**Prevention:** Verify `NEXT_PUBLIC_ADSENSE_ID=pub-XXXXXXXXXXXXXXXX` is set in `.env` with the real publisher ID. Check that the app logs or renders ad containers in production.

## Minor Pitfalls

### Pitfall 10: DNS Propagation Delay After Cloudflare Setup

**What goes wrong:** After pointing krepza.lt nameservers to Cloudflare, the site is inaccessible for 24-48 hours while DNS propagates. Developer thinks something is broken.

**Prevention:** DNS changes take time. Check propagation with `dig krepza.lt NS` or a tool like whatsmydns.net. Wait. It's not broken.

### Pitfall 11: robots.txt Blocks Ads.txt Crawler

**What goes wrong:** A restrictive `robots.txt` accidentally blocks Google's ads.txt crawler from accessing `/ads.txt`.

**Prevention:** The `ads.txt` path should always be crawlable. Don't add it to `Disallow` in robots.txt. Google's AdSense crawler uses the same user-agent as the search crawler (`Googlebot`), so a `Disallow: /` would block both.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Cloudflare Tunnel Setup | Tunnel connects but returns 502 (container unreachable) | Test with `docker exec cloudflared curl http://web:3131` before exposing publicly |
| AdSense ads.txt | File served with wrong Content-Type or not at exact root path | Verify: `curl -I https://krepza.lt/ads.txt` returns `Content-Type: text/plain` and 200 |
| CSP Configuration | Forgetting `'unsafe-inline'` for Next.js inline scripts (required by Next.js) | Test the app fully after deploying CSP — check for blocked inline scripts in DevTools |
| Health Checks | Missing curl in Docker image (alpine base) | Verify: `docker exec web which curl` — alpine needs `apk add curl` if not present |
| DB Backups | Backup script writes to ephemeral container storage (lost on restart) | Mount a `/backups` volume or use host path. Don't backup to `/tmp` inside container. |
| OAuth in Production | Google/Facebook OAuth configs still point to localhost callbacks | Update redirect URIs in Google Cloud Console and Facebook Developers dashboard to `https://krepza.lt/api/auth/callback/google` and `https://krepza.lt/api/auth/callback/facebook` |

## Sources

- Google AdSense CSP requirements: https://developers.google.com/tag-platform/security/guides/csp — HIGH
- Google AdSense ads.txt guide: https://support.google.com/adsense/answer/12171612 — HIGH
- SQLite backup integrity: https://www.sqlite.org/backup.html — HIGH
- Next.js security headers: https://nextjs.org/docs/app/guides/content-security-policy — HIGH (Context7)
- Cloudflare Tunnel troubleshooting: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/ — HIGH
- Docker HEALTHCHECK: https://docs.docker.com/reference/dockerfile/#healthcheck — HIGH
- next-auth OAuth callback URLs: https://next-auth.js.org/configuration/providers/oauth — MEDIUM
