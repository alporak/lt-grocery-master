---
phase: 6
plan: 6-1
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/web/src/app/layout.tsx
  - packages/web/src/components/consent-banner.tsx
  - packages/web/src/components/client-providers.tsx
  - packages/web/src/messages/en.json
  - packages/web/src/messages/lt.json
  - .env.example
autonomous: true
requirements:
  - ADS-06
  - ADS-07
  - ADS-08
---

# Plan 6-1: AdSense Script + GDPR Consent + Env Var

## Objective

Set up Google AdSense script loading with conditional activation via `NEXT_PUBLIC_ADSENSE_ID` env var. Build a lightweight GDPR consent banner. Update .env.example and i18n strings.

## Tasks

### Task 1: Add NEXT_PUBLIC_ADSENSE_ID to .env.example

<type>execute</type>
<files>.env.example</files>

<read_first>
.env.example
</read_first>

<action>
Add to .env.example (after the existing env vars):

```env
# Google AdSense publisher ID (format: pub-XXXXXXXXXXXXXXXX)
# Leave empty to disable all ads
NEXT_PUBLIC_ADSENSE_ID=
```

Backfill with explanatory comment about where to find the publisher ID.
</action>

<acceptance_criteria>
- grep 'NEXT_PUBLIC_ADSENSE_ID' .env.example exits 0
- grep 'pub-XXXXXXXXXXXXXXXX' .env.example exits 0
</acceptance_criteria>

### Task 2: Create ConsentBanner component

<type>execute</type>
<files>packages/web/src/components/consent-banner.tsx</files>

<read_first>
packages/web/src/components/ads/AdSlot.tsx (dismiss pattern, i18n pattern)
packages/web/src/components/client-providers.tsx (provider wrapping pattern)
packages/web/src/app/globals.css (existing Tailwind classes)
</read_first>

<action>
Create `packages/web/src/components/consent-banner.tsx` — a "use client" component:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useI18n } from "./i18n-provider";

export function useConsent(): boolean {
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("krepza_ad_consent");
    setConsent(stored === "1");
  }, []);
  return consent;
}

