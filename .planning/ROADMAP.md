# Roadmap: Krepza v2.0

**Milestone:** v2.0 Krepza Rebrand + Ad Monetization
**Created:** 2026-04-29
**Phases:** 3
**Requirements:** 18 mapped / 18 total ✓

---

## Phase Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 5 | Complete Rebrand | App reads "Krepza" everywhere — no trace of "LT Grocery" | BRAND-01–07 (7) | 5 |
| 6 | AdSense Integration | Google AdSense renders on all pages with GDPR consent | ADS-01–08 (8) | 5 |
| 7 | Domain-Agnostic Deploy | One env change deploys Krepza on any domain | DEPLOY-01–03 (3) | 3 |

---

## Phase 5: Complete Rebrand

**Goal:** Replace every "LT Grocery" reference with "Krepza" — i18n, metadata, layout, static pages, favicons, logo.

**Requirements:** BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06, BRAND-07

**Success criteria:**
1. No string "LT Grocery" appears anywhere in the running app UI
2. Browser tab shows "Krepza - Price Checker" favicon
3. Desktop sidebar displays Krepza logo SVG instead of text/emoji
4. Privacy policy and data deletion pages reference "Krepza" not "LT Grocery"
5. Scraper identifies as "krepza/2.0" in User-Agent

**Dependencies:** None (standalone text/asset changes)

---

## Phase 6: AdSense Integration

**Goal:** Google AdSense ads render on all pages via the 5 existing ad component types, with GDPR-compliant consent and publisher-ID-driven conditional loading.

**Requirements:** ADS-01, ADS-02, ADS-03, ADS-04, ADS-05, ADS-06, ADS-07, ADS-08

**Success criteria:**
1. Ads render in AdBanner, AdLeaderboard, AdNativeCard, AdSideRail, AdSponsoredRow components
2. Setting `NEXT_PUBLIC_ADSENSE_ID` to a valid publisher ID causes real ads to load
3. Omitting `NEXT_PUBLIC_ADSENSE_ID` causes all ad slots to render nothing (no fallback)
4. GDPR consent banner appears before any ad script loads
5. Existing adblock detection and dismiss behavior preserved in AdSlot.tsx

**Dependencies:** Phase 5 (rebrand should be complete so ad slots show correct app context)

---

## Phase 7: Domain-Agnostic Deployment

**Goal:** App deploys on any domain by changing only env vars in docker-compose.yml — no hardcoded URLs remain.

**Requirements:** DEPLOY-01, DEPLOY-02, DEPLOY-03

**Success criteria:**
1. Changing `PUBLIC_URL` env var in docker-compose.yml changes all dynamic URL references
2. `docker compose up` builds and serves Krepza with all branding and ads
3. `.env.example` documents `PUBLIC_URL`, `NEXT_PUBLIC_ADSENSE_ID`, and any new vars

**Dependencies:** Phase 5 (branding), Phase 6 (AdSense env vars)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 5 | Pending |
| BRAND-02 | Phase 5 | Pending |
| BRAND-03 | Phase 5 | Pending |
| BRAND-04 | Phase 5 | Pending |
| BRAND-05 | Phase 5 | Pending |
| BRAND-06 | Phase 5 | Pending |
| BRAND-07 | Phase 5 | Pending |
| ADS-01 | Phase 6 | Pending |
| ADS-02 | Phase 6 | Pending |
| ADS-03 | Phase 6 | Pending |
| ADS-04 | Phase 6 | Pending |
| ADS-05 | Phase 6 | Pending |
| ADS-06 | Phase 6 | Pending |
| ADS-07 | Phase 6 | Pending |
| ADS-08 | Phase 6 | Pending |
| DEPLOY-01 | Phase 7 | Pending |
| DEPLOY-02 | Phase 7 | Pending |
| DEPLOY-03 | Phase 7 | Pending |

**Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Roadmap created: 2026-04-29*
