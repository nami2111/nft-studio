# Svelte Best Practices Audit — Issues & Fix Plan

> Generated from https://svelte.dev/docs/svelte/best-practices
> Last updated: 2026-03-21

---

## 🔴 HIGH Severity

### 1. `$effect` reassigning a `$derived` (Bug)

**File:** `src/lib/components/ui/ruler/RulerRulesManager.svelte`

**Lines:** 22, 61, 76, 109–113

**Issue:** `rules` is declared as `$derived` on line 22, but the `$effect` on line 109–113 and the `addRule()`/`removeRule()` functions reassign it. `$derived` bindings are read-only — this is both a type error and a runtime bug.

```svelte
// Line 22 — declared as $derived
let rules = $derived(trait.rulerRules || []);

// Line 109–113 — tries to reassign it
$effect(() => {
	if (trait.rulerRules) {
		rules = trait.rulerRules.map(cleanupConflicts); // Bug: can't assign to $derived
	}
});
```

**Plan:**

1. Change `rules` from `$derived` to `$state`, initialized from `trait.rulerRules`
2. Add an `$effect` to sync `rules` when `trait.rulerRules` changes externally
3. Keep `addRule()` and `removeRule()` mutating `rules` as-is (now valid with `$state`)
4. Verify RulerRulesManager renders and functions correctly

---

### 2. Module-level `$state` singletons (Context vs Global)

**Files:**

- `src/lib/stores/project.store.svelte.ts` (line 27)
- `src/lib/stores/generation-progress.svelte.ts` (line 108)
- `src/lib/stores/loading-state.svelte.ts` (lines 10–11)

**Issue:** These files export reactive `$state` objects as global singletons. Any component can import and mutate them. This prevents multiple independent instances (e.g., two project editors) and makes testing harder. Best practice recommends using context (`setContext`/`getContext` or `createContext`) for tree-scoped state.

**Consumers:**

- `project` → TraitTypeToggle, TraitCard, LayerManager, Preview, GenerationForm
- `generationState` → GenerationProgress, PerformanceDashboard
- `loadingStates` → LoadingIndicator

**Plan:**

1. Audit which stores are truly global (single app instance) vs tree-scoped
2. For global singletons (loadingStates, performanceStore) — keep as-is, document as intentional
3. For project-scoped state (project, generationState) — consider migrating to context if multi-instance support is ever needed
4. At minimum, wrap access in exported getter/setter functions instead of raw `$state` exports
5. Add JSDoc comments explaining the singleton design choice

---

### 3. `window.addEventListener` in `onMount` (Should use `<svelte:window>`)

**Files:**

- `src/lib/components/layout/ErrorBoundary.svelte` (line 328) — `window.addEventListener('popstate', ...)`
- `src/lib/components/layer/VirtualTraitList.svelte` (line 85) — `window.addEventListener('resize', ...)`

**Issue:** Best practice says to use `<svelte:window>` and `<svelte:document>` for window/document listeners instead of manual `addEventListener` in lifecycle hooks.

**Plan:**

1. In `ErrorBoundary.svelte`, replace:

   ```svelte
   // Before
   onMount(() => {
       window.addEventListener('popstate', handlePopState);
       return () => window.removeEventListener('popstate', handlePopState);
   });

   // After
   <svelte:window onpopstate={handlePopState} />
   ```

2. In `VirtualTraitList.svelte`, replace:

   ```svelte
   // Before
   onMount(() => {
       window.addEventListener('resize', updateContainerHeight);
       return () => window.removeEventListener('resize', updateContainerHeight);
   });

   // After
   <svelte:window onresize={updateContainerHeight} />
   ```

3. Remove manual cleanup logic (Svelte handles lifecycle automatically)
4. Verify resize/popstate behavior still works

---

### 4. Unscoped `:global(section)` selector

**File:** `src/lib/components/layout/Hero.svelte` (lines 147–149)

**Issue:** `:global(section)` applies `cursor: crosshair` to every `<section>` element in the entire application, not just within Hero.

```svelte
<style>
	:global(section) {
		cursor: crosshair;
	} /* Too broad! */
</style>
```

