# Svelte Snippets Migration Plan

## Overview

Migrate repetitive template patterns to Svelte 5 snippets to eliminate code duplication, improve maintainability, and establish single source of truth for reusable UI patterns.

## Benefits

- **30-50% less template code** through DRY principles
- **Single change point** for repeated UI elements
- **Type-safe** snippet parameters
- **Scoped** - can reference component state naturally

---

## Component 1: Gallery Page

**File:** `src/routes/app/gallery/+page.svelte` (616 lines)

### Current Issue

4 nearly identical responsive layout sections with repeated markup:

- Mobile (lines 225-313)
- Mobile Landscape/Small Tablet (lines 316-356)
- Tablet (lines 359-399)
- Desktop (lines 402-540)

### Patterns to Extract

| Snippet Name       | Description                          | Parameters                                          |
| ------------------ | ------------------------------------ | --------------------------------------------------- |
| `searchInput`      | Search input with icon               | `value: string` (bindable)                          |
| `sortDropdown`     | Sort select dropdown                 | `value: string` (bindable), `options: SortOption[]` |
| `nftDetailPanel`   | NFT detail sidebar                   | `nft: NFT`, `onclose: () => void`                   |
| `responsiveHeader` | Collection header with title/actions | `title: string`, `count: number`                    |

### Migration Steps

1. Create `searchInput` snippet for search field
2. Create `sortDropdown` snippet for sort options
3. Create `nftDetailPanel` snippet for detail sidebar
4. Replace 4 inline implementations with snippet calls
5. Verify responsive behavior unchanged

---

## Component 2: CollectionStats

**File:** `src/lib/components/gallery/CollectionStats.svelte`

### Current Issue

4 identical stat cell patterns repeated (lines 27-48):

```svelte
<div class="space-y-1">
	<div class="text-muted-foreground text-xs">Label</div>
	<div class="text-lg font-bold tabular-nums">Value</div>
</div>
```

### Patterns to Extract

| Snippet Name | Description              | Parameters                                 |
| ------------ | ------------------------ | ------------------------------------------ |
| `statCell`   | Single stat display cell | `label: string`, `value: string \| number` |

### Migration Steps

1. Extract grid-cell markup to `statCell` snippet
2. Replace 4 inline cells with `{@render statCell(...)}`
3. Add optional icon parameter for future extensibility
4. Verify stat rendering unchanged

---

## Component 3: ErrorBoundary

**File:** `src/lib/components/layout/ErrorBoundary.svelte` (521 lines)

### Current Issue

Repeated patterns:

- Severity badge styling (lines 369-378)
- Recovery action buttons (lines 455-477)
- Icon rendering with conditions (lines 461-472)

### Patterns to Extract

| Snippet Name      | Description                | Parameters                                     |
| ----------------- | -------------------------- | ---------------------------------------------- |
| `severityBadge`   | Error severity indicator   | `severity: 'error' \| 'warning' \| 'info'`     |
| `errorIcon`       | Error type icon            | `type: ErrorType`                              |
| `recoveryActions` | Retry/dismiss button group | `onretry: () => void`, `ondismiss: () => void` |
| `fallbackInfo`    | Error details display      | `error: Error`, `stack: boolean`               |

### Migration Steps

1. Create `severityBadge` snippet for severity levels
2. Create `errorIcon` snippet for icon conditions
3. Create `recoveryActions` snippet for button group
4. Replace inline implementations with snippets
5. Verify error handling unchanged

---

## Component 4: NFTDetail Empty State

**File:** `src/lib/components/gallery/NFTDetail.svelte`

### Current Issue

Empty state pattern (lines 155-174) could be reusable:

```svelte
<Card class="flex flex-col items-center justify-center p-12 text-center opacity-60">
	<div class="bg-muted mb-4 rounded-full p-4">
		<svg>...</svg>
	</div>
	<div class="text-foreground text-base font-medium">No NFT Selected</div>
	<div class="text-muted-foreground mt-1 text-sm">...</div>
</Card>
```

### Patterns to Extract

| Snippet Name | Description                   | Parameters                                              |
| ------------ | ----------------------------- | ------------------------------------------------------- |
| `emptyState` | Generic empty state with icon | `icon: Snippet`, `title: string`, `description: string` |

### Migration Steps

1. Create `emptyState` snippet with icon, title, description params
2. Extract SVG to separate icon snippet or pass as param
3. Replace inline empty state with snippet call
4. Consider making reusable in shared components

---

## Component 5: LayerItem Toast Helpers

**File:** `src/lib/components/layer/LayerItem.svelte` (824 lines)

### Current Issue

8+ similar toast helper functions (lines 40-90):

```svelte
function showSuccess(message: string) {
  toast.success(message, {
    duration: 3000,
    icon: '✓',
    style: 'background: oklch(0.7 0.15 150); color: white;'
  });
}

function showError(message: string) {
  toast.error(message, {
    duration: 5000,
    icon: '✗',
    style: 'background: oklch(0.5 0.2 360); color: white;'
  });
}

function showWarning(message: string) { ... }
function showInfo(message: string) { ... }
```

### Note on This Component

Toast helpers are **JavaScript functions**, not template patterns. Snippets are for **markup reusability**.

**Alternative Approaches:**

| Option                         | Description                        | Recommendation        |
| ------------------------------ | ---------------------------------- | --------------------- |
| A. Create toast utility module | Move to `src/lib/utils/toasts.ts`  | ✅ Recommended        |
| B. Use snippets for toast UI   | Extract toast markup, call from JS | ❌ Overcomplicated    |
| C. Keep as-is                  | Functions work fine                | ❌ Not using snippets |

### Recommended Migration for LayerItem

1. Create `src/lib/utils/toasts.ts` with typed toast functions
2. Export: `showSuccess`, `showError`, `showWarning`, `showInfo`
3. Import and use in LayerItem and other components
4. Delete duplicate toast functions

```typescript
// src/lib/utils/toasts.ts
export function showSuccess(message: string) {
	toast.success(message, { duration: 3000, icon: '✓' });
}

export function showError(message: string) {
	toast.error(message, { duration: 5000, icon: '✗' });
}

// ... etc
```

---

## Implementation Order

| Priority | Component               | Effort | Impact                 |
| -------- | ----------------------- | ------ | ---------------------- |
| 1        | CollectionStats         | Low    | High (4→1)             |
| 2        | NFTDetail Empty State   | Low    | Medium                 |
| 3        | Gallery Page            | High   | Very High (4 sections) |
| 4        | ErrorBoundary           | Medium | Medium                 |
| 5        | LayerItem (toast utils) | Low    | Medium (cleanup)       |

---

## Verification Checklist

After each migration:

- [ ] `pnpm check` - TypeScript validation
- [ ] `pnpm format` - Code formatted
- [ ] Visual regression - UI looks identical
- [ ] Functionality - All interactions work

---

## Migration Status

### Completed

- [x] CollectionStats - Extract `statCell` snippet
- [x] NFTDetail - Extract `emptyState` snippet
- [ ] Gallery Page - Extract responsive snippets (skipped - layouts intentionally differ per breakpoint)
- [ ] ErrorBoundary - Extract error UI snippets
- [x] LayerItem - Extract toast utilities to module

---

## Notes

- Snippets can access component `$state` and `$derived` values directly
- Use `Snippet<[Type]>` for typed parameters in component props
- Consider exporting reusable snippets from shared component libraries
- Keep snippets focused and single-purpose
