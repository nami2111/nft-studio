# TODO.md — NFT Studio Generation Flow Improvement Plan

> Generated from deep codebase analysis on 2026-06-20.
> Scope: generation pipeline, worker orchestration, CSP solving, state management, dead code.

---

## 🐛 P0 — Critical Bugs

### 1. `onComplete` fires twice, causing duplicate success toast

**Root cause:** The orchestrator calls `callbacks.onComplete()` explicitly at end of `runGeneration` (line 207), AND the worker pool bridge (`routePoolMessage`) also calls `callbacks.onComplete()` when a `'complete'` message arrives from a worker (line 450). Both paths hit `showSuccess()`.

**Fix:**
- Remove the explicit `callbacks.onComplete({ images: [], metadata: [] })` at `generation.orchestrator.ts:207`. The worker pool's `'complete'` message already routes through `routePoolMessage` → `callbacks.onComplete`. The explicit call is a leftover from before the pool bridge was wired.
- Alternative: keep the explicit call but guard `routePoolMessage` from re-forwarding the final `'complete'` by checking if the session is already finalized.

**Files:**
- `src/lib/workers/generation.orchestrator.ts` — remove/guard line 207

---

### 2. Streamer `onProgress` reports `collectionSize` as `generatedCount` at creation, corrupting progress bar

**Root cause:** In `runGeneration` (lines 167-176), the streamer's `onProgress` callback is created with `generatedCount: config.collectionSize` — it fires immediately during CSP solving, showing 100% progress before any images are rendered.

**Fix:**
- Set `generatedCount: 0` (or omit it) in the streamer's `onProgress` callback. The CSP solver sends its own progress messages separately. The streamer's progress should only report packaging/finalization progress.
- Better: make the streamer's `onProgress` only fire during `finalize()`, not during `start()`. The start/cancel methods don't need progress reporting.

**Files:**
- `src/lib/workers/generation.orchestrator.ts:167-176` — fix `generatedCount` value
- `src/lib/workers/result-streamer.ts` — optional: remove `onProgress` from `start()`

---

### 3. `parseIndexFromName` doesn't strip file extension, fragile to filename changes

**Root cause:** `parseInt("42.png", 10)` returns `42` (partial parse), but `parseInt("item-42.png")` returns `NaN` → falls back to `0`. All indices silently resolve to `0` if the naming format changes, corrupting the session manifest.

**Fix:**
```typescript
function parseIndexFromName(name: string | undefined): number {
  if (!name) return 0;
  // Strip extension and extract numeric portion
  const base = name.replace(/\.[^.]+$/, '');
  const match = base.match(/\d+/);
  if (!match) return 0;
  const num = parseInt(match[0], 10);
  return Number.isNaN(num) ? 0 : num - 1;
}
```

**Files:**
- `src/lib/workers/generation.orchestrator.ts:351-355`

---

## 🟠 P1 — Tech Debt (High Impact)

### 4. Remove dead code (~1,500+ lines across 9 files)

| File | Symbol | Reason |
|------|--------|--------|
| `src/lib/utils/object-url-cache.ts` | `ObjectUrlCache` | 0 callers — full file |
| `src/lib/utils/sprite-packer.ts` | `SpritePacker` | 0 callers — full file |
| `src/lib/utils/advanced-cache.ts` | `AdvancedCache` | 0 callers — full file |
| `src/lib/components/preview/canvas-renderer.ts` | `CanvasRenderer` | 0 callers — full file |
| `src/lib/components/preview/trait-selector.ts` | `TraitSelector` | 0 callers — full file |
| `src/lib/components/preview/image-cache.ts` | `ImageCache` | Only called by dead `CanvasRenderer` — full file |
| `src/lib/components/monitor/CacheMonitor.svelte` | `CacheMonitor` | lazy-loaded but never rendered — full file |
| `src/lib/components/monitor/PerformanceMonitor.svelte` | `PerformanceMonitor` | lazy-loaded but never rendered — full file |
| `src/lib/workers/image-loader.worker.ts` | image-loader worker | No direct imports (Preview.svelte spawns by URL string, but also has inline worker creation) — verify and remove |