**Plan:**

1. Scope the selector to the Hero component's own section:
   ```svelte
   <style>
   	section {
   		cursor: crosshair;
   	} /* Scoped automatically by Svelte */
   </style>
   ```
2. If the intent is truly global (the entire app should have crosshair sections), move this to `app.css` with a comment explaining why
3. Verify Hero section cursor behavior unchanged

---

## 🟡 MEDIUM Severity

### 5. `<svelte:component this={...}>` (Use direct component reference)

**File:** `src/routes/about/+page.svelte` (lines 124, 218)

**Issue:** `section.icon` is already a component reference, not a string. The `<svelte:component this={...}>` wrapper is unnecessary in Svelte 5.

```svelte
<!-- Before -->
<svelte:component this={section.icon} class="h-4 w-4" />

<!-- After -->
<section.icon class="h-4 w-4" />
```

**Plan:**

1. Replace both instances with direct component syntax
2. Verify Lucide icons render correctly

---

### 6. `use:portal` action (Migrate to `{@attach}`)

**File:** `src/lib/components/ui/modal/modal.svelte` (lines 2–11, 55)

**Issue:** Uses legacy `use:action` pattern with `{ destroy() }` lifecycle. Svelte 5 best practice is `{@attach}`.

```svelte
<!-- Before -->
<div use:portal={portalTarget}>

<script module>
	export function portal(node: HTMLElement, target: HTMLElement) {
		target.appendChild(node);
		return {
			destroy() { target.removeChild(node); }
		};
	}
</script>

<!-- After -->
<div {@attach={(node: HTMLElement) => {
	portalTarget.appendChild(node);
	return () => { if (node.parentNode === portalTarget) portalTarget.removeChild(node); };
}}>
```

**Plan:**

