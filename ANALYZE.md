# GNStudio Generation Workflow Analysis (Repository: `src/`)

## 1) Executive summary

GNStudio’s generation pipeline is functionally rich (strict pair uniqueness, ruler constraints, metadata strategy support, worker-based rendering, ZIP export), but current implementation has **high serialization overhead**, **limited effective parallelism**, and several **correctness/cancellation risks** in orchestration.

At a high level today:

- UI trigger starts in `GenerationForm.svelte` and initializes persistent generation state (`generation-progress.svelte.ts`), then calls domain start (`domain/worker.service.ts`), then worker client (`workers/generation.worker.client.ts`).
- Trait combinations are **pre-solved on the main thread** with `CSPSolver` before rendering starts.
- Rendering is dispatched in batches to worker pool tasks (`trait-batch-scheduler.ts` → `worker.pool.ts` → `generation.worker.ts`).
- Worker returns chunked image+metadata payloads; UI accumulates all outputs in memory and then packages ZIP (`services/export.service.ts`).
- Project persistence is independent (`project.store.svelte.ts` + `persistence.service.ts`), while generation output is not durably persisted by default.

Key architectural strengths:

- Clear layering (UI/store/domain/worker).
- Advanced CSP support (AC-3 + backtracking + strict pair + ruler compatibility).
- Worker-side compositing via `OffscreenCanvas` and per-worker caching primitives.

Key constraints/issues affecting performance and reliability:

- Warm-up config in `routes/app/+layout.svelte` initializes pool with `maxWorkers: 1`, effectively forcing sequential rendering unless explicitly reinitialized.
- Heavy data duplication across boundaries (ArrayBuffers cloned multiple times per batch).
- Cancel/Background flow does not reliably stop active workers.
- Some progress/memory reporting and cache keys are inconsistent with runtime behavior.

---

## 2) Detailed flow map (modules, functions, data movement)

## A. UI and state entry

1. User clicks Generate in:
   - `src/lib/components/generation/GenerationControls.svelte`
   - callback handled in `src/lib/components/generation/GenerationForm.svelte::handleGenerate()`

2. Validation in `handleGenerate()`:
   - Ensures layers exist, output size set, no empty layers, and trait `imageData` present.

3. Session state initialization:
   - `startGeneration(...)` from `src/lib/stores/generation-progress.svelte.ts`
   - stores: session id, total items, status, batch flags, timing.

## B. Domain/service handoff

4. Domain start:
   - `src/lib/domain/worker.service.ts::startGeneration(...)`
   - prepares worker payload with `prepareLayersForWorker(...)` from `src/lib/domain/project.domain.ts`.

5. Data conversion:
   - `prepareLayersForWorker(...)` deep-copies each trait’s `imageData` into new `ArrayBuffer` and returns `TransferrableLayer[]`.

## C. Worker client orchestration

6. Worker pool init and message callback:
   - `src/lib/workers/generation.worker.client.ts::startGeneration(...)`
   - calls `initializeWorkerPool()` and sets a global `messageHandler`.

7. Constraint solving (main thread):
   - `CSPSolver` (`src/lib/workers/csp-solver.ts`) solves `collectionSize` times.
   - For each item: `solve()` + `markCombinationAsUsed()`.
   - Produces `solutions[]` (index + ordered traits).

8. Batch scheduling:
   - `TraitBatchScheduler.scheduleBatches(...)` in `src/lib/workers/trait-batch-scheduler.ts`
   - builds `BatchMessage` including **full `layers` payload** + subset of solutions.
   - dispatches via `postMessageToPool(...)`.

## D. Worker pool and task execution

9. Queue and assignment:
   - `src/lib/workers/worker.pool.ts`
   - `postMessageToPool` enqueues `WorkerTask`; `processNextTask()` selects worker.
   - `cloneSerializableData()` deep-copies payload before `worker.postMessage(...)`.

10. Worker-side batch render:
    - `src/lib/workers/generation.worker.ts::handleBatchGeneration(...)`
    - loops solutions, calls `generateIsolatedItem(...)`:
      - gets/reuses canvas from `OptimizedMemoryManager`
      - composites traits via `compositeTraitsDirect(...)`
      - decodes buffers with `createImageBitmapFromBuffer(...)`
      - generates metadata via `getMetadataStrategy(...).format(...)`
      - converts final canvas to PNG blob.