**Before deleting, verify:**
- Search for any dynamic `import()` references to these files
- Check `vite.config.ts` for any worker entry points
- Run full test suite after removal

**Files to delete:**
- `src/lib/utils/object-url-cache.ts`
- `src/lib/utils/sprite-packer.ts`
- `src/lib/utils/advanced-cache.ts`
- `src/lib/components/preview/canvas-renderer.ts`
- `src/lib/components/preview/trait-selector.ts`
- `src/lib/components/preview/image-cache.ts`
- `src/lib/components/monitor/CacheMonitor.svelte`
- `src/lib/components/monitor/PerformanceMonitor.svelte`

**Files to update:**
- `src/routes/app/+page.svelte` — remove `loadCacheMonitor`, `loadPerformanceMonitor`, `CacheMonitor`/`PerformanceMonitor` variables, and the `onMount` dev-mode preload
- `src/lib/workers/image-loader.worker.ts` — verify no references, then remove

---

### 5. Wire store `cancelGeneration` to orchestrator session

**Root cause:** `generation-progress.svelte.ts` `cancelGeneration()` only resets reactive state. It does NOT terminate the worker pool or cancel the active generation session. If a component calls `generationStore.actions.cancelGeneration()`, the orchestrator's `_activeSession` is left orphaned and workers continue running.

**Fix:**
- The store's `cancelGeneration()` should import and call the orchestrator's `cancelGeneration()` before resetting state.
- Or: the form's cancel handler should call the orchestrator first, then the store.
- Currently the form's `handleCancel` already calls `cancelGeneration()` from the orchestrator. Remove the store's standalone `cancelGeneration` export and rename it to `resetState` (which it already does internally).

**Files:**
- `src/lib/stores/generation-progress.svelte.ts` — `cancelGeneration` should delegate to orchestrator
- `src/lib/components/generation/GenerationForm.svelte` — verify cancel flow

---

### 6. Guard all console statements with `import.meta.env.DEV` checks

**Affected files (no DEV guard):**
- `src/lib/workers/csp-solver.ts:150` — `console.error` on every solve when layerCount === 0
- `src/lib/workers/generation.worker.ts:131,137,197` — `console.warn` in generateIsolatedItem
- `src/lib/workers/generation.worker.ts:115,223` — `console.error` in worker
- `src/lib/workers/pool/pool.ts:182,217-234` — `console.warn`/`console.error` in pool

**Fix:** Wrap each with `if (import.meta.env.DEV) { ... }` or use a conditional logger.

---

## 🟡 P2 — Tech Debt (Medium Impact)

### 7. Remove duplicate project validation in `handleGenerate`

**Root cause:** `GenerationForm.handleGenerate` validates layers/traits at lines 211-230, then `prepareLayersForWorker` in `project.domain.ts` validates the same things at lines 13-27.

**Fix:** Remove the inline validation block (lines 211-230) in `handleGenerate`. Let `prepareLayersForWorker` throw descriptive errors. Catch them in the try/catch at line 266 and display them via `showError`.

**Files:**
- `src/lib/components/generation/GenerationForm.svelte` — remove lines 211-230
- `src/lib/domain/project.domain.ts` — ensure error messages are user-friendly

---

### 8. Rename `GenerationWorkerMessage` for clarity

**Current:** `GenerationWorkerMessage` is the type for messages TO workers.
**Problem:** Name suggests it covers all worker messages, but outgoing messages use `OutgoingWorkerMessage`.

**Fix:** Rename `GenerationWorkerMessage` → `IncomingWorkerMessage` (or `WorkerIncomingMessage`).

**Files:**
- `src/lib/types/worker-messages.ts:187-193`
- `src/lib/workers/pool/pool.ts` (import/usage)
- `src/lib/workers/pool/types.ts` (import)

---

### 9. `TraitBatchScheduler` `onMessage` callback is dead code

**Root cause:** `scheduleBatches` checks `if (this.config.onMessage)` at line 211 and sends a `CompleteMessage` with empty arrays. But the orchestrator (line 190-199) never sets `onMessage` in the config. This code path is dead.

**Fix:** Either:
- Remove the `onMessage` callback and the `CompleteMessage` emission entirely, OR
- Wire it properly: the orchestrator should set `onMessage` to route completion events, but the worker pool already handles completion via `'complete'` messages from workers, so this is redundant. **Remove the code.**

