# GNStudio Generation Workflow — Technical Analysis

> **Scope:** End-to-end generation pipeline from UI trigger through ZIP export and gallery persistence.  
> **Date:** 2025-05-05  
> **Critical Finding:** Memory is the primary bottleneck; unbounded `allImages[]` accumulation limits practical collection size to ~3–5K items on typical hardware (8 GB RAM).

---

## 1. Architecture Map

### 1.1 Data Flow (Generation Pipeline)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UI Layer                                                                    │
│  GenerationForm.svelte ──handleGenerate()──► worker.service.ts              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Domain Layer                                                                │
│  worker.service.ts ──prepareLayersForWorker()──► generation.worker.client.ts│
│    • Validates traits & imageData                                            │
│    • Clones every trait ArrayBuffer (line 34-37 project.domain.ts)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Orchestration Layer (Main Thread)                                           │
│  generation.worker.client.ts                                                 │
│    1. Creates CSPSolver, pre-solves ALL combinations sequentially            │
│    2. TraitBatchScheduler.scheduleBatches(solutions, batchSize=50)           │
│       ──postMessageToPool()──► worker.pool.ts                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Worker Pool Layer                                                           │
│  worker.pool.ts                                                              │
│    • Dynamic pool: 1–10 workers (device-dependent)                           │
│    • Task queue with complexity-based dispatch                               │
│    • Health checks, restarts, work-stealing load balancing                   │
│    • cloneSerializableData() for message sanitization                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Worker Execution Layer                                                      │
│  generation.worker.ts                                                        │
│    • Receives batch + full layers array (with imageData)                     │
│    • createImageBitmapFromBuffer() → caches ImageBitmap per trait            │
│    • compositeTraitsDirect() → OffscreenCanvas compositing                   │
│    • canvas.convertToBlob() → ArrayBuffer                                    │
│    • Returns images[] + metadata[] via postMessage(transferables)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  State Accumulation Layer                                                    │
│  generation-progress.svelte.ts                                               │
│    • addImages() → generationState.allImages[] (unbounded ArrayBuffer[])     │
│    • addMetadata() → generationState.allMetadata[] (unbounded object[])      │
│    • sessionStorage auto-save (excludes images, stores progress only)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Export Layer                                                                │
│  export.service.ts                                                           │
│    • Standard ZIP (≤1K items) → all in memory                                │
│    • Optimized ZIP (1K–3K) → chunked JSZip build                             │
│    • Multi-ZIP (>3K or >500KB/item) → size-based splitting                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Gallery Persistence Layer                                                   │
│  gallery-db.ts + gallery.store.svelte.ts                                     │
│    • IndexedDB: stores metadata ONLY (imageData stripped)                    │
│    • ObjectUrlCache: blob/data URL cache for active viewing                  │
│    • Image data is LOST on page refresh — must re-import from ZIP            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key File Responsibilities

| File                            | Role                                                             | Lines |
| ------------------------------- | ---------------------------------------------------------------- | ----- |
| `GenerationForm.svelte`         | UI trigger, message handler delegation, ZIP packaging            | 347   |
| `project.store.svelte.ts`       | Project mutation, batch persistence, trait loading               | 534   |
| `generation-progress.svelte.ts` | Generation session state, accumulation, sessionStorage auto-save | 773   |
| `gallery.store.svelte.ts`       | Collections, filtering, rarity, IndexedDB gallery persistence    | 802   |
| `generation.worker.client.ts`   | Main-thread orchestration: pre-solve + dispatch                  | 153   |
| `generation.worker.ts`          | Canvas compositing, PNG blob creation, per-worker caches         | 359   |
| `worker.pool.ts`                | Dynamic worker pool, health checks, task queue, cloning          | 1293  |
| `csp-solver.ts`                 | AC-3 + MRV constraint solver with bit-packed uniqueness          | 929   |
| `trait-batch-scheduler.ts`      | Batch chunking (50 items) and pool submission                    | 106   |
| `persistence.service.ts`        | Differential project persistence (metadata vs assets)            | 217   |
| `export.service.ts`             | ZIP packaging (standard/optimized/multi-zip)                     | 315   |
| `object-url-cache.ts`           | Blob/data URL cache for gallery                                  | 455   |
| `gallery-db.ts`                 | IndexedDB gallery CRUD (metadata only)                           | 176   |
| `performance-monitor.ts`        | Metrics, timers, cache/DB/memory tracking                        | 701   |

