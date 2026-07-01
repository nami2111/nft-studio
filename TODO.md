# TODO — over-engineering cleanup

Actionable plan derived from `ponytail-audit.md`. Ordered by cut size / low risk first.
Each task: what, exact steps, files, verification. Run `pnpm test && pnpm check` after each.

Baseline before starting:

- [ ] `pnpm test` green, `pnpm check` (svelte-check/tsc) clean — record the numbers.
- [ ] Work one task per commit so each is independently revertible (let user commit manually).

---

## 1. Untrack `stats.html` (1.8 MB) — trivial, do first ✅

**Why:** generated rollup-visualizer artifact, regenerated every build.
**Note:** The `rollup-plugin-visualizer` plugin is no longer installed in the project; `stats.html` was a stale committed artifact. Untracked anyway.

- [x] Add `stats.html` to `.gitignore`.
- [x] `git rm --cached stats.html`
- [x] Confirmed the build no longer emits it (plugin not installed); `vite.config.ts` only references it in PWA `ignorePatterns` (correct).
- **Verified:** `git ls-files | grep stats.html` returns nothing; `git check-ignore stats.html` confirms it's ignored.

---

## 2. Delete dead error-category wrappers — `error-handler.ts` (~-180 lines) ✅

**Why:** 11 exported wrappers with zero real callers.
Note: `recoverableWorkerOperation` appears only in a **stale test comment**
(`generation-worker-client.test.ts:162`), not a real call.

- [x] Delete these exports (all 0 callers):
      `handleFileError`, `handleValidationError`, `handleWorkerError`,
      `handleGenerationError`, `handleNetworkError`, `recoverableOperation`,
      `recoverableStorageOperation`, `recoverableFileOperation`,
      `recoverableWorkerOperation`, `recoverableGenerationOperation`,
      `recoverableNetworkOperation`.
- [x] Keep: `handleError` (file-operations + others), `handleStorageError`,
      `handleTypedError` (file-operations.ts:175), `withRetry` (generation.orchestrator.ts:148).
- [x] Remove now-dead private helpers only those 11 used. — None found dead; all helpers are used by the CATEGORIES table consumed by kept functions.
- [x] Fix the stale comment at `generation-worker-client.test.ts:162`.
- [x] Trim `error-handler.test.ts` cases covering deleted fns. — No test cases covered the deleted functions; test file imports only kept functions.
- **Files:** `src/lib/utils/error-handler.ts`, `src/lib/utils/error-handler.test.ts`,
  `src/lib/workers/generation-worker-client.test.ts`.
- **Verify:** `grep -rn "recoverable\|handleFileError\|handleWorkerError" src` → only defs gone; tests green.

---

## 3. Remove unused retry framework — `retry.ts` (~-200 lines) ✅

**Why:** only `retry()` (19 calls) and `withRetry()` used; rest is dead.

**Correction from audit:** `RetryConfigs` and `retryWithErrorHandling` are **actively used** by
`error-handler.ts` (imported and called in the CATEGORIES table and `withRetry` function).
`RetryConditions` is used internally by `RetryConfigs`. They cannot be deleted.
Only `withRetry` (retry.ts version) and `createDebouncedRetry` were truly dead.

- [x] Deleted `withRetry` from retry.ts — only referenced in `retry.test.ts` (test-only).
      Prod `withRetry` imports come from `error-handler.ts`, not `retry.ts`.
- [x] Deleted `createDebouncedRetry` — 0 callers anywhere (not even tests).
- [x] Kept `RetryOperation`, `RetryConditions`, `RetryConfigs`, `retryWithErrorHandling`,
      `retry` — all used by `error-handler.ts` or internally within retry.ts.
- [x] Pruned `retry.test.ts`: removed `withRetry` import and its test block (2 tests).
- **Files:** `src/lib/utils/retry.ts`, `src/lib/utils/retry.test.ts`.
- **Net:** ~76 lines removed from retry.ts, 28 lines from retry.test.ts.
- **Verified:** `pnpm check` clean; 40 test files / 472 tests green (2 fewer tests from removed withRetry block).

## 3b. De-duplicate `withRetry` ✅