11. Worker result emission:
    - Sends `progress` periodically.
    - Sends `complete` with chunked `{images, metadata, isChunk: true}` (transferables for image buffers).
    - Sends terminal empty `complete` for task resolution.

## E. Main-thread accumulation and export

12. Message handling in form:
    - `GenerationForm.svelte::workerMessageHandler`
    - progress → `updateProgress(...)`
    - chunk complete → `addImages(...)`, `addMetadata(...)`
    - final scheduler complete (empty, non-chunk) triggers `packageZip(...)`.

13. ZIP packaging:
    - `src/lib/services/export.service.ts::ExportService.packageZip(...)`
    - standard or optimized/multi-zip path.
    - browser download via object URL.

## F. Persistence interactions

14. Project persistence (separate from generation output):
    - Writes via `project.store.svelte.ts` + `persistence.service.ts`.
    - Metadata skeleton stored via `SmartStorageStore`; layer assets in IndexedDB per layer.

15. Generation state persistence:
    - `generation-progress.svelte.ts` attempts sessionStorage autosave.
    - But `initialize()` resets state each page load, so refresh resume is intentionally not supported.

16. Session cleanup:
    - `src/lib/utils/session-cleanup.ts` clears local storage/indexedDB on unload/pagehide.

---

## 3) Bottleneck analysis

| Area | Current behavior | Why it hurts |
|---|---|---|
| CPU (main) | Pre-solves all items in `generation.worker.client.ts` using `CSPSolver` | Main thread can block before first rendered item; poor responsiveness for larger runs |
| CPU (serialization) | `prepareLayersForWorker` copies image buffers; `worker.pool.cloneSerializableData` copies again; structured clone copies per task | Multiplicative copy cost grows with traits x batches |
| CPU (worker) | `convertToBlob` + `blob.arrayBuffer()` per item in `generation.worker.ts` | Encode/copy path repeated per item; expensive at scale |
| Memory (main) | Accumulates all images+metadata in `generationState.allImages/allMetadata` before export | High peak heap; risk on large collections |
| Memory (worker) | ImageBitmap cache cleared every batch; key based on trait name/size | Re-decoding churn + potential incorrect key collisions |
| Worker utilization | Pool warmed with `maxWorkers: 1` in `routes/app/+layout.svelte`; subsequent init is no-op | Effective sequential rendering even though pool supports multiple workers |
| Worker overhead | Each batch message carries full `layers` + all trait image buffers | Large repeated payloads dominate transfer time |
| Progress/render UX | Progress uses `solution.index+1` from out-of-order batches | Non-monotonic progress and unstable ETA |
| Storage IO | `PersistenceService.saveProject` writes all layer assets on save cycle | Extra IndexedDB writes for unchanged layers |
| Export | ZIP and JSON stringification happen after all generation completes | Long tail latency; no streaming export pipeline |

---

## 4) Risks and correctness pitfalls

## Uniqueness and constraints

- **Fallback uniqueness collision risk**: `csp-solver.ts` fallback uses 32-bit numeric hash (`generateNumericHash`) for combinations; collisions are possible under high cardinality.
- **Optional-layer uniqueness gap**: strict pair/global checks skip combinations when required layers in rule are missing; optional-layer omissions can bypass uniqueness tracking.
- **`strictPairConfig.enabled` is not used in solver validation**: `csp-solver.ts` checks active layer combinations, not the top-level enabled flag; disable semantics can diverge from UI expectation.
- **Determinism not guaranteed**: `CSPSolver.getCandidates()` uses `Math.random()` weighted shuffle; runs are non-reproducible without seeding.

## Orchestration / race conditions