export function ConsentBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("krepza_ad_consent");
    if (stored === null) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("krepza_ad_consent", "1");
    setVisible(false);
    window.location.reload();
  };

  const dismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-card p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-lg">
      <p className="text-sm text-muted-foreground flex-1">
        {t("ads.consentText")}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={accept}
          className="text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors"
        >
          {t("ads.consentAccept")}
        </button>
      </div>
    </div>
  );
}
```

Key design decisions:
1. Fixed bottom bar, mobile-friendly (matches bottom nav pattern)
2. `localStorage` for consent persistence (key: `krepza_ad_consent`)
3. `useConsent()` hook for other components to check consent status
4. Accept triggers page reload to activate AdSense script
5. Dismiss hides the banner but doesn't enable ads
</action>

<acceptance_criteria>
- packages/web/src/components/consent-banner.tsx file exists
- grep 'export function ConsentBanner' packages/web/src/components/consent-banner.tsx exits 0
- grep 'export function useConsent' packages/web/src/components/consent-banner.tsx exits 0
- grep 'krepza_ad_consent' packages/web/src/components/consent-banner.tsx exits 0
- grep 'fixed bottom-0' packages/web/src/components/consent-banner.tsx exits 0
</acceptance_criteria>

### Task 3: Add ConsentBanner to client-providers layout

<type>execute</type>
<files>packages/web/src/components/client-providers.tsx</files>

<read_first>
packages/web/src/components/client-providers.tsx
packages/web/src/components/consent-banner.tsx
</read_first>

<action>
In packages/web/src/components/client-providers.tsx:
1. Import ConsentBanner: `import { ConsentBanner } from "./consent-banner";`
2. Render `<ConsentBanner />` inside the `<I18nProvider>` wrapper, after the main layout div closes but before the closing `</I18nProvider>` tag. Place it at the end of the provider tree (before `</I18nProvider>`).

The consent banner renders at the root layout level so it appears on all pages.
</action>

<acceptance_criteria>
- grep 'import { ConsentBanner }' packages/web/src/components/client-providers.tsx exits 0
- grep '<ConsentBanner />' packages/web/src/components/client-providers.tsx exits 0
</acceptance_criteria>

### Task 4: Add AdSense script loading to layout

<type>execute</type>
<files>packages/web/src/app/layout.tsx</files>

<read_first>
packages/web/src/app/layout.tsx
</read_first>

<action>
In packages/web/src/app/layout.tsx, add next/script import and a Script component that conditionally loads Google AdSense:

1. Add import: `import Script from "next/script";`

2. Inside the `<body>` tag, BEFORE `<ClientProviders>`, add:

```tsx
{process.env.NEXT_PUBLIC_ADSENSE_ID && (
  <Script
    src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${process.env.NEXT_PUBLIC_ADSENSE_ID}`}
    strategy="afterInteractive"
    crossOrigin="anonymous"
  />
)}
```

Key points:
- Only loads when `NEXT_PUBLIC_ADSENSE_ID` env var is set
- `ca-` prefix is standard for AdSense publisher IDs
- `afterInteractive` strategy — loads after page becomes interactive
- `crossOrigin="anonymous"` per AdSense docs
- Runs server-side check on the env var and client-side script injection via next/script
</action>

<acceptance_criteria>
- grep 'import Script' packages/web/src/app/layout.tsx exits 0
- grep 'NEXT_PUBLIC_ADSENSE_ID' packages/web/src/app/layout.tsx exits 0
- grep 'pagead2.googlesyndication.com' packages/web/src/app/layout.tsx exits 0
- grep 'afterInteractive' packages/web/src/app/layout.tsx exits 0
</acceptance_criteria>

### Task 5: Update i18n with consent + ad strings

<type>execute</type>
<files>packages/web/src/messages/en.json, packages/web/src/messages/lt.json</files>

<read_first>
packages/web/src/messages/en.json (lines 71-75 for existing ads.* keys)
packages/web/src/messages/lt.json (ads.* section)
</read_first>

<action>
In en.json, add to `ads` section:
```json
"consentText": "This site uses ads to stay free. By accepting, you allow personalized ads.",
"consentAccept": "Accept",
"adblockNotice": "Ads help keep this site free. Consider disabling your adblocker."
```

In lt.json, add Lithuanian translations:
```json
"consentText": "Ši svetainė naudoja reklamas, kad liktų nemokama. Sutikdami leidžiate personalizuotas reklamas.",
"consentAccept": "Sutinku",
"adblockNotice": "Reklamos padeda išlaikyti šią svetainę nemokamą. Apsvarstykite galimybę išjungti reklamų blokatorių."
```

Also remove or replace the existing cringey begging strings:
- `"pleaseWhitelist"`: Keep or replace with neutral `adblockNotice` equivalent
- `"pleaseWhitelistDesperate"`: Replace with neutral `adblockNotice` equivalent
</action>

<acceptance_criteria>
- grep '"consentText"' packages/web/src/messages/en.json exits 0
- grep '"consentAccept"' packages/web/src/messages/en.json exits 0
- grep '"adblockNotice"' packages/web/src/messages/en.json exits 0
- grep '"consentText"' packages/web/src/messages/lt.json exits 0
- grep '"adblockNotice"' packages/web/src/messages/lt.json exits 0
</acceptance_criteria>

## Verification

Run:
```bash
cd packages/web && npm run build 2>&1 | tail -5
```

1. Build succeeds with no TypeScript errors
2. `NEXT_PUBLIC_ADSENSE_ID` documented in .env.example
3. ConsentBanner component renders via client-providers
4. AdSense script loads conditionally in layout.tsx

## Success Criteria

- [ ] NEXT_PUBLIC_ADSENSE_ID env var configures AdSense publisher ID
- [ ] No AdSense script loads when publisher ID is missing
- [ ] GDPR consent banner appears before ads load
- [ ] Consent persisted in localStorage
- [ ] i18n consent and ad strings in both languages
