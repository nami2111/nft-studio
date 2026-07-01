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

## 2. Delete dead error-category wrappers — `error-handler.ts` (~-180 lines)
**Why:** 11 exported wrappers with zero real callers.
Note: `recoverableWorkerOperation` appears only in a **stale test comment**
(`generation-worker-client.test.ts:162`), not a real call.
- [ ] Delete these exports (all 0 callers):
  `handleFileError`, `handleValidationError`, `handleWorkerError`,
  `handleGenerationError`, `handleNetworkError`, `recoverableOperation`,
  `recoverableStorageOperation`, `recoverableFileOperation`,
  `recoverableWorkerOperation`, `recoverableGenerationOperation`,
  `recoverableNetworkOperation`.
- [ ] Keep: `handleError` (file-operations + others), `handleStorageError`,
  `handleTypedError` (file-operations.ts:175), `withRetry` (generation.orchestrator.ts:148).
- [ ] Remove now-dead private helpers only those 11 used.
- [ ] Fix the stale comment at `generation-worker-client.test.ts:162`.
- [ ] Trim `error-handler.test.ts` cases covering deleted fns.
- **Files:** `src/lib/utils/error-handler.ts`, `src/lib/utils/error-handler.test.ts`,
  `src/lib/workers/generation-worker-client.test.ts`.
- **Verify:** `grep -rn "recoverable\|handleFileError\|handleWorkerError" src` → only defs gone; tests green.

---

## 3. Remove unused retry framework — `retry.ts` (~-200 lines)
**Why:** only `retry()` (19 calls) and `withRetry()` used; rest is dead.
- [ ] Delete `RetryOperation`, `RetryConditions`, `RetryConfigs`,
  `retryWithErrorHandling`, `createDebouncedRetry` (all 0 prod callers).
- [ ] Keep `retry()` and `retry.ts`'s `withRetry` **only if** still used — NOTE:
  prod `withRetry` imports come from `error-handler.ts`, not `retry.ts`
  (`retry.ts`'s `withRetry` is referenced only in `retry.test.ts`). Confirm, then
  delete `retry.ts`'s `withRetry` too if truly test-only.
- [ ] Prune `retry.test.ts` to cover only what remains.
- **Files:** `src/lib/utils/retry.ts`, `src/lib/utils/retry.test.ts`.
- **Verify:** `grep -rn "RetryOperation\|RetryConfigs\|createDebouncedRetry" src` empty; tests green.

## 3b. De-duplicate `withRetry`
**Why:** defined in both `retry.ts:342` and `error-handler.ts:297`.
- [ ] Standardize on `error-handler.ts`'s `withRetry` (the one prod imports).
- [ ] After task 3, ensure only one definition survives.
- **Verify:** `grep -rn "export.*withRetry" src` → single hit.

---

## 4. Flatten error hierarchy — `typed-errors.ts` (~-180 lines)
**Why:** 22 classes, 14 used once; subclass-per-domain adds no behavior over a code field.
Higher-touch — do after 2 & 3 so the error surface is already smaller.
- [ ] Introduce `AppError { code: string; context?: Record<string,unknown> }`.
- [ ] Replace `new XxxError(...)` sites with `new AppError('XXX', ...)` (81 total
  instantiation sites across the tree — grep `new \w*Error(`).
- [ ] Keep any class that `instanceof` checks actually depend on; grep
  `instanceof .*Error` first and preserve those branches (convert to `code ===` checks).
- [ ] Update `error-handler.ts` `createTypedError` / category mapping accordingly.
- **Files:** `src/lib/utils/typed-errors.ts` (+ every `new *Error` call site).
- **Verify:** `grep -rn "instanceof .*Error" src` → all map to retained checks; tests green.
- **Risk:** medium — do in its own commit, lean on tests.

---

## 5. Collapse cache framework — `advanced-cache.ts` + `resource-manager.ts` (~-400 lines)
**Why:** `AdvancedCache<T>` + 3 subclasses; subclasses instantiated once in
`resource-manager`, whose public methods are never called (only `addObjectUrl`/`destroy`
via `globalResourceManager`).
**⚠ Correctness gate (from audit, not complexity):** `resource-manager` constructor
starts a live `setInterval` at line 114 (metrics) + `setTimeout` at 119. The caches feed
`performanceMonitor.addCacheMetrics`. Before deleting, confirm nothing depends on those
metrics being collected. Route this verification through a **normal review pass**, not this cleanup.
- [ ] Confirm no external reader of the cache metrics / eviction side-effects.
- [ ] If confirmed dead: delete `ImageBitmapCache`, `ImageDataCache`, `ArrayBufferCache`,
  and the generic `AdvancedCache`.
- [ ] Reduce `resource-manager.ts` to the object-URL tracking that's actually used
  (`addObjectUrl`, `destroy`, `globalResourceManager`); drop the metrics interval.
- [ ] Update `session-cleanup.ts` / `file-operations.ts` / `trait-upload-manager.ts` imports.
- **Files:** `src/lib/utils/advanced-cache.ts`, `src/lib/stores/resource-manager.ts`,
  `src/lib/utils/session-cleanup.ts`.
- **Verify:** app boots; object-URL cleanup on session end still fires; tests green.
- **Risk:** high — separate commit, gated on the review above.

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
