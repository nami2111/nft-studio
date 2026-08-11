# Generate Engine / Flow — Improvement Plan

Deep research of the generation pipeline (Jul 2026). Biggest wins first.
All findings verified against current code. Reference file: generation.orchestrator → trait-batch-scheduler → worker pool → generation.worker → export.

## TL;DR

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | Wire the dead `init-layers` / `batch-ref` (enableLayerRef) path | High — kills per-window re-copy of all trait buffers | M |
| 2 | Stop `warmUpWorkers` from capping pool at ~2 workers | High — doubles/thrid capability on 8-core machines | S |
| 3 | Keep `prepareLayersForWorker`'s `slice(0)` copies only as the transferred ref-mode buffers | High — removes triple memory of trait images | S |
| 4 | Prebuild layer-id→name Map for per-item metadata | Low — 5-line perf win | S |
| 5 | (Optional) Byte-adaptive chunk flush | Low | S |
| 6 | (Decide) Implement or delete the inert live-preview system | Housekeeping | S/M |

---

## 1. Enable layer-ref messaging (init-layers + batch-ref)

**Why.** `enableLayerRef` existed as a feature flag → was inlined to a constant and the *sender* never wired. Worker fully supports it (`handleInitLayers`, `resolveTraitRefs`, `batch-ref` handler in `generation.worker.ts`; pool has the `isInternal` init-layers guard in `pool.ts`). Nothing ever sends those messages, so the scheduler always posts `type:'batch'` with every solution's `trait.imageData`, and the pool deep-copies it twice per window:
`prepareLayersForWorker slice(0)` → `safeStructuredClone(payload)` (which re-slices ArrayBuffers again) → `postMessage` structured clone. Meanwhile the worker already caches decoded buffers (ArrayBuffer cache) + 64 ImageBitmaps across batches, so the re-sent bytes are discarded each time. For large/high-res collections this is the dominant cost: memory spikes + serialization + main-thread GC.