---

## 2. Bottleneck Analysis

### 2.1 Memory Bottlenecks (CRITICAL)

| #   | Location                                | Issue                                                                                     | Impact                                        |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| M1  | `generation-progress.svelte.ts:327-345` | `allImages[]` and `allMetadata[]` grow unbounded until ZIP packaging                      | OOM at ~3–5K items on 8GB RAM                 |
| M2  | `project.domain.ts:34-37`               | Every trait ArrayBuffer is cloned once per generation start                               | Doubles trait memory footprint transiently    |
| M3  | `generation.worker.ts:18-21`            | Per-worker `imageBitmapCache` and `WorkerArrayBufferCache` — duplicated N× across workers | N workers × cache size = linear memory growth |
| M4  | `trait-batch-scheduler.ts:54-89`        | Every batch message includes **full `layers` array** with all `imageData`                 | Massive redundant transfer per batch          |
| M5  | `object-url-cache.ts:110-115`           | Large collections use base64 data URLs (33% overhead)                                     | Inflates memory for gallery display           |
| M6  | `csp-solver.ts:621-636`                 | `snapshotDomains()` clones entire domain state on every backtrack step                    | High GC pressure during constraint solving    |
| M7  | `gallery-db.ts:64-76`                   | Gallery stores metadata only; imageData is `new ArrayBuffer(0)`                           | User loses all images on refresh              |

**Memory Math (10K collection, 5 layers, 1MB PNG each):**

- `allImages[]`: 10K × ~200KB (PNG) ≈ **2 GB**
- `allMetadata[]`: 10K × ~2KB (JSON) ≈ **20 MB**
- Worker caches (4 workers): 4 × 100MB ≈ **400 MB**
- Batch message duplication: 200 batches × 50MB (layers) ≈ transient **10 GB** over generation lifetime
- **Total peak: >2.5 GB sustained + transient spikes**

### 2.2 CPU Bottlenecks (HIGH)

| #   | Location                          | Issue                                                                               | Impact                                                    |
| --- | --------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| C1  | `csp-solver.ts:86-117`            | Entire CSP solving runs on **main thread** before any worker starts                 | Blocks UI for large collections; 10K solves can take 30s+ |
| C2  | `csp-solver.ts:550-555`           | `getAssignmentKey()` uses `JSON.stringify()` + `Array.sort()` on every backtrack    | O(n log n) per call; dominates solver CPU                 |
| C3  | `worker.pool.ts:95-138`           | `cloneSerializableData()` manually deep-clones instead of `structuredClone`         | Slower, incomplete (no Map/Set/Error support), higher CPU |
| C4  | `generation.worker.ts:54-72`      | `createImageBitmapFromBuffer()` creates Blob + ImageBitmap for every trait per item | ImageBitmap creation is GPU/CPU intensive                 |
| C5  | `gallery.store.svelte.ts:181-341` | `filteredAndSortedItems` getter rebuilds trait index on first filter per collection | O(n×m×k) scan, acceptable but recalculates unnecessarily  |

### 2.3 Serialization / Transfer Bottlenecks (HIGH)

| #   | Location                         | Issue                                                                                        | Impact                                                                      |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| T1  | `trait-batch-scheduler.ts:74-85` | Batch message payload includes redundant `layers` with all `imageData`                       | Every batch re-transfers all layer assets                                   |
| T2  | `worker.pool.ts:888-908`         | `postMessage()` clones payload again via `cloneSerializableData()`                           | Double-cloning overhead                                                     |
| T3  | `generation.worker.ts:263-292`   | `transferrables` extraction happens after blob→ArrayBuffer conversion                        | PostMessage can transfer the ArrayBuffer directly, but timing is suboptimal |
| T4  | `project.domain.ts:29-65`        | `prepareLayersForWorker()` creates clean ArrayBuffers one-by-one with manual Uint8Array copy | Inefficient byte copying; could use `slice()` or `structuredClone`          |

### 2.4 I/O & Storage Bottlenecks (MEDIUM)

