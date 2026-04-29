---
phase: 6
plan: 6-2
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/web/src/components/ads/AdSlot.tsx
  - packages/web/src/messages/en.json
  - packages/web/src/messages/lt.json
autonomous: true
requirements:
  - ADS-01
  - ADS-02
  - ADS-03
  - ADS-04
  - ADS-05
---

# Plan 6-2: Wire All 5 Ad Components to AdSense

## Objective

Replace the placeholder "beg for whitelist" content in all 5 ad components with real Google AdSense `<ins>` elements. Components render nothing when `NEXT_PUBLIC_ADSENSE_ID` is missing. Adblock detection shows a neutral notice instead of desperate begging.

## Tasks

### Task 1: Refactor AdSlot.tsx — AdSense shell

<type>execute</type>
<files>packages/web/src/components/ads/AdSlot.tsx</files>

<read_first>
packages/web/src/components/ads/AdSlot.tsx
packages/web/src/components/consent-banner.tsx (useConsent hook interface)
packages/web/src/components/i18n-provider.tsx
</read_first>

<action>
Refactor `packages/web/src/components/ads/AdSlot.tsx`:

**A. Add publisher ID check at module level:**
Import and read the env var:
```tsx
const PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_ID;
```

**B. Replace BegCopy with AdUnit component:**
Create a new internal component that renders either:
- A real AdSense `<ins>` element (when publisher ID is set and adblock not detected)
- A neutral notice (when adblock is detected and publisher ID is set)
- Nothing (returns null — parent component handles this)

```tsx
function AdUnit({
  slot,
  format,
  style,
  blocked,
}: {
  slot: string;
  format?: string;
  style?: React.CSSProperties;
  blocked: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (blocked || !PUBLISHER_ID) return;
    try {
      // @ts-expect-error - AdSense global
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [blocked]);

  if (!PUBLISHER_ID) return null;

  if (blocked) {
    return (
      <p className="text-xs text-muted-foreground leading-snug">
        {t("ads.adblockNotice")}
      </p>
    );
  }

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: "block", ...style }}
      data-ad-client={`ca-${PUBLISHER_ID}`}
      data-ad-slot={slot}
      data-ad-format={format || "auto"}
      data-full-width-responsive="true"
    />
  );
}
```

Key points:
- `window.adsbygoogle.push({})` triggers AdSense to process the new `<ins>` element
- `data-ad-client` uses `ca-` prefix + publisher ID
- `data-ad-slot` is a unique identifier per ad unit (use slotId prop)
- `data-ad-format="auto"` for responsive ads
- `data-full-width-responsive="true"` for mobile-friendly rendering
</action>

<acceptance_criteria>
- grep 'NEXT_PUBLIC_ADSENSE_ID' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'adsbygoogle' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'data-ad-client' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'data-ad-slot' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'export function AdUnit\|function AdUnit' packages/web/src/components/ads/AdSlot.tsx exits 0
</acceptance_criteria>

### Task 2: Update all 5 ad components

<type>execute</type>
<files>packages/web/src/components/ads/AdSlot.tsx</files>

<read_first>
packages/web/src/components/ads/AdSlot.tsx (after Task 1 changes)
</read_first>

<action>
Update all 5 exported components to use the new AdUnit instead of BegCopy/HatchImg:

**AdBanner** (line 94):
- Replace the BegCopy content area with `<AdUnit slot={slotId} blocked={blocked} />`
- Remove HatchImg (no longer needed as placeholder)
- Keep dismiss button and AdLabel
- Keep wrapper div with existing Tailwind classes

**AdLeaderboard** (line 115):
- Replace BegCopy content area with `<AdUnit slot={slotId} blocked={blocked} style={{ minHeight: 60 }} />`
- Remove HatchImg
- Keep dismiss and AdLabel

**AdNativeCard** (line 130):
- Replace the entire card interior with `<AdUnit slot={slotId} format="rectangle" blocked={blocked} style={{ minHeight: 250 }} />`
- Remove HatchImg and BegCopy
- Keep dismiss and AdLabel, wrapper div

**AdSideRail** (line 145):
- Replace content with `<AdUnit slot={slotId} format="vertical" blocked={blocked} style={{ minHeight: 600 }} />`
- Keep dismiss and AdLabel