**Design (lazy but correct).**
- Clone-based single `init-layers`, not transfer. Reason: transferring the same buffer to N workers requires N main-thread copies anyway (a transferred buffer detaches and can't be reused), and ref-mode's real win is eliminating the *per-window* re-send. Revisit transfer-on-init later only if profiling demands it.
- Reference batched message types already exist in `src/lib/types/worker-messages.ts` (`InitLayersMessage`, `BatchRefMessage`). No type changes needed.

**Steps.**
1. `src/lib/workers/trait-batch-scheduler.ts`
   - Add an `initLayers(solutions)` phase: when a pool is ready, post **one** `{ type: 'init-layers', payload: { layers } }` task (layers incl. `imageData`, i.e. do NOT strip).
   - Post `{ type: 'batch-ref' }` per window instead of `batch`, with each solution reduced to `{ index, traitRefs: traits.map(t => ({ layerId: t.layerId, traitId: t.trait.id })) }`.
   - Keep the existing windowing + adaptive batch size unchanged.
   - Ensure `init-layers` completes before the first `batch-ref` dispatches (await the init postMessageToPool).
2. `src/lib/workers/pool/pool.ts`
   - `isInternal` guard for init-layers already suppresses forwarding (`task?.message?.type === 'init-layers'`). Verify + keep.
   - No dispatch changes needed (clone path works).
3. `src/lib/workers/generation.worker.ts`
   - Already handles both messages. Audit `batch-ref`: it rebuilds `layers` from `layerMap.values()` — make sure the full layer list (with imageData) is passed; currently it does. Confirm `init-layers` resets `layerMap`/`traitMap` (`handleInitLayers` clears first) — already true.
4. Remove the stale `enableLayerRef` constant/comment in `src/lib/config/feature-flags.ts` (already inlined; just delete the doc mention).

**Edge cases.**
- Empty layer/trait after init (project edited mid-run is not possible — generation locks the project config, so OK).
- Worker restart mid-run: fresh worker needs its own `init-layers`. `restartWorker`/`reassignWorkerTasks` re-queues the task — plan must re-dispatch init to replacement workers. Simplest safe approach: send `init-layers` once per generation *per worker index* (track which workers have been inited; re-init on restart). Keep a `Set<workerIndex>` in the scheduler for this.
- Single-session only (`_activeSession`) — no concurrency to coordinate.

**Tests.**
- Update `src/lib/workers/generation.orchestrator.test.ts`, `generation-worker-client.test.ts`, `pool/__tests__/tasks.test.ts` for the new message flow.
- Add `trait-batch-scheduler` coverage: init posted once per available worker, batch-ref windows carry only refs, ordering init→refs.

---

## 2. Fix warm-up pool capacity cap

**Why.** `+layout.svelte` calls `warmUpWorkers()` on mount. `warmUpWorkers` sets `maxWorkers = max(2, floor(coreCount/2)-2)` → 2 workers on 8-core machines. Orchestrator only re-inits when `totalWorkers < 2`; dynamic scaling is capped by `config.maxWorkers`. Result: generation runs at the tiny warm-up count forever, even though `initializeWorkerPool`'s default (and `getOptimalWorkerCount`, which is collection-aware and currently *unused*) would give cores-1 workers.

**Steps.**
1. `src/lib/workers/pool/pool.ts` — `warmUpWorkers`: don't shrink `maxWorkers` below the init default. Simplest: delegate to the same sizing as `initializeWorkerPool` (drop the `computedMax` clamp), or make `warmUpWorkers` call `initializeWorkerPool()` with no `maxWorkers` override.
2. Optional: in `runGeneration` (`generation.orchestrator.ts`) add `ensurePoolCapacity(collectionSize)` that scales the pool up to `getOptimalWorkerCount(collectionSize)` before scheduling — makes warmup irrelevant. Do the 1-line fix first; add capacity-scaling only if profiling shows it matters.
3. `getOptimalWorkerCount` is exported from pool but unused — wire it up here or delete it.

**Test.** Pool unit tests asserting warmed-up `maxWorkers` equals full init sizing.

---

## 3. Repurpose the `slice(0)` buffer copies

**Why.** `prepareLayersForWorker` (`src/lib/domain/project.domain.ts`) does `trait.imageData.slice(0)` — full copy of every trait buffer. Today nothing transfers those buffers (batch mode re-clones), nothing mutates store buffers, so the copies are pure waste: all trait images resident ×2 (×3 transiently per window). Under ref-mode (#1) these copies become the correct transfer/copy units owned by the worker path — but *only if* the store's originals stay referenced by the shell only and never get detached.

**Steps.**
1. After #1 lands, verify the `slice(0)` copies are the ones sent once in `init-layers` and keep the store buffers untouched.
2. Add a short comment in `project.domain.ts` explaining the copy exists to protect the store buffer from worker ownership/detach — so the next dev doesn't "optimize" it away.
3. If ref-mode proves the copy is still unnecessary (worker only reads, never detaches — true today), delete `slice(0)` and rely on `safeStructuredClone`'s own copy. Decide after measuring; do not do both.

No code change standalone.

---

## 4. Prebuild layer-id → name map for metadata

**Why.** `generateIsolatedItem` (generation.worker.ts) does `layers.find((l) => l.id === st.layerId)?.name` per trait per item. 10k items × ~10 traits × linear scan over layers.

**Steps.**
1. In `handleBatchGeneration`, once per batch: `const layerNameById = new Map(layers.map((l) => [l.id, l.name]));`
2. Pass `layerNameById` into `generateIsolatedItem`, replace `layers.find(...)?.name` with `layerNameById.get(st.layerId) ?? 'Unknown'`.

**Test.** Existing worker tests still pass (same output); add nothing new (trivial).

---

## 5. (Optional) Byte-adaptive chunk flush

`handleBatchGeneration` flushes every `CHUNK_FLUSH_SIZE = 10` images. For 5MB hi-res PNGs that's ~50MB held as blobs + converted to ArrayBuffers per flush. Threshold flush (e.g. 24MB) bounds worker memory better. Low priority; only if worker heap pressure observed.

---

## 6. (Decide) Live-preview system: implement or delete

Full plumbing exists (message emitters… no wait, nothing emits; routing + blob URLs + store + revoke) but **no worker ever sends `type:'preview'`** and nothing renders `generationState.previews`. It is 100% inert.
- **Option A — delete:** remove `PreviewMessage` from types, the `'preview'` branch in `routePoolMessage`, `onPreview` from `GenerationCallbacks` + `GenerationForm`, `previews`/`addPreviews`/revoke logic from `generation-progress.svelte.ts`. Touches ~4 files + their tests.
- **Option B — build:** worker posts small preview thumbnails per chunk (reuse the already-rendered canvas → downscale → `convertToBlob('png')` transfer), UI shows a flowing strip. Genuine feature value, but real work (throttling, retention cap, URL lifecycle).
Recommend A (YAGNI) unless live previews are on the roadmap. If building, cap stored previews (e.g. keep last 50) and revoke evicted URLs.

---

## Phasing & verification

1. **Phase 1 (ship):** #1 + #3 (they are one change) → verify no memory regression at scale.
2. **Phase 2:** #2 warm-up fix (one-liner core).
3. **Phase 3:** #4 map prebuild (while touching the worker).
4. **Phase 4 (decide):** #6.
5. Optional #5 only on evidence.

Verification order per AGENTS.md: `pnpm fmt` → `pnpm lint` → `pnpm test` → `pnpm build`. Manual: generate a 1000-item collection on a hi-res trait set; measure peak JS heap (worker + main) before/after in DevTools Performance recorder.

**Risks**
- Ref-mode shares buffer ownership between scheduler worker copies and store — keep the `slice(0)` copies isolated; never transfer the store's originals.
- Restart path must re-init the replacement worker (see #1 edge cases) or it will silently render nothing.
- Do not merge #3's copy removal and #1's transfer plan simultaneously without a decision comment.