**Why:** defined in both `retry.ts:342` and `error-handler.ts:297`.

- [x] Standardized on `error-handler.ts`'s `withRetry` (the one prod imports).
- [x] After task 3, only one definition survives.
- **Verified:** `grep -rn "export.*withRetry" src` → single hit (`error-handler.ts:295`).

---

## 4. Flatten error hierarchy — `typed-errors.ts` (~-180 lines) ✅

**Why:** 22 classes, 14 used once; subclass-per-domain adds no behavior over a code field.

**What was done:**

- [x] `AppError { code: string; context?: Record<string,unknown> }` already existed — kept as the sole error class.
- [x] Deleted 22 error subclasses and 7 type-guard functions — replaced with `ErrorCodes` const.
- [x] Only 2 prod instantiation sites existed (`error-handling.ts` creates `new AppError(...)` directly — already correct).
- [x] `instanceof` checks converted to `error.code === ErrorCodes.XXX` checks in `error-handler.ts`
      (retryable checks, category detection, `toAppError`, `detectCategory`).
- [x] `error-handling.ts` re-export simplified to just `AppError` (removed `FileSystemError`, `NetworkError`,
      `StorageError`, `ValidationError`, `WorkerError` re-exports — all aliases for deleted classes).
- [x] `error-handler.ts` `CategorySpec` changed from `ErrorClass` constructor pattern to `code` + `recoverable` fields.
- [x] `createTypedError` updated to use `ErrorCodes.CONVERTED_ERROR`.
- [x] Rewrote `typed-errors.test.ts` — tests for AppError, ErrorCodes, getErrorInfo, isRecoverableError.
- [x] Rewrote `error-handler.test.ts` — uses `AppError` + `ErrorCodes` instead of deleted subclasses.
- **Files:** `src/lib/utils/typed-errors.ts`, `src/lib/utils/typed-errors.test.ts`,
  `src/lib/utils/error-handler.ts`, `src/lib/utils/error-handler.test.ts`,
  `src/lib/utils/error-handling.ts`.
- **Verified:** `pnpm check` clean; 40 test files / 472 tests green.
  `grep -rn "instanceof .*Error" src` → all remaining are `instanceof AppError`, `instanceof Error`, or `instanceof DOMException` — none reference deleted classes.
- **Net:** ~-180 lines removed from `typed-errors.ts`, ~-50 lines from `error-handler.ts` simplification.

---

## 5. Collapse cache framework — `advanced-cache.ts` + `resource-manager.ts` (~-400 lines) ✅

**Why:** `AdvancedCache<T>` + 3 subclasses; subclasses instantiated once in
`resource-manager`, whose public methods are never called (only `addObjectUrl`/`destroy`
via `globalResourceManager`).

**Correctness gate — verified:**

- `performanceMonitor.addCacheMetrics()` is called by the old `collectAndReportCacheMetrics()`
  interval, but `getCacheHitRate()`, `getAllStats()`, `getMetricsInRange()` are **never called
  from prod** — only in `performance-monitor.test.ts`. The metrics are written but never read.
- The caches were never populated (no prod code calls `cacheImageBitmap` etc.), so
  `getCurrentUsageBytes()` always returned 0, so `MemoryPressureMonitor` never fired any cleanup.
- `session-cleanup.ts` calls `globalResourceManager.destroy()` — still works (calls `cleanup()`).

**What was done:**

- [x] Confirmed no external reader of the cache metrics / eviction side-effects.
- [x] Deleted `advanced-cache.ts` entirely (`AdvancedCache`, `ImageBitmapCache`, `ImageDataCache`,
      `ArrayBufferCache`, `CacheEntry`, `CacheMetrics`, `CacheOptions`).
- [x] Deleted `memory-pressure-monitor.ts` + its test (only consumer was `resource-manager`).
- [x] Reduced `resource-manager.ts` to the object-URL tracking that's actually used
      (`addObjectUrl`, `removeObjectUrl`, `cleanup`, `destroy`, `has`, `size`).
- [x] Dropped the `setInterval` metrics collection + `setTimeout` initial collection.
- [x] Dropped `MemoryPressureMonitor` integration (never fired — caches always empty).
- [x] No import changes needed in `session-cleanup.ts` / `file-operations.ts` / `trait-upload-manager.ts`
      — they import `globalResourceManager` which still exports the same API surface.
