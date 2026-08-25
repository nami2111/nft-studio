# Ponytail Audit — Over-Engineering Cleanup

Whole-repo audit for bloat: what to delete, simplify, or replace. One-shot
findings from the 2025 session; nothing has been applied yet. Ranked biggest
cut first. Scope is over-engineering only — correctness, security, and
performance are separate review passes.

**Estimated total: ~-1,800 lines and -1 dependency.**

---

## High impact

### 1. Delete dead domain barrel and event types

**Status:** DONE

**Tag:** `delete`
**Files:**

- `src/lib/domain/index.ts` (21 lines)
- `src/lib/domain/models.ts` (70 lines)

**Evidence:** `src/lib/domain/index.ts` has zero importers — every consumer in
the codebase imports the underlying files directly (`$lib/domain/validation`,
`$lib/domain/collection-design-mutator`, etc.). The `DomainEvent`,
`ProjectCreatedEvent`, and related types exported from `models.ts` are never
referenced anywhere outside `models.ts` itself.

**Action:** Delete both files. If a domain barrel is wanted later, add it when
the second importer exists.

---

### 2. Shrink performance-monitor to what's used

**Status:** DONE (686 → 97 lines)

**Tag:** `shrink`
**File:** `src/lib/utils/performance-monitor.ts` (686 lines)

**Evidence:** Actual usage across the codebase:

- `performanceMonitor.startTimer()` / `.stopTimer()` (project.store,
  generation.orchestrator, worker pool)
- `productionMonitor.recordCacheHit/Miss/Eviction/updateCacheMemoryUsage`
  (gallery.store), `.recordDatabaseQuery` (gallery-storage)
- `measureOperation()` — one caller (`file-operations.ts`)

Dead exports: `timed()`, `withTiming()`, report/stats aggregation machinery,
and most of the interfaces (`PerformanceReport`, `PerformanceStats`) have no
callers.

**Action:** Replace with a ~60-line module: a timer map + a handful of named
counters, DEV-gated output via `logger`. Delete `timed`, `withTiming`, and all
unused report types.

---

### 3. Inline PERF_CONFIG

**Status:** DONE (file deleted)

**Tag:** `yagni`
**File:** `src/lib/config/performance.config.ts` (209 lines)

**Evidence:** ~200 lines of tuning knobs across 9 sections (`batch`, `cache`,
`memory`, `monitoring`, `fileOperations`, `generation`, `gallery`, `ui`),
but only two things are ever read:

- `PERF_CONFIG.cache.galleryFilter.maxEntries` → `gallery.store.svelte.ts`
- `calculateAdaptiveDelay()` → `project.store.svelte.ts`

Config nobody sets is config nobody needs.

**Action:** Inline `maxEntries` as a constant in gallery.store; move
`calculateAdaptiveDelay` (with its small delay table) into project.store or a
tiny shared module. Delete the rest of the file.

---

### 4. Delete dead components

**Status:** DONE (5 files)

**Tag:** `delete`
**Files (zero importers each):**

- `src/lib/components/shared/OptimizedList.svelte`
- `src/lib/components/shared/FloatingElement.svelte`
- `src/lib/components/shared/ModeSwitcher.svelte`
- `src/lib/components/shared/FeatureItem.svelte`
- `src/lib/components/layout/ResponsiveContainer.svelte`

**Action:** Delete all five.

---

### 5. Delete image-format-detector

**Status:** RETRACTED (GalleryImport.svelte uses detectImageFormat)

**Tag:** `delete`
**File:** `src/lib/utils/image-format-detector.ts` (86 lines)

**Evidence:** Zero importers anywhere in `src/`.

**Action:** Delete.

---

## Medium impact

### 6. Shrink retry.ts

**Status:** DONE (folded into error-handler.ts)

**Tag:** `shrink`
**File:** `src/lib/utils/retry.ts` (336 lines)

**Evidence:** Only two exports are imported anywhere:
`RetryConfigs` and `retryWithErrorHandling`, both consumed exclusively by
`src/lib/utils/error-handler.ts`. The `RetryOperation<T>` class and most of
the `RetryConfig` surface (hooks, per-attempt callbacks) have no callers.

**Action:** Fold a minimal retry loop (~50 lines: attempts + backoff +
optional condition) into `error-handler.ts` where `withRetry` already wraps
it. Delete `retry.ts` and its test file; port relevant test cases to
error-handler tests.

---

### 7. Collapse the two toast systems

**Status:** DONE (+ dead exports removed from error-handling.ts)

**Tag:** `yagni`
**Files:**

- `src/lib/utils/toast.ts` (118 lines) — 26 one-off wrapper functions
  (`showProjectSaved`, `showTraitDeleted`, `showUploadPartialSuccess`, ...)
  with exactly one importer (`LayerItem.svelte`)
- `src/lib/utils/error-handling.ts` — already exports generic
  `showError/showSuccess/showInfo/showWarning`

**Evidence:** Two parallel toast layers over svelte-sonner doing the same job.
The one-off wrappers encode messages that belong at call sites.

**Action:** Delete `toast.ts`; convert its single importer to
`error-handling`'s show\* functions with inline messages.

---

### 8. Remove ValidationService class

**Status:** DONE

**Tag:** `yagni`
**File:** `src/lib/services/validation.service.ts`

**Evidence:** A singleton class wrapping `$lib/domain/validation` functions,
with exactly one consumer: `project.store.svelte.ts`.

**Action:** Import the validation functions directly in the store; delete the
service and its test.

---

