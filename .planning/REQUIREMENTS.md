# Requirements: Krepza

**Defined:** 2026-04-29
**Core Value:** User logs in with one click and their grocery lists follow them to any device.

## v2.0 Requirements

Requirements for v2.0 Krepza Rebrand + Ad Monetization.

### Branding

- [ ] **BRAND-01**: User sees "Krepza" as the app name in all i18n strings (en.json, lt.json)
- [ ] **BRAND-02**: Browser tab/title shows "Krepza - Price Checker" in layout metadata
- [ ] **BRAND-03**: Mobile header displays "Krepza" branding (replace hardcoded "LT Grocery")
- [ ] **BRAND-04**: Privacy policy and data deletion pages reflect Krepza branding
- [ ] **BRAND-05**: Scraper User-Agent header updated to "krepza/2.0"
- [ ] **BRAND-06**: Favicon and app icons served from assets/logo/ (favicon.ico, icon.png, icon.svg)
- [ ] **BRAND-07**: Krepza logo SVG displayed in desktop sidebar branding area

### AdSense Integration

- [ ] **ADS-01**: Google AdSense integrated in AdBanner component
- [ ] **ADS-02**: Google AdSense integrated in AdLeaderboard component
- [ ] **ADS-03**: Google AdSense integrated in AdNativeCard component
- [ ] **ADS-04**: Google AdSense integrated in AdSideRail component
- [ ] **ADS-05**: Google AdSense integrated in AdSponsoredRow component
- [ ] **ADS-06**: AdSense publisher ID configurable via NEXT_PUBLIC_ADSENSE_ID env var
- [ ] **ADS-07**: Ads only render when publisher ID is configured (no hardcoded fallback)
- [ ] **ADS-08**: GDPR-compliant consent banner shown before ads load

### Domain-Agnostic Deployment

- [ ] **DEPLOY-01**: PUBLIC_URL env var drives all dynamic URL references (no hardcoded domain)
- [ ] **DEPLOY-02**: Docker Compose updated with new env vars (PUBLIC_URL, NEXT_PUBLIC_ADSENSE_ID)
- [ ] **DEPLOY-03**: App deploys on new domain by changing only env vars in docker-compose.yml

## Out of Scope

| Feature | Reason |
|---------|--------|
| AdSense Auto Ads (auto-inserted page ads) | Manual slot placement gives more control over UX |
| Multiple ad networks (media.net, etc.) | AdSense covers 90%+ of market |
| Ad performance dashboard | Analytics deferred; focus on integration first |
| PWA manifest / service worker | Not needed for v2.0; web-first deployment |

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
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 after roadmap creation*
