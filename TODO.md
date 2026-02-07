# NeoBr-UI Migration Plan

## Overview

Full migration from custom shadcn-svelte components to @neobr/svelte with brutalist styling and Catppuccin color palette.

## Configuration

- Color Palette: Adopt NeoBr-UI Colors (Catppuccin)
- Migration Strategy: Full Replacement
- Visual Style: Full Brutalist

## Migration Tasks

### Phase 1: Dependencies & Configuration

- [ ] Install dependencies: `pnpm add @neobr/svelte @neobr/tailwind-preset`
- [ ] Update src/app.css with NeoBr-UI design system (OKLCH colors, brutalist shadows)
- [ ] Configure Tailwind v4 with brutalist tokens
- [ ] Update vite.config.ts if needed for new source paths

### Phase 2: Component Migration

| Priority | Component    | Action  | NeoBr-UI Import                                                   |
| -------- | ------------ | ------- | ----------------------------------------------------------------- |
| High     | Button       | Replace | `import { Button } from '@neobr/svelte'`                          |
| High     | Card         | Replace | `import { Card, CardHeader, CardTitle, CardContent, CardFooter }` |
| High     | Input        | Replace | `import { Input } from '@neobr/svelte'`                           |
| High     | Textarea     | Replace | `import { Textarea } from '@neobr/svelte'`                        |
| High     | Badge        | Replace | `import { Badge } from '@neobr/svelte'`                           |
| Medium   | Slider       | Replace | `import { Slider } from '@neobr/svelte'`                          |
| Medium   | Progress     | Replace | `import { Progress } from '@neobr/svelte'`                        |
| Medium   | Skeleton     | Replace | `import { Skeleton } from '@neobr/svelte'`                        |
| Medium   | Modal/Dialog | Replace | `import { Modal } from '@neobr/svelte'`                           |
| Medium   | Toast        | Replace | `import { Toast } from '@neobr/svelte'`                           |

### Phase 3: Update Imports Throughout Codebase

- [ ] Update all imports from `$components/ui/*` to `@neobr/svelte`
- [ ] Update variant props (e.g., `variant="default"` → `variant="primary"`)
- [ ] Add `brutalist` prop where needed

### Phase 4: Cleanup

- [ ] Remove old component files from `src/lib/components/ui/`
- [ ] Keep NFT-specific components (RulerRulesManager, TraitTypeToggle, NeedsReupload)
- [ ] Update component index exports

### Phase 5: Verification

- [ ] Run `pnpm check` for TypeScript validation
- [ ] Run `pnpm lint` for code style
- [ ] Run `pnpm dev` to verify visual appearance

## Visual Changes

- Colors: Lavender primary, Peach secondary, Pink destructive, Green success, Yellow warning
- Shadows: Hard 5px offset brutalist shadows
- Radius: 12px brutalist radius
- Typography: Bold uppercase headings with tracking

## Dependencies Installed

- `@neobr/svelte`: Core Svelte 5 components
- `@neobr/tailwind-preset`: Brutal design system and tokens

## Next Steps

1. Update CSS with NeoBr-UI design system
2. Migrate Button component
3. Migrate Card components
4. Migrate Form components
5. Migrate remaining UI components
6. Update all imports in the codebase
7. Clean up old components
8. Run validation and verification