| #   | Location                       | Issue                                                                      | Impact                                        |
| --- | ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------- |
| I1  | `persistence.service.ts:57-86` | No dirty tracking — saves **all layers** on every edit                     | Full IndexedDB rewrite for every trait rename |
| I2  | `persistence.service.ts:61`    | `metadataJson !== lastSavedMetadata` compares full JSON strings            | Stringifies entire project on every persist   |
| I3  | `gallery-db.ts:46-79`          | Deep clones collection via `JSON.parse(JSON.stringify(...))` on every save | Blocks main thread for large collections      |
| I4  | `export.service.ts:155-243`    | Multi-ZIP creates intermediate `Blob` objects for each ZIP part            | Memory spikes during ZIP generation           |

### 2.5 Concurrency & Worker Bottlenecks (MEDIUM)

| #   | Location                       | Issue                                                                                      | Impact                                               |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| W1  | `trait-batch-scheduler.ts:54`  | Hard-coded `batchSize = 50`                                                                | Doesn't adapt to worker count or device capabilities |
| W2  | `worker.pool.ts:929-1026`      | Initializes **all** `maxWorkers` upfront                                                   | Slow startup; should warm lazily                     |
| W3  | `worker.pool.ts:653-683`       | `findBestWorkerForTask()` uses total `taskCount` (historical) not active tasks             | Work-stealing is inaccurate                          |
| W4  | `generation.worker.ts:293-302` | Sends **two** `complete` messages per batch (one with data, one empty)                     | Wastes message processing; confusing protocol        |
| W5  | `worker.pool.ts:410-432`       | `reassignWorkerTasks()` puts failed tasks at queue head but doesn't preserve transferables | Reassigned tasks may lose ArrayBuffer ownership      |

### 2.6 Rendering Bottlenecks (LOW)

| #   | Location                     | Issue                                               | Impact                                                    |
| --- | ---------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| R1  | `generation.worker.ts:144`   | `willReadFrequently: true` on canvas context        | Unnecessary for write-only compositing; may slow GPU path |
| R2  | `generation.worker.ts:56-64` | ImageBitmap options include `resizeQuality: 'high'` | Quality is good but slower; could be configurable         |

---

## 3. Correctness & Stability Risks

### 3.1 Race Conditions

| ID     | Location                                | Risk                                                                                          | Likelihood |
| ------ | --------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| RACE-1 | `worker.pool.ts:154-160`                | `cancelGeneration()` terminates pool then immediately re-initializes it                       | Medium     |
| RACE-2 | `worker.pool.ts:598-603`                | Terminal message handling falls back to worker-index matching when taskId fails               | Medium     |
| RACE-3 | `generation-progress.svelte.ts:327-345` | `addImages()` doesn't check if component is destroyed; background accumulation continues      | High       |
| RACE-4 | `worker.pool.ts:1001-1007`              | Worker init promise rejection pushes `null` worker but index is already consumed by `.push()` | Low        |

### 3.2 Stale / Incorrect State

| ID      | Location                         | Risk                                                                                                  |
| ------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| STALE-1 | `csp-solver.ts:665-685`          | `impossibleCombinations` cache is unbounded (max 1000 entries) but `getAssignmentKey()` is O(n log n) |
| STALE-2 | `object-url-cache.ts:65-76`      | Blob URL TTL is 30s but DOM images may outlive it; lazy revocation can cause `ERR_FILE_NOT_FOUND`     |
| STALE-3 | `gallery-db.ts:110`              | `imageData: new ArrayBuffer(0)` means gallery items are visually broken after refresh                 |
| STALE-4 | `project.store.svelte.ts:77-129` | Batch queue processes without validation that queued updates are still applicable                     |

### 3.3 Edge Cases & Failure Modes

| ID     | Scenario                                              | Current Behavior                                             |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------ |
| EDGE-1 | CSP solver exhausts valid combinations mid-generation | Throws error, cancels entire generation                      |
| EDGE-2 | Worker pool loses all workers (all ERROR state)       | Tasks remain queued forever; no timeout                      |
| EDGE-3 | `sessionStorage` quota exceeded during auto-save      | Silently caught, no user feedback                            |
| EDGE-4 | `createImageBitmap()` fails for corrupted PNG         | Logs error, skips trait, produces incomplete image           |
| EDGE-5 | User refreshes during background generation           | All progress lost; workers terminated by browser             |
| EDGE-6 | Collection size > 50K with strict pairs               | Solver may take minutes; no progress indication during solve |

