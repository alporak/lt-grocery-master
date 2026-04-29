# Phase 6: AdSense Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-29
**Phase:** 06-adsense-integration
**Areas discussed:** AdSense loading strategy, GDPR consent, adblock handling, i18n copy

---

## AdSense Script Loading

| Option | Description | Selected |
|--------|-------------|----------|
| next/script afterInteractive | Load AdSense via Next.js Script component, after page becomes interactive | ✓ |
| Manual DOM injection | Inject script tag via useEffect | |

**User's choice:** Auto-selected (yolo mode + auto_advance)
**Notes:** Conditional on NEXT_PUBLIC_ADSENSE_ID being set. Uses `ca-` prefix per AdSense docs.

---

## GDPR Consent

| Option | Description | Selected |
|--------|-------------|----------|
| Custom lightweight banner | Fixed bottom bar with accept/dismiss, localStorage persistence | ✓ |
| Third-party library | @techdiary-dev/react-cookie-consent or similar | |

**User's choice:** Auto-selected (yolo mode + auto_advance)
**Notes:** No external dependency — custom component keeps bundle size minimal. Accept triggers reload to activate AdSense.

---

## Adblock Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral notice | Show "Ads help keep Krepza free" instead of desperate begging | ✓ |
| No message | Just render null when adblock detected | |

**User's choice:** Auto-selected (yolo mode + auto_advance)
**Notes:** Preserve existing useAdblockDetect() and useDismiss() hooks. Replace cringey i18n strings with neutral copy.

---

## the agent's Discretion

- Consent banner exact UI: fixed bottom bar matching mobile nav pattern
- No external consent library dependency
- All plans in wave 1 (independent file changes)

## Deferred Ideas

None.