- **Cancel path incomplete**: UI cancel (`GenerationForm.svelte::handleCancel`) calls store `cancelGeneration()` only; does not call domain/worker cancel (`domain/worker.service.ts::cancelGeneration`). Workers may continue running.
- **Background overlap risk**: background mode can continue while user can start another generation; shared global message handler (`generation.worker.client.ts`) can lead to cross-session interference.
- **Global callback coupling**: single `messageHandler` variable in worker client is replaced per start; concurrent or overlapping sessions are unsafe.
- **Worker index accounting can drift under async init/failure paths**: `worker.pool.ts` pushes workers/placeholders as init promises settle, while some health/error arrays are indexed by original loop index; this can skew health/perf attribution and recovery behavior.

## Caching and image correctness

- **Image cache key collision risk** in `generation.worker.ts`: key uses `traitName + buffer.byteLength + resize`, not trait ID/content hash; distinct traits can collide and render wrong images.
- **WorkerArrayBufferCache eviction heuristic appears inverted** (`cache/array-buffer.cache.ts`): high-frequency/smaller entries can be evicted first, reducing hit rates.

## State/persistence

- **Partial persistence mutation paths**: ruler/type mutations in UI (`TraitTypeToggle.svelte`, `RulerRulesManager.svelte`) mutate project directly without explicit persistence schedule calls.
- **Autosave complexity mismatch**: generation state autosaves to sessionStorage while initialize resets on reload; adds overhead without true resume value.
- **Unload cleanup** (`session-cleanup.ts`) clears persisted data on tab close/pagehide; durability expectations can be surprising.

## UX responsiveness

- Non-monotonic progress and ETA due to out-of-order batch progress messages.
- Worker progress `memoryUsage` payload shape differs from `ProgressMessage` contract (`number` vs structured object), so UI memory telemetry can become invalid/NaN.
- Export progress counters in optimized ZIP path use mutated chunk lengths (progress text can be misleading).

---

## 5) Prioritized improvement plan (effort/impact)

## Quick wins (1-3 days, high ROI)

1. **Fix cancellation to terminate workers**
   - Wire `GenerationForm` cancel/background-timeout to `domain/worker.service.cancelGeneration()`.
   - Impact: correctness + CPU/memory relief.

2. **Enable real parallelism when desired**
   - Revisit warm-up config (`routes/app/+layout.svelte`) so generation can use >1 worker for render stage.
   - Impact: immediate throughput gain.

3. **Progress monotonicity fix**
   - Track max generated count or completed-item counter in store; ignore regressions.
   - Impact: stable ETA/progress UX.

4. **Cache key hardening in worker image decode path**
   - Use `trait.id` (+ layer id) instead of `trait.name` in bitmap cache key.
   - Impact: correctness + higher cache hit reliability.

## Medium-term (1-2 weeks, very high impact)

5. **Stop re-sending full layer payload per batch**
   - Send static layer atlas once per worker (init message), then batch messages only send trait IDs/indices.
   - Impact: major reduction in serialization/transfer overhead.

6. **Reduce deep-copy chain**
   - Remove redundant clones (`prepareLayersForWorker` + `cloneSerializableData` duplication), and use transferables strategically.
   - Impact: lower main-thread CPU and GC pressure.

7. **Make generation session orchestration explicit**
   - Introduce per-session IDs and scoped callbacks in worker client/pool to prevent cross-session message contamination.
   - Impact: race-condition reduction.

## Larger refactors (2-6 weeks, strategic)

8. **Pipeline solving + rendering (streaming) instead of full pre-solve array**
   - Solve incrementally in worker or in producer-consumer chunks; avoid storing full `solutions[]`.
   - Impact: lower startup latency and memory footprint.

9. **Streaming export architecture**
   - Write ZIP chunks progressively (or worker-based archive assembly) to avoid keeping all outputs in app state.
   - Impact: major memory reduction for large collections.

10. **Deterministic mode support**
   - Seeded PRNG + stable candidate ordering when `deterministic=true`; preserve reproducible output ordering.
   - Impact: reproducibility for enterprise/CI use.

---

## 6) Sequential generation performance recommendations (while preserving determinism/ordering)

Given current behavior (often effectively single worker), optimize the **sequential hot path** first:

1. **Introduce explicit sequential mode config**
   - Keep one worker intentionally, but optimize pipeline for it.
   - Add option: `mode: 'sequential' | 'parallel'`, `deterministic: boolean`, `seed?: string`.