---

## 4. Improvement Roadmap

### 4.1 P0 — Critical (Address First)

| #    | Change                                                           | File(s)                                                                  | Effort | Expected Impact                                       |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------------- |
| P0-1 | **Stream images to IndexedDB instead of accumulating in memory** | `generation-progress.svelte.ts`, `gallery-db.ts`                         | Medium | Eliminates M1; enables 10K+ collections               |
| P0-2 | **Transfer layers once, reference by ID in batches**             | `trait-batch-scheduler.ts`, `generation.worker.ts`, `worker-messages.ts` | Medium | Eliminates T1/M4; ~80% reduction in transfer overhead |
| P0-3 | **Use `structuredClone` instead of `cloneSerializableData`**     | `worker.pool.ts`                                                         | Low    | Fixes C3; faster, correct, native                     |
| P0-4 | **Add dirty tracking to persistence service**                    | `persistence.service.ts`, `project.store.svelte.ts`                      | Medium | Eliminates I1; faster saves                           |

### 4.2 P1 — High Priority

| #    | Change                                                     | File(s)                                        | Effort | Expected Impact                                     |
| ---- | ---------------------------------------------------------- | ---------------------------------------------- | ------ | --------------------------------------------------- |
| P1-1 | **Move CSP solver to Web Worker**                          | `csp-solver.ts`, `generation.worker.client.ts` | High   | Eliminates C1; unblocks UI during solve             |
| P1-2 | **Adaptive batch sizing based on worker count**            | `trait-batch-scheduler.ts`, `worker.pool.ts`   | Low    | Eliminates W1; better worker utilization            |
| P1-3 | **Shared trait cache across workers**                      | `generation.worker.ts`, `worker.pool.ts`       | High   | Eliminates M3; SharedArrayBuffer or IndexedDB cache |
| P1-4 | **Store gallery image data in IndexedDB**                  | `gallery-db.ts`, `gallery.store.svelte.ts`     | Medium | Eliminates M7/STALE-3; images survive refresh       |
| P1-5 | **Optimize `getAssignmentKey()` with incremental hashing** | `csp-solver.ts`                                | Medium | Eliminates C2; faster backtracking                  |

### 4.3 P2 — Medium Priority

| #    | Change                                                          | File(s)                                       | Effort | Expected Impact                    |
| ---- | --------------------------------------------------------------- | --------------------------------------------- | ------ | ---------------------------------- |
| P2-1 | **Lazy worker pool initialization**                             | `worker.pool.ts`                              | Low    | Eliminates W2; faster app startup  |
| P2-2 | **Remove duplicate complete message in worker**                 | `generation.worker.ts`                        | Low    | Eliminates W4; cleaner protocol    |
| P2-3 | **Use `slice()` or transfer instead of manual Uint8Array copy** | `project.domain.ts`                           | Low    | Eliminates T4; faster payload prep |
| P2-4 | **Add task queue timeout and drain detection**                  | `worker.pool.ts`                              | Low    | Fixes EDGE-2                       |
| P2-5 | **Compress gallery images with WebP for storage**               | `gallery-db.ts`, `generation.worker.ts`       | Medium | Reduces gallery storage by ~50%    |
| P2-6 | **Offload ZIP generation to dedicated worker**                  | `zip.worker.ts` (exists), `export.service.ts` | Medium | Unblocks main thread during export |

### 4.4 P3 — Low Priority / Polish

| #    | Change                                                      | File(s)                                         | Effort  | Expected Impact                      |
| ---- | ----------------------------------------------------------- | ----------------------------------------------- | ------- | ------------------------------------ |
| P3-1 | **Remove `willReadFrequently` from compositing canvas**     | `generation.worker.ts`                          | Trivial | Minor render perf gain               |
| P3-2 | **Add generation resume capability (IDBGallery + session)** | `generation-progress.svelte.ts`                 | High    | Better UX for large collections      |
| P3-3 | **Predictive trait loader — actually preload ImageBitmaps** | `predictive.loader.ts`, `generation.worker.ts`  | Medium  | The class exists but doesn't preload |
| P3-4 | **Configurable ImageBitmap resize quality**                 | `generation.worker.ts`, `performance.config.ts` | Low     | Trade quality for speed              |