- [x] Test mocks in `ProjectManagement.test.ts` and `trait-upload-manager.test.ts` still valid
      (they mock `addObjectUrl`, `removeObjectUrl`, `cleanup` — all still present).
- **Files:** `src/lib/utils/advanced-cache.ts` (deleted), `src/lib/stores/resource-manager.ts` (rewritten),
  `src/lib/stores/memory-pressure-monitor.ts` (deleted), `src/lib/stores/memory-pressure-monitor.test.ts` (deleted).
- **Verified:** `pnpm check` clean (148 files, down from 150); 39 test files / 472 tests green
  (40 → 39 test files due to deleted memory-pressure-monitor.test.ts).
- **Net:** ~-400 lines from `advanced-cache.ts` + ~-200 lines from `resource-manager.ts` +
  ~-90 lines from `memory-pressure-monitor.ts` + ~-60 lines from its test = ~-750 lines total.

---

## 6. Move test-double backend out of prod — `storage/memory.ts` (~-90 lines)

**Why:** full `ObjectStorageBackend` impl imported only by tests; `getStorageBackend()`
never selects it.

- [ ] Move `memory.ts` to a test helper (e.g. `src/lib/storage/__tests__/memory-backend.ts`
      or a `testing/` fixture) so it's not shipped in prod `src`.
- [ ] Update the 4 test importers (persistence.service, session-cleanup, gallery-storage,
      streaming-storage tests).
- [ ] Move/keep `memory.test.ts` alongside.
- **Verify:** prod build tree has no memory backend; tests green.

---

## 7. Inline single-read feature flags — `feature-flags.ts` (~-40 lines)

**Why:** `enableOpfsStorage`, `enableAdaptiveBatchSize`, `enableZipWorkerOffloading`,
`enableLayerRef` each read once; `getFeatureFlags` has 0 callers.

- [ ] For each single-read flag, inline its default at the one call site
      (backend.ts, batch sizing, zip worker, layer-ref path).
- [ ] Delete `getFeatureFlags` (0 callers).
- [ ] Keep the flag mechanism only for `enableStreamingStorage` if it has genuine
      multi-site runtime toggling (7 files) — verify before removing the parsing layer.
- [ ] If only streaming remains, simplify `readDefaultOnFlag`/`readEnvFlag`/`parseEnvBoolean`
      down to what streaming needs.
- **Files:** `src/lib/config/feature-flags.ts` + the 4 single-read call sites.
- **Verify:** `grep -rn "isFlagEnabled\|getFeatureFlags" src` → only streaming (or none); tests green.

---

## 8. Delete one-shot codemod script — `standardize-comments.js` (~-60 lines)

**Why:** npm script with no CI/other caller; pairs with `postbuild` `remove-comments.js`.

- [ ] Delete `scripts/standardize-comments.js`.
- [ ] Remove the `standardize-comments` entry from `package.json` scripts.
- [ ] Sanity-check `remove-comments.js` (postbuild) is still wanted; leave if intentional.
- **Verify:** `grep -rn "standardize-comments" .` (excl. node_modules) → empty.

---

## 9. (Optional) Inline single-importer modules (~-470 lines if done)

**Why:** module + test each serving exactly one consumer. Judgment call — only if it
reads cleaner inlined.

- [ ] `combination-indexer.ts` → into `csp-solver.ts`.
- [ ] `memory-monitor.ts` → into `services/export.service.ts`.
- [ ] `workers/cache/array-buffer.cache.ts` → into `generation.worker.ts`.
- [ ] Fold each test into the consumer's test file.
- **Verify:** tests green; no orphan imports.
- **Note:** lowest priority; skip if the module boundary aids readability.

---

## Done criteria

- [ ] `pnpm test` green, `pnpm check` clean.
- [ ] `git ls-files | grep stats.html` empty.
- [ ] Net ~-1400 source lines removed (tasks 1–8), 1.8 MB untracked.
- [ ] `ponytail-audit.md` findings 1–9 each closed or consciously deferred.