### 9. Consolidate the three storage stacks

**Status:** DONE — persistence.service always uses `getStorageBackend()` (indexeddb-legacy object backend covers no-OPFS browsers); `persistence/storage.ts` (531 lines) deleted, replaced by read-only `legacy-reader.ts` (80 lines) for migration; `saveProjectToLegacyStorage` branch removed. Verified in browser: existing project loads + mutation persists.

**Tag:** `yagni` / structural
**Files:**

- `src/lib/storage/` — backend.ts + opfs.ts + capabilities.ts +
  indexeddb-legacy.ts + paths.ts (modern path-selection layer)
- `src/lib/persistence/storage.ts` (531 lines) — SmartStorageStore with its
  own localStorage quota estimation / fallback strategy
- `src/lib/persistence/indexeddb.ts` (83 lines) — legacy IndexedDB project
  store

**Evidence:** Two independent "smart storage with fallback" implementations.
Both route through `capabilities.ts`; only `persistence.service.ts` consumes
the persistence/ pair, while gallery-storage and streaming-storage use the
storage/ backend directly.

**Action:** Standardize on the `lib/storage/backend.ts` path. Port
SmartStorageStore's still-needed behavior onto `ObjectStorageBackend`, fold
the legacy project reader into it (or keep as one small migration helper),
then delete `persistence/storage.ts` and `persistence/indexeddb.ts`.
Biggest single refactor on this list — do it after items 1–8.

---

## Low impact

### 10. Drop one ZIP library

**Status:** DONE — jszip removed; all read/write now via `@zip.js/zip.js` through new `utils/zip.ts` helpers (`createZipBlob`, `openZip`). Migrated: export.service, file-operations, zip.worker, GalleryImport (standard/streaming split collapsed to zip.js path). Verified in browser: project ZIP load + 1000-item generation.

**Tag:** `native:` / dep consolidation
**Deps:** `jszip` AND `@zip.js/zip.js`

**Evidence:** zip.js earns its keep for large-ZIP streaming import
(`GalleryImport.svelte` large-file branch). jszip handles everything else:
export.service, file-operations, zip.worker, GalleryImport standard branch.

**Action:** Migrate the small jszip reads/writes to zip.js (its API covers
both), remove `jszip` from dependencies. Do opportunistically, not upfront —
both libs work today.

---

### 11. Delete dead exports in utils.ts

**Status:** DONE (-2 deps: clsx, tailwind-merge)

**Tag:** `delete`
**File:** `src/lib/utils.ts`

**Dead exports (zero callers):**

- `cn()` — yes, the clsx/tailwind-merge helper itself is unused locally
- `WithoutChild<T>`, `WithoutChildren<T>`, `WithElementRef<T>` type helpers
  (shadcn leftovers)
- `normalizeFilename()`

**Action:** Delete them. Then check whether `clsx` and `tailwind-merge` still
have any importer — if not, `-2 devDependencies`.

---

### 12. Merge simple-debug into logger

**Status:** DONE

**Tag:** `shrink`
**Files:** `src/lib/utils/simple-debug.ts`, `src/lib/utils/logger.ts`

**Evidence:** Two DEV-gated console wrappers doing the same job.
simple-debug adds emoji prefixes and a counter; logger adds a `[gnstudio]`
prefix. Three callers each.

**Action:** Add `debugLog/debugTime/debugCount` aliases (or migrate the three
callers in gallery.store) into `logger.ts`; delete simple-debug.

---

### 13. UI wrapper barrels — decide, don't half-maintain

**Status:** DONE (kept wrappers; moved RulerRulesManager/TraitTypeToggle/NeedsReupload to layer/)

**Tag:** `yagni` (borderline — project convention)
**Files:** 13 × `src/lib/components/ui/*/index.ts`

**Evidence:** All except modal are verbatim re-exports of `@neobr/svelte`
(e.g. `export { Button } from '@neobr/svelte'`). AGENTS.md currently mandates
importing through these wrappers, so they are a deliberate indirection point —
but today they add zero code. Only `modal/` actually wraps anything, and
`RulerRulesManager.svelte` doesn't belong under `ui/` at all.

**Action (pick one):**

- Keep wrappers, move `RulerRulesManager` + `NeedsReupload` out of `ui/` into
  feature folders, **or**
- Drop the pass-through barrels and import `@neobr/svelte` directly,
  updating AGENTS.md accordingly.

Do not leave both conventions in place.

---

### 14. Prune package.json script aliases

**Status:** DONE (+ postinstall npm→pnpm)

**Tag:** `delete`
**File:** `package.json`

**Duplicates:** `verify-lock` (= verify-lockfile), `verify-lockfile-ci` (=),
`lint-ci` (= lint), plus `postinstall:copy-auth` chain that uses `npm run`
inside a pnpm project.

**Action:** Keep canonical names, delete aliases; switch internal invocations
to `pnpm run`.

---

## Status

Completed: all items (1–14). Net: ~-2,300 lines, -3 deps (jszip, clsx, tailwind-merge).

## Suggested order

1. Pure deletions first (items 1, 4, 5, 11, 12, 14) — zero risk, run
   `vp fmt && vp lint && vp test` after each batch.
2. Shrinks with existing tests to port (2, 6, 7).
3. Single-consumer refactors (3, 8).
4. Storage consolidation (9) — schedule separately, it touches persistence.
5. Dep swap (10) — opportunistic.

## Verification

After every item:

```sh
vp fmt && vp lint && vp test
vp run build   # catches tsconfig/type breakage deletions can cause
```