1. Remove the `portal` function from `<script module>`
2. Replace `use:portal={portalTarget}` with `{@attach}` directive
3. Keep the `$effect` for setting `portalTarget = document.body` (but remove unnecessary `typeof document` guard — see issue #15)
4. Verify modal portal behavior unchanged

---

### 7. `$effect` syncing prop to 7 local states

**File:** `src/lib/components/project/ProjectSettings.svelte` (lines 29–38)

**Issue:** An `$effect` copies the `project` prop into 7 separate `$state` variables. This is fragile — external changes to `project` overwrite unsaved edits.

```svelte
$effect(() => {
	const currentProject = project;
	projectName = currentProject.name;
	projectDescription = currentProject.description;
	metadataStandard = currentProject.metadataStandard || MetadataStandard.ERC721;
	symbol = currentProject.symbol || '';
	sellerFeeBasisPoints = currentProject.sellerFeeBasisPoints || 0;
	externalUrl = currentProject.externalUrl || '';
	animationUrl = currentProject.animationUrl || '';
});
```

**Plan:**

1. Keep the pattern for editable form fields (it's the correct approach for "edit then save" forms)
2. Add a dirty-tracking mechanism: set `isDirty = true` when user modifies a field
3. Skip the `$effect` sync when `isDirty === true` to prevent overwriting unsaved edits
4. Reset `isDirty` on explicit save/revert actions
5. Consider a form library pattern if complexity grows

---

### 8. Local `$state` not synced from store

**File:** `src/lib/components/gallery/GalleryControls.svelte` (lines 14–16)

**Issue:** Local state variables are initialized from the store once but never re-synced if the store changes externally (e.g., another component modifies the filter). UI controls will show stale values.

```svelte
let searchQuery = $state(galleryStore.filterOptions.search || ''); let selectedCollection =
$state(galleryStore.selectedCollection?.id || ''); let sortOption = $state(galleryStore.sortOption);
```

**Plan:**

1. Convert to `$derived` if these are display-only:
   ```svelte
   let searchQuery = $derived(galleryStore.filterOptions.search || '');
   ```
2. For bindable inputs, use two-way sync with `$effect`:
   ```svelte
   let searchQuery = $state(galleryStore.filterOptions.search || '');
   $effect(() => {
       searchQuery = galleryStore.filterOptions.search || '';
   });
   ```
3. Or use `$bindable()` if the component should update the store directly
4. Verify filter/sort controls reflect external state changes

---

### 9. Index used as `each` key

**File:** `src/lib/components/gallery/NFTDetail.svelte` (line 128)

**Issue:** Uses array index `i` as the key. If traits are reordered or removed, Svelte will incorrectly recycle DOM nodes.

```svelte
<!-- Before -->
{#each selectedNFT.metadata.traits as trait, i (i)}

<!-- After — use a stable identity -->
{#each selectedNFT.metadata.traits as trait (trait.trait_type + ':' + trait.value)}
```

**Plan:**

1. Identify a unique key for each trait (e.g., `trait_type + value` combination)
2. Replace `(i)` with the stable key
3. Verify trait list renders correctly with additions/removals

---

### 10. All-items loop defeats virtualization

**File:** `src/lib/components/layer/VirtualTraitList.svelte` (lines 103–114)

**Issue:** Iterates over ALL traits and uses `@const isVisible` + `#if` to hide non-visible ones. This creates DOM nodes for every trait, defeating the purpose of virtualization.

```svelte
<!-- Before — creates DOM for ALL traits -->
{#each traits as trait (trait.id)}
	{@const isVisible = visibleTraits.some((vt) => vt.id === trait.id)}
	{#if isVisible}
		<TraitCard ... />
	{/if}
{/each}

<!-- After — only render visible traits -->
{#each visibleTraits as trait (trait.id)}
	<TraitCard ... />
{/each}
```

**Plan:**

1. Change the `each` block to iterate over `visibleTraits` instead of `traits`
2. Remove the `@const isVisible` and `#if` guard
3. Verify virtual scrolling behavior and performance

---

### 11. Partially unscoped `:global(.dark)` selectors

**File:** `src/lib/components/layout/ErrorBoundary.svelte` (lines 510–518)

**Issue:** `.dark` is correctly global (on `<html>`), but the target classes (`.text-gray-900`, `.text-gray-600`, `.text-gray-500`) are not scoped, so they match any element in the DOM.

```svelte
<style>
	/* Before — targets bleed globally */
	:global(.dark) .text-gray-900 {
		color: rgb(243 244 246);
	}

	/* After — fully scoped */
	:global(.dark) :global(.text-gray-900) {
		color: rgb(243 244 246);
	}
</style>
```

**Plan:**

1. Add `:global()` to the target selectors, OR
2. Move dark-mode overrides to `app.css` where they belong (global theming)
3. Verify dark mode styling unchanged

---

### 12. `document.addEventListener` in `$effect` for click-outside

**File:** `src/routes/app/gallery/+page.svelte` (lines 148–155)

**Issue:** Uses manual `document.addEventListener` in an `$effect` for click-outside detection.

```svelte
$effect(() => {
	if (sortDropdownOpen) {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	}
});
```

**Plan:**

1. Option A: Use `<svelte:document onclick={handleClickOutside} />` with conditional rendering
2. Option B: Create an overlay element with `onclick` when dropdown is open
3. Option C: Use `{@attach}` with a document-level click handler
4. Verify dropdown closes on outside click

---

### 13. `$state` for objects only reassigned wholesale

**File:** `src/lib/components/monitor/PerformanceMonitor.svelte` (lines 28–39)

**Issue:** `realTimeMetrics` is a nested object always reassigned as a whole (`realTimeMetrics = { ... }`). It is never mutated in place. Deep reactivity tracking on this nested structure is wasted overhead.

```svelte
// Before — deep reactive proxy created unnecessarily
let realTimeMetrics = $state({ activeWorkers: 0, cacheHitRate: 0, ... });

// After — no proxy overhead, reassignment still triggers updates
let realTimeMetrics = $state.raw({ activeWorkers: 0, cacheHitRate: 0, ... });
```

**Plan:**

1. Change `$state({...})` to `$state.raw({...})`
2. Verify the component still updates when `realTimeMetrics` is reassigned
3. Audit other `$state` objects in stores (gallery.store.svelte.ts, generation-progress.svelte.ts) for same pattern where sub-objects are only reassigned

---

## 🟢 LOW Severity

### 14. `<slot />` in layout (Consider `{@render children()}`)

**File:** `src/routes/app/gallery/+layout.svelte` (line 6)

**Issue:** Uses legacy `<slot />` for SvelteKit child route rendering. SvelteKit 2.12+ supports `{@render children()}`.

**Plan:**

1. Check SvelteKit version compatibility (currently `^2.55.0` — should be supported)
2. Migrate to:
   ```svelte
   let { children }: { children: Snippet } = $props();
   {@render children()}
   ```
3. If SvelteKit routing doesn't support this yet, keep `<slot />` and add a TODO comment
4. Apply same change to other layouts: `+layout.svelte`, `app/+layout.svelte`

---

### 15. Unnecessary `typeof document` guard in `$effect`

**File:** `src/lib/components/ui/modal/modal.svelte` (lines 44–48)

**Issue:** `$effect` never runs during SSR, so the `typeof document !== 'undefined'` check is unnecessary.

```svelte
<!-- Before -->
$effect(() => {
	if (typeof document !== 'undefined') {
		portalTarget = document.body;
	}
});

<!-- After -->
$effect(() => {
	portalTarget = document.body;
});
```

**Plan:**

1. Remove the `typeof document` guard
2. Verify modal still works in browser

---

### 16. Empty `$effect` (no-op)

**File:** `src/lib/components/gallery/SimpleVirtualGrid.svelte` (lines 164–167)

**Issue:** An `$effect` that does nothing — its body is just a comment.

```svelte
$effect(() => {
	// Skip preloading to avoid the 44-216ms URL creation bottleneck
	// Images will be loaded on-demand when they come into view
});
```

**Plan:**

1. Delete the empty `$effect` block entirely
2. Move the comment to a nearby relevant location if still needed

---

### 17. `$state` for write-once boolean

**File:** `src/lib/components/gallery/SimpleVirtualGrid.svelte` (line 171)

**Issue:** `hasInitialized` is set to `true` once and never read in any reactive context. A plain `let` variable is sufficient.

```ts
// Before
let hasInitialized = $state(false);

// After
let hasInitialized = false;
```

**Plan:**

1. Change `$state(false)` to plain `let hasInitialized = false`
2. Verify no reactive reads depend on it

---

### 18. `$derived(() => fn)` instead of `$derived.by()`

**File:** `src/lib/components/gallery/TraitFilter.svelte` (lines 15–21, 24–46, 49)

**Issue:** Uses `$derived(() => expression)` which returns a function that must be called. For complex logic, `$derived.by()` is the canonical idiom. For simple access, plain `$derived` suffices.

```svelte
// Before — returns a function, must call sourceNFTs()
const sourceNFTs = $derived(() => { ... });
const availableTraits = $derived(() => { const nfts = sourceNFTs(); ... });

// After — direct values, no function call needed
const sourceNFTs = $derived.by(() => { ... });
const availableTraits = $derived.by(() => { const nfts = sourceNFTs; ... });

// Simple case — just use plain $derived
const selectedTraits = $derived(galleryStore.filterOptions.selectedTraits || {});
```

**Plan:**

1. Convert complex `$derived(() => ...)` to `$derived.by(() => ...)`
2. Convert simple `$derived(() => expr)` to `$derived(expr)`
3. Update all call sites to use the value directly (remove `()` calls)
4. Verify filter behavior unchanged

---

### 19. Hybrid pub/sub bridge in loading-state

**File:** `src/lib/stores/loading-state.svelte.ts` (lines 10–21)

**Issue:** Bridges a legacy `LoadingStateManager` class (custom `.subscribe()`) to `$state` objects via `Object.assign`. This duplicates state and could lead to synchronization issues.

```ts
export const loadingStates = $state<Record<string, boolean>>({});

loadingStateManager.subscribe(() => {
	Object.assign(loadingStates, loadingStateManager.getAllLoadingStates());
});
```

**Plan:**

1. Ideally, refactor `LoadingStateManager` to use `$state` directly internally
2. If refactoring is too large, document the bridge pattern with JSDoc
3. Consider whether `Object.assign` should be `$state.raw` with full replacement instead
4. Verify loading indicators update correctly

---

### 20. Global keyframe class defined in component

**File:** `src/lib/components/generation/GenerationProgress.svelte` (lines 166–168)

**Issue:** `.animate-pulse-subtle` is defined with `:global` in a component's `<style>`. If it's a utility class used across the app, it belongs in global CSS.

```svelte
<style>
	:global(.animate-pulse-subtle) {
		animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>
```

**Plan:**

1. If used only in GenerationProgress — scope it (remove `:global`)
2. If used across components — move to `app.css` as a utility class
3. Search for usages of `.animate-pulse-subtle` to determine scope

---

## Implementation Order

| Priority | Issue                               | Effort | Impact                   |
| -------- | ----------------------------------- | ------ | ------------------------ |
| 1        | #1 — $derived reassignment bug      | Low    | High (fixes runtime bug) |
| 2        | #5 — `<svelte:component>` cleanup   | Low    | Low (code quality)       |
| 3        | #16 — Empty $effect removal         | Low    | Low (cleanup)            |
| 4        | #17 — Write-once $state             | Low    | Low (cleanup)            |
| 5        | #15 — Unnecessary document guard    | Low    | Low (cleanup)            |
| 6        | #4 — Unscoped `:global(section)`    | Low    | Medium (style leak)      |
| 7        | #3 — window.addEventListener        | Low    | Medium (best practice)   |
| 8        | #6 — use:portal → {@attach}         | Low    | Medium (modernization)   |
| 9        | #18 — $derived.by migration         | Low    | Medium (idiomatic code)  |
| 10       | #9 — Each block key                 | Low    | Medium (correctness)     |
| 11       | #11 — Unscoped :global(.dark)       | Low    | Medium (style scope)     |
| 12       | #8 — GalleryControls sync           | Medium | Medium (stale UI)        |
| 13       | #10 — VirtualTraitList iteration    | Medium | Medium (performance)     |
| 14       | #12 — Click-outside handler         | Low    | Low                      |
| 15       | #13 — $state.raw for metrics        | Low    | Low (performance)        |
| 16       | #7 — ProjectSettings dirty tracking | Medium | Medium (UX)              |
| 17       | #20 — Global animation class        | Low    | Low                      |
| 18       | #19 — Loading state bridge          | Medium | Low                      |
| 19       | #14 — Slot → @render children       | Low    | Low                      |
| 20       | #2 — Singleton → context            | High   | Low (architectural)      |

---

## Verification Checklist

After each fix:

- [ ] `pnpm check` — TypeScript + Svelte validation passes
- [ ] `pnpm lint` — No new lint errors
- [ ] `pnpm test` — All tests pass
- [ ] `pnpm build` — Production build succeeds
- [ ] Visual check — UI looks identical
- [ ] Functional check — Interactions still work

---

## Fix Status

- [x] #1 — $derived reassignment bug in RulerRulesManager
- [x] #2 — Module-level $state singletons (documented as intentional)
- [x] #3 — window.addEventListener → `<svelte:window>`
- [x] #4 — Unscoped `:global(section)` in Hero
- [x] #5 — `<svelte:component>` → direct component
- [x] #6 — use:portal → `{@attach}`
- [x] #7 — ProjectSettings $effect dirty tracking
- [x] #8 — GalleryControls state sync
- [x] #9 — Index key → stable key in NFTDetail
- [x] #10 — VirtualTraitList virtualization fix
- [x] #11 — Unscoped `:global(.dark)` selectors
- [x] #12 — Click-outside handler modernization
- [x] #13 — $state.raw for PerformanceMonitor
- [x] #14 — `<slot />` → `{@render children()}`
- [x] #15 — Remove typeof document guard
- [x] #16 — Remove empty $effect
- [x] #17 — Write-once $state → plain let
- [x] #18 — $derived.by migration in TraitFilter
- [x] #19 — Loading state hybrid bridge (documented)
- [x] #20 — Global animation class scope
