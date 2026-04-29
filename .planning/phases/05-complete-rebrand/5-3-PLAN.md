---
phase: 5
plan: 5-3
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/web/src/components/logo.tsx
  - packages/web/src/components/navigation.tsx
  - packages/web/public/
autonomous: true
requirements:
  - BRAND-06
  - BRAND-07
---

# Plan 5-3: Logo + Favicons

## Objective

Create an inline SVG React component from Krepza-Logo.svg, replace the 🛒 emoji in the desktop sidebar with the new logo, and serve favicon/icon files from the public directory.

## Tasks

### Task 1: Create Krepza Logo component

<type>execute</type>
<files>packages/web/src/components/logo.tsx</files>

<read_first>
assets/logo/Krepza-Logo.svg
packages/web/src/components/navigation.tsx (Sidebar component for context on where logo renders)
</read_first>

<action>
Create packages/web/src/components/logo.tsx — an inline SVG React component from Krepza-Logo.svg:

1. Read the SVG content from assets/logo/Krepza-Logo.svg
2. Create a React component that renders the SVG inline with configurable className and size props:

```tsx
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 24 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 ..."
      className={cn("inline-block", className)}
      // extract actual viewBox and SVG paths from Krepza-Logo.svg
    >
      {/* SVG paths from Krepza-Logo.svg */}
    </svg>
  );
}
```

3. Extract only the SVG paths/elements (not the wrapping <svg> attributes like xmlns) from Krepza-Logo.svg
4. Use the actual viewBox dimensions from the source SVG
5. Use `cn()` from `@/lib/utils` for className merging (consistent with existing component patterns)
6. Export as named export: `Logo`

Keep the SVG markup exactly as in the source file — preserve colors, paths, and structure.
</action>

<acceptance_criteria>
- packages/web/src/components/logo.tsx file exists
- grep 'export function Logo' packages/web/src/components/logo.tsx exits 0
- grep 'import { cn }' packages/web/src/components/logo.tsx exits 0
- grep 'viewBox' packages/web/src/components/logo.tsx exits 0
- File is valid TypeScript (no syntax errors — verified by build in verification step)
</acceptance_criteria>

### Task 2: Replace sidebar emoji with Logo component

<type>execute</type>
<files>packages/web/src/components/navigation.tsx</files>

<read_first>
packages/web/src/components/navigation.tsx
packages/web/src/components/logo.tsx
</read_first>

<action>
In packages/web/src/components/navigation.tsx:

1. Add import for Logo component:
   `import { Logo } from "./logo";`

2. In the Sidebar function (line 66), replace the emoji part of the branding line:
   Current: `<span className="text-xl font-bold text-primary">🛒 {t("common.appName")}</span>`
   Replace with:
   ```tsx
   <span className="text-xl font-bold text-primary">
     <Logo size={24} className="mr-2 -translate-y-0.5" />
     {t("common.appName")}
   </span>
   ```

3. Remove the 🛒 emoji character
4. Keep the same wrapper span and overall layout
5. The Logo component renders inline at 24px, slightly shifted up to align with text baseline
</action>

<acceptance_criteria>
- grep 'import { Logo }' packages/web/src/components/navigation.tsx exits 0
- grep '<Logo' packages/web/src/components/navigation.tsx exits 0
- grep '🛒' packages/web/src/components/navigation.tsx exits 1
- grep '{t("common.appName")}' packages/web/src/components/navigation.tsx exits 0
</acceptance_criteria>

### Task 3: Copy favicon and icon files to public/

<type>execute</type>
<files>packages/web/public/</files>

<read_first>
assets/logo/ (list all files)
packages/web/src/app/layout.tsx (metadata icons configuration)
</read_first>

<action>
Copy icon files from assets/logo/ to packages/web/public/:

```bash
cp assets/logo/favicon.ico packages/web/public/favicon.ico
cp assets/logo/icon.svg packages/web/public/icon.svg
cp assets/logo/icon.png packages/web/public/icon.png
cp assets/logo/icon.ico packages/web/public/icon.ico
```

Then update packages/web/src/app/layout.tsx to reference the icons in metadata:

Add to the metadata export:
```tsx
export const metadata: Metadata = {
  title: "Krepza - Price Checker",
  description: "Krepza — Lithuanian grocery price comparison and shopping list tool",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/icon.png" },
  },
};
```
</action>

<acceptance_criteria>
- test -f packages/web/public/favicon.ico exits 0
- test -f packages/web/public/icon.svg exits 0
- test -f packages/web/public/icon.png exits 0
- grep 'favicon.ico' packages/web/src/app/layout.tsx exits 0
- grep '"icon.svg"' packages/web/src/app/layout.tsx exits 0
</acceptance_criteria>

## Verification

Run:
```bash
cd packages/web && npm run build 2>&1
```

1. Build succeeds with no TypeScript or import errors
2. `test -f packages/web/public/favicon.ico` returns 0
3. Logo component imports resolve correctly
4. No remaining 🛒 emoji in sidebar branding (replaced by Logo component)

## Success Criteria

- [ ] Logo component renders inline SVG from Krepza-Logo.svg
- [ ] Sidebar shows Logo + app name, no 🛒 emoji
- [ ] Favicon and icon files served from public/ directory
- [ ] Build passes with all new imports resolving