2. **Deterministic trait selection**
   - In `CSPSolver.getCandidates()`, replace raw `Math.random()` with seeded PRNG when deterministic mode enabled.
   - Preserve stable layer and trait iteration ordering.

3. **Stream solutions, do not precompute all**
   - Generate next solution only when worker is ready for next item/batch.
   - Maintains strict ordering naturally (`index` monotonic), lowers memory.

4. **Minimize per-item serialization**
   - Worker keeps layer atlas in memory after one init transfer.
   - Runtime payload per item/batch becomes compact IDs instead of full trait objects with image buffers.

5. **Keep decode caches alive across batches**
   - Replace per-batch `clearImageBitmapCache()` with bounded LRU by memory cap.
   - Significant sequential speedup when traits repeat.

6. **Order-preserving output buffer**
   - Maintain indexed output slots; flush contiguous completed indexes.
   - Ensures deterministic ZIP ordering and metadata pairing even if parallel mode later enabled.

---

## 7) Suggested instrumentation & benchmark plan

## Where to instrument (concrete files/functions)

- `GenerationForm.svelte::handleGenerate` / final package completion
  - End-to-end wall time, cancellation latency, UI blocked time.
- `generation.worker.client.ts`
  - Pre-solve total time, solve ms/item, solved count.
- `worker.pool.ts`
  - Queue wait time, dispatch time, task duration, worker utilization, task retries/reassignments.
- `generation.worker.ts`
  - Per-item timings: decode, composite, encode, metadata build.
  - Batch payload bytes out.
- `trait-batch-scheduler.ts`
  - Batch count/size, scheduling overhead.
- `export.service.ts`
  - Packaging throughput (files/sec, MB/sec), peak memory during export.
- `generation-progress.svelte.ts`
  - Progress monotonicity violations, ETA error against actual completion.

## Core metrics

- Throughput: items/sec (overall and render-only).
- Startup latency: click-to-first-generated-chunk.
- Serialization cost: input bytes copied/transferred per generated item.
- Peak heap (main + worker where available).
- Cancel latency: cancel-click to no-active-workers.
- Determinism check: same seed => identical ordered trait IDs + metadata hashes.

## Suggested acceptance thresholds (relative and practical)

- **+30% items/sec** in sequential mode on baseline test project.
- **-40% click-to-first-item latency** for 1k item run.
- **-50% input serialization bytes/item** after atlas-once design.
- **0 progress regressions** (monotonic count guarantee).
- **<500 ms cancel latency** after fix.
- **Determinism pass rate 100%** for repeated seeded runs.

---

## 8) Optional roadmap (phased) + rollback considerations

| Phase | Scope | Expected impact | Rollback strategy |
|---|---|---|---|
| Phase 1 | Cancel fix, monotonic progress, cache key fix, worker-count config | High correctness + immediate UX/perf gains | Feature flags per change (`deterministic`, `parallelEnabled`, `strictCancel`) |
| Phase 2 | Static layer atlas transfer + reduced cloning + scoped sessions | Major CPU/memory improvements | Keep legacy message format path for fallback |
| Phase 3 | Streaming solve/render + streaming export + seeded deterministic engine | Largest scalability improvement | Dual pipeline support (legacy pre-solve path retained until parity proven) |

Rollback notes:

- Keep old and new orchestration behind runtime flags.
- Log both old/new metrics during canary period.
- Add snapshot tests for deterministic output and uniqueness to prevent regressions.

---

## Closing note

This analysis is based on direct inspection of the current repository implementation, especially:

- `src/lib/components/generation/*`
- `src/lib/stores/generation-progress.svelte.ts`
- `src/lib/domain/worker.service.ts`
- `src/lib/workers/{generation.worker.client.ts,trait-batch-scheduler.ts,worker.pool.ts,generation.worker.ts,csp-solver.ts}`
- `src/lib/services/export.service.ts`
- `src/lib/services/persistence.service.ts`
- `src/lib/persistence/storage.ts`
- `src/lib/utils/session-cleanup.ts`

If needed, next step can be a concrete execution spec (`PERF_PLAN.md`) with exact API changes and staged PR slices.