---

## 5. Benchmark Targets

| Scenario | Collection Size | Layers | Resolution | Current (est.) | Target        |
| -------- | --------------- | ------ | ---------- | -------------- | ------------- |
| Small    | 100             | 3      | 500×500    | 2s             | <1s           |
| Medium   | 1,000           | 5      | 1000×1000  | 15s            | <5s           |
| Large    | 5,000           | 8      | 1500×1500  | 90s + OOM risk | <30s, stable  |
| Stress   | 10,000          | 10     | 2000×2000  | Crashes        | <120s, stable |

**Measurement methodology:**

- Time from "Generate" click to ZIP download start
- Peak JS heap size via `performance.memory`
- Worker utilization % (active time / total time)
- UI frame drops during generation (target: <2 dropped frames)

---

## 6. Rollout Strategy

### Phase 1: Safe Wins (No behavior change)

1. Replace `cloneSerializableData` with `structuredClone` (P0-3)
2. Remove duplicate complete message (P2-2)
3. Remove `willReadFrequently` (P3-1)
4. Add lazy worker init (P2-1)

### Phase 2: Memory Relief (Feature-flagged)

1. Behind `enableStreamingStorage` flag: stream images to IndexedDB instead of `allImages[]` (P0-1)
2. Behind `enableLayerRef` flag: transfer layers once, batch by reference (P0-2)
3. Enable dirty tracking in persistence (P0-4)

### Phase 3: Performance (A/B tested)

1. Worker-based CSP solver (P1-1)
2. Adaptive batch sizing (P1-2)
3. Optimized assignment key hashing (P1-5)

### Phase 4: Architecture

1. Shared worker cache (P1-3) — requires `SharedArrayBuffer` + COOP/COEP headers
2. Gallery image persistence (P1-4)
3. ZIP worker offloading (P2-6)

---

## 7. Appendix: Detailed Findings

### A.1 `cloneSerializableData` vs `structuredClone`

```typescript
// Current (worker.pool.ts:95-138)
function cloneSerializableData(obj: unknown): unknown {
	if (obj instanceof ArrayBuffer) {
		const newBuffer = new ArrayBuffer(obj.byteLength);
		new Uint8Array(newBuffer).set(new Uint8Array(obj));
		return newBuffer;
	}
	// ...manual recursion for arrays, objects, dates
	// ❌ No Map, Set, RegExp, Error, circular reference support
}

// Recommended
const cleanPayload = structuredClone(task.message.payload);
// ✅ Native, faster, handles all types, preserves ArrayBuffers
```

### A.2 Batch Message Redundancy

Each batch of 50 items carries the full `layers` array with every trait's `imageData`. For a project with 5 layers × 20 traits × 1MB images = **100MB per batch**. With 200 batches for 10K items, that's **20GB of total transfer volume** (though garbage-collected, it creates massive GC pressure).

**Fix:** Send `layers` once during worker init; batch messages reference trait IDs only.

### A.3 CSP Solver Main-Thread Blocking

```typescript
// generation.worker.client.ts:86-117
for (let i = 0; i < collectionSize; i++) {
	const solutionMap = solver.solve(); // ← BLOCKS MAIN THREAD
	// ...
}
```

For 10K items with 8 layers and ruler constraints, this loop can run for 30–60 seconds with zero UI updates. The browser may show "Page Unresponsive".

**Fix:** Move solver to a dedicated worker, or use `requestIdleCallback` / `setTimeout(0)` yielding with progress callbacks.

### A.4 Gallery Image Loss on Refresh

```typescript
// gallery-db.ts:64-76
items: collection.items.map((item) => ({
	// ...metadata fields...
	// imageData EXCLUDED
}));
```

After refresh, `imageData` is `new ArrayBuffer(0)`. The gallery shows broken images unless the user re-imports from ZIP.

**Fix:** Store compressed image thumbnails in IndexedDB; store full images in a separate object store with lazy loading.

---

_End of Analysis_