**AdSponsoredRow** (line 158):
- Replace content with `<AdUnit slot={slotId} blocked={blocked} />`
- Remove HatchImg
- Keep dismiss and AdLabel

Each component should still:
- Check `dismissed` state and return null if dismissed
- Apply existing Tailwind wrapper classes for layout
- Include AdLabel and DismissBtn
</action>

<acceptance_criteria>
- grep 'AdUnit' packages/web/src/components/ads/AdSlot.tsx exits 0 (at least 5 occurrences, one per component)
- grep 'BegCopy' packages/web/src/components/ads/AdSlot.tsx exits 1 (only the function definition and AdUnit internal use — or exits 0 if BegCopy is removed)
- grep 'HatchImg' packages/web/src/components/ads/AdSlot.tsx exits 0 OR exits 1 (definition only if kept for reference)
- grep 'export function AdBanner' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'export function AdLeaderboard' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'export function AdNativeCard' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'export function AdSideRail' packages/web/src/components/ads/AdSlot.tsx exits 0
- grep 'export function AdSponsoredRow' packages/web/src/components/ads/AdSlot.tsx exits 0
</acceptance_criteria>

### Task 3: Update i18n ad strings (neutral tone)

<type>execute</type>
<files>packages/web/src/messages/en.json, packages/web/src/messages/lt.json</files>

<read_first>
packages/web/src/messages/en.json (ads section, lines 71-75)
packages/web/src/messages/lt.json (ads section)
</read_first>

<action>
Replace the desperate begging copy with neutral text in both languages:

In en.json, the `ads` section should become:
```json
"ads": {
  "label": "AD · sponsored",
  "pleaseWhitelist": "Ads help keep Krepza free. Consider disabling your adblocker.",
  "pleaseWhitelistDesperate": "Ads help keep Krepza free. Consider disabling your adblocker.",
  "consentText": "This site uses ads to stay free. By accepting, you allow personalized ads.",
  "consentAccept": "Accept",
  "adblockNotice": "Ads help keep Krepza free. Consider disabling your adblocker."
}
```

In lt.json:
```json
"ads": {
  "label": "REKLAMA",
  "pleaseWhitelist": "Reklamos padeda išlaikyti Krepza nemokamą. Apsvarstykite galimybę išjungti reklamų blokatorių.",
  "pleaseWhitelistDesperate": "Reklamos padeda išlaikyti Krepza nemokamą. Apsvarstykite galimybę išjungti reklamų blokatorių.",
  "consentText": "Ši svetainė naudoja reklamas, kad liktų nemokama. Sutikdami leidžiate personalizuotas reklamas.",
  "consentAccept": "Sutinku",
  "adblockNotice": "Reklamos padeda išlaikyti Krepza nemokamą. Apsvarstykite galimybę išjungti reklamų blokatorių."
}
```

Note: Keep `pleaseWhitelist` and `pleaseWhitelistDesperate` keys for backward compatibility, but replace their values with the neutral message. The `adblockNotice` key is used by the new AdUnit component. The existing AdSlot.tsx uses `pleaseWhitelist`/`pleaseWhitelistDesperate` — the BegCopy function may still reference these keys; update accordingly.
</action>

<acceptance_criteria>
- grep 'pleaseWhitelist' packages/web/src/messages/en.json exits 0
- grep 'Krepza' packages/web/src/messages/en.json exits 0 (ads section references Krepza)
- grep 'adblockNotice' packages/web/src/messages/en.json exits 0
- grep 'consentText' packages/web/src/messages/lt.json exits 0
</acceptance_criteria>

## Verification

Run:
```bash
cd packages/web && npm run build 2>&1 | tail -5
grep -c 'AdUnit' packages/web/src/components/ads/AdSlot.tsx
```

1. Build succeeds with no TypeScript errors
2. AdUnit appears at least 5 times in AdSlot.tsx (one per component)
3. BegCopy and HatchImg are defined but no longer used as primary ad content
4. i18n strings reference Krepza, not generic "this site"

## Success Criteria

- [ ] All 5 ad components render AdSense `<ins>` elements when publisher ID is set
- [ ] All components return null when publisher ID is missing
- [ ] Adblock detection shows neutral notice (not desperate begging)
- [ ] Dismiss behavior preserved (sessionStorage)
- [ ] AdLabel and dismiss button remain functional
