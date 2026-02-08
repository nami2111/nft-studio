# NeoBr-UI Migration Plan

## Overview

Full migration from custom shadcn-svelte components to @neobr/svelte with brutalist styling and Catppuccin color palette.

## Configuration

- Color Palette: NeoBr-UI Colors (Catppuccin-inspired OKLCH)
- Migration Strategy: Package Import with Local Wrappers
- Visual Style: Full Brutalist

## Migration Status: ✅ COMPLETE

### Phase 1: Dependencies & Configuration ✅

- [x] Install dependencies: `@neobr/svelte@1.0.7`, `@neobr/tailwind-preset@1.0.4`
- [x] Update src/app.css with NeoBr-UI design system (OKLCH colors, brutalist shadows)
- [x] Add `@source` directive to enable Tailwind v4 component scanning
- [x] Configure Tailwind v4 with brutalist tokens via `@neobr/tailwind-preset`

### Phase 2: Component Migration ✅

| Priority | Component    | Status  | Implementation                                             |
| -------- | ------------ | ------- | ---------------------------------------------------------- |
| High     | Button       | ✅ Done | Re-export from `@neobr/svelte`                             |
| High     | Card         | ✅ Done | Re-export Card, CardHeader, CardFooter, etc. from package  |
| High     | Input        | ✅ Done | Re-export from `@neobr/svelte`                             |
| High     | Textarea     | ✅ Done | Re-export from `@neobr/svelte`                             |
| High     | Badge        | ✅ Done | Re-export from `@neobr/svelte`                             |
| Medium   | Slider       | ✅ Done | Re-export from `@neobr/svelte`, updated RaritySlider usage |
| Medium   | Progress     | ✅ Done | Re-export from `@neobr/svelte`                             |
| Medium   | Skeleton     | ✅ Done | Re-export from `@neobr/svelte`                             |
| Medium   | Modal        | ✅ Done | Local wrapper with maxWidth support around NeoBr Modal     |
| Medium   | Toast/Sonner | ✅ Done | Re-export Toaster from svelte-sonner                       |

### Phase 3: Import Updates ✅

- [x] Updated all imports from direct `.svelte` files to index exports
- [x] Changed default imports to named imports (e.g., `{ Button }` instead of `Button`)

### Phase 4: Cleanup ✅

- [x] Removed old component `.svelte` files that are now re-exported from @neobr/svelte
- [x] Removed unused Dialog components (NeoBr-UI doesn't provide Dialog, but it wasn't being used)
- [x] Removed unused custom Toast component (using svelte-sonner instead)
- [x] Kept local wrapper for Modal with maxWidth prop support
- [x] Kept NFT-specific components (RulerRulesManager, TraitTypeToggle, NeedsReupload)

### Phase 5: Verification ✅

- [x] `pnpm check` - TypeScript validation passed (0 errors, 1 pre-existing warning)
- [x] `pnpm format` - Code formatted successfully

## Visual Changes Applied

- **Colors**: OKLCH-based Catppuccin palette via `@neobr/tailwind-preset`
  - Primary: Lavender
  - Secondary: Peach
  - Destructive: Pink
  - Success: Green
  - Warning: Yellow

- **Shadows**: Hard offset brutalist shadows
- **Borders**: Bold 2px borders
- **Radius**: Brutalist radius
- **Typography**: Bold uppercase headings with letter-spacing

## Dependencies

- `@neobr/svelte@1.0.7`: Core Svelte 5 components with brutalist styling
- `@neobr/tailwind-preset@1.0.4`: Brutal design system and OKLCH color tokens

## Files Modified

### Core Configuration

- `src/app.css` - NeoBr-UI design system import
- `package.json` - Updated dependencies

### Component Index Files (Re-exports)

- `src/lib/components/ui/button/index.ts`
- `src/lib/components/ui/card/index.ts`
- `src/lib/components/ui/input/index.ts`
- `src/lib/components/ui/textarea/index.ts`
- `src/lib/components/ui/badge/index.ts`
- `src/lib/components/ui/slider/index.ts`
- `src/lib/components/ui/progress/index.ts`
- `src/lib/components/ui/skeleton/index.ts`
- `src/lib/components/ui/modal/index.ts` (wrapper with maxWidth)
- `src/lib/components/ui/sonner/index.ts`

### Updated Import Statements

- `src/lib/components/gallery/*.svelte` - Updated to named imports
- `src/lib/components/shared/ModeSwitcher.svelte` - Updated to named imports
- `src/lib/components/layer/RaritySlider.svelte` - Updated Slider usage

## Migration Complete

The NeoBr-UI brutalist design system has been successfully integrated. All UI components now use @neobr/svelte either directly or through local wrapper components.

Run `pnpm dev` to see the brutalist design in action.

## Migration Corrections Applied (2026-02-08)

After reviewing the initial migration, the following critical corrections were made:

### Configuration Fixes

- **Added `@source` directive** to `src/app.css` to enable Tailwind v4 to scan NeoBr-UI components
  - Without this, Tailwind couldn't generate CSS classes from the component library
  - This is required for brutalist styling classes to work properly

### Component Cleanup

- **Removed unused Dialog components** (8 files)
  - NeoBr-UI doesn't provide Dialog components
  - The custom Dialog implementation wasn't being used anywhere in the codebase
- **Removed unused Toast component** (2 files)
  - The custom Toast implementation wasn't being used
  - Project uses `svelte-sonner` for toast notifications (as documented in Phase 2)

### Verification

- ✅ `pnpm check` - 0 errors, 1 pre-existing warning (as expected)
- ✅ `pnpm build` - Build completes successfully
- ✅ All NeoBr-UI components properly scanned and styled