**Files:**
- `src/lib/workers/trait-batch-scheduler.ts:211-222` — remove `onMessage` callback and `CompleteMessage` emission
- `src/lib/workers/trait-batch-scheduler.ts:47-49` — remove `onMessage` from `BatchConfig`

---

## 🟢 P3 — Optimizations & Polish (Low Impact)

### 10. Normalize feature flag naming convention

**Current:** Two flags use `VITE_DISABLE_*` naming (inverted), two use `VITE_ENABLE_*`.

| Flag | Default | Env var |
|------|---------|---------|
| `enableStreamingStorage` | ON | `VITE_DISABLE_STREAMING_STORAGE` |
| `enableAdaptiveBatchSize` | ON | `VITE_DISABLE_ADAPTIVE_BATCH_SIZE` |
| `enableLayerRef` | OFF | `VITE_ENABLE_LAYER_REF` |
| `enableZipWorkerOffloading` | OFF | `VITE_ENABLE_ZIP_WORKER_OFFLOADING` |

**Fix:** Standardize on `VITE_ENABLE_*` for all flags. For flags that default to ON, change the default to match the env var (or invert the logic).

**Files:**
- `src/lib/config/feature-flags.ts`

---

### 11. Offload CSP solving to a Web Worker for large collections

**Current:** `solveOnMainThread` runs on the main thread, yielding every 50 items for collections >= 200. For 10,000+ items with complex ruler constraints, this can freeze the UI for seconds.

**Proposed:** When `collectionSize > 500`, spawn a dedicated CSP worker. The worker receives the layer data, runs the solver, and posts back the solution array. The orchestrator awaits the result. This keeps the UI responsive and also allows the worker to be terminated after solving, freeing memory.

**Trade-off:** Transfer overhead for the layer data (but layer data is already being transferred to generation workers). CSP worker is a one-shot — spawn, solve, post result, terminate.

**Files:**
- New: `src/lib/workers/csp.worker.ts`
- `src/lib/workers/generation.orchestrator.ts` — conditional offload

---

### 12. `flushGenerationChunk` sends empty final completions

**Root cause:** `generation.worker.ts:336` — `if (images.length === 0 && !isFinal) return;` — when `isFinal` is true and images is empty, it still sends a `CompleteMessage` with empty arrays.

**Fix:** Guard the final flush too:
```typescript
if (images.length === 0 && metadata.length === 0 && !isFinal) return;
```

**Files:**
- `src/lib/workers/generation.worker.ts:335-336`

---

### 13. `memoryUsage` type handling in UI

**Root cause:** `GenerationState.memoryUsage` is `number | { used: number; available: number; units: string } | null`. The UI component `GenerationProgress.svelte` accesses it but doesn't handle the object form.

**Fix:** Add a derived `memoryUsageDisplay` in `GenerationProgress.svelte` that normalizes both forms:
```typescript
const memoryUsageDisplay = $derived.by(() => {
  const m = generationState.memoryUsage;
  if (m === null) return null;
  if (typeof m === 'number') return `${(m / 1024 / 1024).toFixed(0)} MB`;
  return `${m.used} / ${m.available} ${m.units}`;
});
```

**Files:**
- `src/lib/components/generation/GenerationProgress.svelte`

---

## 📊 Summary

| Priority | Count | Est. Effort |
|----------|-------|-------------|
| P0 (Critical Bugs) | 3 | ~2 hours |
| P1 (High Impact) | 3 | ~4 hours |
| P2 (Medium Impact) | 3 | ~3 hours |
| P3 (Optimizations) | 4 | ~6 hours |
| **Total** | **13** | **~15 hours** |

### Recommended Order of Work

1. **Session 1 (P0):** Fix `onComplete` double-fire, streamer progress, `parseIndexFromName`
2. **Session 2 (P1):** Remove dead code (9 files), fix store/orchestrator cancel sync, guard console statements
3. **Session 3 (P2):** Remove duplicate validation, rename types, remove dead scheduler callback
4. **Session 4 (P3):** Normalize feature flags, offload CSP to worker, fix empty completions, memory display