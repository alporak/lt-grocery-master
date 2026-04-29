---
phase: 5
plan: 5-2
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/web/src/app/privacy/page.tsx
  - packages/web/src/app/data-deletion/page.tsx
  - packages/web/src/app/api/stores/fetch-locations/route.ts
autonomous: true
requirements:
  - BRAND-04
  - BRAND-05
---

# Plan 5-2: Static Pages + Scraper User-Agent

## Objective

Full rewrite of privacy policy and data deletion pages to reflect Krepza branding. Update the scraper HTTP User-Agent header from "lt-grocery-master/1.0" to "krepza/2.0".

## Tasks

### Task 1: Rewrite privacy policy page

<type>execute</type>
<files>packages/web/src/app/privacy/page.tsx</files>

<read_first>
packages/web/src/app/privacy/page.tsx
.planning/phases/05-complete-rebrand/05-CONTEXT.md (D-02: full rewrite decision)
</read_first>

<action>
Full rewrite of packages/web/src/app/privacy/page.tsx to reflect Krepza branding:

Replace all 3 instances of "LT Grocery" with "Krepza":
- Line 32: "provide the Krepza service" — update service description to mention Krepza
- Line 41: "stored on the server where Krepza is installed"
- Line 60: "Krepza is self-hosted. For privacy concerns, contact the server administrator."

Additionally review and modernize the copy:
- Update the "Last updated" date to April 2026 (current month)
- Ensure all references to the service use "Krepza" consistently
- Keep the same legal structure (sections 1-5: Data We Collect, How We Use, Storage, Rights, Contact)
- Keep the same component structure (session-aware, shows email when signed in)
</action>

<acceptance_criteria>
- grep 'Krepza' packages/web/src/app/privacy/page.tsx exits 0
- grep 'LT Grocery' packages/web/src/app/privacy/page.tsx exits 1
- grep 'Last updated: April 2026' packages/web/src/app/privacy/page.tsx exits 0
- grep 'Krepza service' packages/web/src/app/privacy/page.tsx exits 0
</acceptance_criteria>

### Task 2: Rewrite data deletion page

<type>execute</type>
<files>packages/web/src/app/data-deletion/page.tsx</files>

<read_first>
packages/web/src/app/data-deletion/page.tsx
.planning/phases/05-complete-rebrand/05-CONTEXT.md (D-02: full rewrite decision)
</read_first>

<action>
Full rewrite of packages/web/src/app/data-deletion/page.tsx to reflect Krepza branding:

Replace all 2 instances of "LT Grocery" with "Krepza":
- Line 19: "Krepza is a self-hosted application. All your data is stored exclusively on the server where the application is installed."
- Line 30: "The person who installed Krepza can manually remove your data."

Keep the same component structure:
- Page title, "How to Delete Your Data" section, "What Gets Deleted" section
- DeleteAccountButton import and conditional rendering
- Session-aware logic (shows button when signed in, sign-in link when not)
</action>

<acceptance_criteria>
- grep 'Krepza' packages/web/src/app/data-deletion/page.tsx exits 0
- grep 'LT Grocery' packages/web/src/app/data-deletion/page.tsx exits 1
- grep 'How to Delete Your Data' packages/web/src/app/data-deletion/page.tsx exits 0
- grep 'DeleteAccountButton' packages/web/src/app/data-deletion/page.tsx exits 0
</acceptance_criteria>

### Task 3: Update scraper User-Agent header

<type>execute</type>
<files>packages/web/src/app/api/stores/fetch-locations/route.ts</files>

<read_first>
packages/web/src/app/api/stores/fetch-locations/route.ts
.planning/phases/05-complete-rebrand/05-CONTEXT.md (D-03: scraper git identity stays as-is, only User-Agent changes)
</read_first>

<action>
In packages/web/src/app/api/stores/fetch-locations/route.ts, update the HTTP User-Agent header:
- Change from `"lt-grocery-master/1.0"` to `"krepza/2.0"`

Do NOT change anything in packages/scraper/src/scrape-job.ts (git bot identity stays as-is per D-03).
</action>

<acceptance_criteria>
- grep '"krepza/2.0"' packages/web/src/app/api/stores/fetch-locations/route.ts exits 0
- grep 'lt-grocery-master' packages/web/src/app/api/stores/fetch-locations/route.ts exits 1
</acceptance_criteria>

## Verification

Run:
```bash
grep -r "LT Grocery" packages/web/src/app/privacy/ packages/web/src/app/data-deletion/ packages/web/src/app/api/stores/fetch-locations/
```

1. No output from the grep above (no remaining "LT Grocery" references)
2. `grep "krepza/2.0" packages/web/src/app/api/stores/fetch-locations/route.ts` returns the updated User-Agent
3. Both page files have valid JSX syntax (build check from Plan 5-1 covers this)

## Success Criteria

- [ ] Privacy page references "Krepza" exclusively, no "LT Grocery"
- [ ] Data deletion page references "Krepza" exclusively, no "LT Grocery"
- [ ] Scraper User-Agent header reads "krepza/2.0"
- [ ] Scraper git bot identity in scrape-job.ts remains untouched
