---
phase: 5
plan: 5-1
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/web/src/messages/en.json
  - packages/web/src/messages/lt.json
  - packages/web/src/app/layout.tsx
  - packages/web/src/components/client-providers.tsx
autonomous: true
requirements:
  - BRAND-01
  - BRAND-02
  - BRAND-03
---

# Plan 5-1: i18n + Metadata Rebrand

## Objective

Replace "LT Grocery" with "Krepza" in all i18n strings and layout metadata. Also convert the hardcoded mobile header to use the i18n `common.appName` key.

## Tasks

### Task 1: Update i18n JSON strings

<type>execute</type>
<files>packages/web/src/messages/en.json, packages/web/src/messages/lt.json</files>

<read_first>
packages/web/src/messages/en.json
packages/web/src/messages/lt.json
</read_first>

<action>
In en.json:
- Change `"common.appName"` from `"LT Grocery"` to `"Krepza"`
- Change `"auth.loginTitle"` from `"Welcome to LT Grocery"` to `"Welcome to Krepza"`

In lt.json:
- Change `"common.appName"` from `"LT Grocery"` to `"Krepza"`
- Change `"auth.loginTitle"` from `"Sveiki atvykę į LT Grocery"` to `"Sveiki atvykę į Krepza"`
</action>

<acceptance_criteria>
- grep '"common.appName": "Krepza"' packages/web/src/messages/en.json exits 0
- grep '"common.appName": "Krepza"' packages/web/src/messages/lt.json exits 0
- grep '"loginTitle": "Welcome to Krepza"' packages/web/src/messages/en.json exits 0
- grep '"loginTitle": "Sveiki atvykę į Krepza"' packages/web/src/messages/lt.json exits 0
- grep '"LT Grocery"' packages/web/src/messages/en.json exits 1
- grep '"LT Grocery"' packages/web/src/messages/lt.json exits 1
</acceptance_criteria>

### Task 2: Update layout metadata

<type>execute</type>
<files>packages/web/src/app/layout.tsx</files>

<read_first>
packages/web/src/app/layout.tsx
</read_first>

<action>
In packages/web/src/app/layout.tsx, update the Metadata export:
- Change `title` from `"LT Grocery - Price Checker"` to `"Krepza - Price Checker"`
- Change `description` from `"Lithuanian grocery price comparison and shopping list tool"` to `"Krepza — Lithuanian grocery price comparison and shopping list tool"`
</action>

<acceptance_criteria>
- grep 'title: "Krepza - Price Checker"' packages/web/src/app/layout.tsx exits 0
- grep 'LT Grocery' packages/web/src/app/layout.tsx exits 1
</acceptance_criteria>

### Task 3: Fix mobile header to use i18n

<type>execute</type>
<files>packages/web/src/components/client-providers.tsx</files>

<read_first>
packages/web/src/components/client-providers.tsx
packages/web/src/components/i18n-provider.tsx
packages/web/src/components/navigation.tsx (safeT pattern reference, lines 48-56)
</read_first>

<action>
In packages/web/src/components/client-providers.tsx, replace the hardcoded mobile header:

Current (line 22): `🛒 LT Grocery`
Replace with: `🛒 {t("common.appName")}` using the useI18n hook

Steps:
1. Import `useI18n` from `./i18n-provider` (add to existing imports)
2. Add `const { t } = useI18n();` inside the ClientProviders function body (after hooks)
3. Replace the hardcoded text with `{t("common.appName")}`

Keep the 🛒 emoji prefix. Keep the same Tailwind classes and wrapper div.
</action>

<acceptance_criteria>
- grep 'useI18n' packages/web/src/components/client-providers.tsx exits 0
- grep 'LT Grocery' packages/web/src/components/client-providers.tsx exits 1
- grep 't("common.appName")' packages/web/src/components/client-providers.tsx exits 0
- grep 'from "./i18n-provider"' packages/web/src/components/client-providers.tsx exits 0
</acceptance_criteria>

## Verification

Run:
```bash
cd packages/web && npm run build 2>&1 | tail -5
```

1. Build succeeds with no errors
2. `grep -r "LT Grocery" packages/web/src/messages/` returns no output
3. `grep -r "LT Grocery" packages/web/src/app/layout.tsx` returns no output
4. `grep -r "LT Grocery" packages/web/src/components/client-providers.tsx` returns no output

## Success Criteria

- [ ] No string "LT Grocery" appears in i18n files (en.json, lt.json)
- [ ] No string "LT Grocery" appears in layout.tsx metadata
- [ ] Client-providers mobile header uses i18n key (no hardcoded name)
- [ ] Build passes after changes
