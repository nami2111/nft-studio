# TODO: Generation Pipeline Fixes & Optimizations
> Auto-generated from deep analysis of generation workflow  
> Last updated: 2026-05-10

---

## 🔴 P0 — Critical Bugs (Fix Immediately)

### [BUG-1] Hash Collisions in Combination Deduplication
**File**: `src/lib/workers/csp-solver.ts`  
**Lines**: 784–795 (`isValidCombination`), 903–907 (`markCombinationAsUsed`)  
**Problem**: Fallback to 32-bit `generateNumericHash()` for large trait sets causes birthday-paradox collisions. At 50k items collisions are guaranteed → solver falsely rejects valid combinations, fails or backtracks massively.  
**Fix**:
- Replace `generateNumericHash` fallback with a proper 64-bit (or 128-bit) hash
- OR: Increase `CombinationIndexer.pack()` to support more than 8 traits / 256 values per layer
- OR: Use `traitIds.sort().join('|')` string key directly in a separate `Set<string>` when bit-packing fails (trade memory for correctness)
- Add collision detection: track string→bigint mapping and detect when two different combos map to the same hash  
**Acceptance**: Generate 100k items with 10+ layers without "Exhausted all combinations" error

---

### [BUG-2] `predictDeadEnd()` Regex Never Matches
**File**: `src/lib/workers/csp-solver.ts`  
**Lines**: 712–716  
**Problem**: Searches for literal substring `"ruler"` in the assignment key, but the key is a concatenation of trait IDs (UUIDs). `"ruler"` never appears → prediction always returns `false`.  
**Fix**:
- Remove the broken `predictDeadEnd()` method entirely, OR
- Replace with a meaningful heuristic (e.g., check if remaining unassigned layers have empty domains, or check constraint density from `constraintInfluence`)
- Remove all references: `cacheImpossibleCombination()` line 685, `ImpossibleCombination.predictedDeadEnd` field, `performanceStats.predictedDeadEnds` counter  
**Acceptance**: Dead-end prediction either works correctly or is removed; no dead code

---

### [BUG-3] O(n²) Redundant `verifyAllConstraints()` on Every Solution
**File**: `src/lib/workers/csp-solver.ts`  
**Lines**: 500 (called from `optimizedBacktrack`), 805–828  
**Problem**: Checks ALL pairs of selected traits (O(n²)) on every completed solution. AC-3 already guarantees arc consistency during solving. For 30 layers × 10k solutions = ~9M wasted constraint checks.  
**Fix**:
- Wrap `verifyAllConstraints()` behind a debug flag (`enableDebugConstraintVerification`)
- Remove from production path — AC-3 + `isConsistent` during solving already guarantees correctness
- If kept for safety: only check newly assigned layers against existing ones (incremental), not all pairs  
**Acceptance**: No O(n²) verification in production; ~20% speedup on solve

---

## 🟠 P1 — Performance Optimizations (High Impact)

### [PERF-1] Full AC-3 Re-run on Every Backtrack Candidate
**File**: `src/lib/workers/csp-solver.ts`  
**Lines**: 528–536  
**Problem**: Every candidate trait assignment triggers a full AC-3 propagation over the entire constraint graph. With 20 candidates × 30 layers = O(C × L × D) per node.  
**Fix**:
- Implement incremental forward-checking: only propagate arcs from the newly assigned layer
- Maintain an "affected arcs" set updated after each assignment
- Fall back to full AC-3 only when forward-checking detects an empty domain
- Expected improvement: 5–10x speedup on backtracking in dense constraint graphs  
**Acceptance**: Measurable reduction in `ac3Iterations` and `backtracks` for 10k+ collections

---

### [PERF-2] `snapshotDomains()` Heavy Memory Allocation
**File**: `src/lib/workers/csp-solver.ts`  
**Lines**: 633–645  
**Problem**: Creates full copies of all domains (arrays, Maps, Sets) on every backtrack step. With 30 layers, each snapshot allocates ~90 objects. Under deep backtracking → massive GC pressure.  
**Fix**:
- Replace snapshot/restore with an **undo stack** (delta tracking):
  - Record only which traits were removed from which domains
  - On restore, push removed traits back
- Use typed arrays (`Uint16Array`) for domain tracking instead of `TransferrableTrait[]` copies  
**Acceptance**: 50%+ reduction in GC pauses; memory stays flat regardless of backtrack depth

---

### [PERF-3] `findBestWorkerForTask()` Is O(W × T) Per Assignment
**File**: `src/lib/workers/worker.pool.ts`  
**Lines**: 611–650  
**Problem**: For every task dispatch, iterates ALL active tasks for EACH available worker. With 10 workers and 1000 queued tasks = 10k filter ops per assignment.  
**Fix**:
- Maintain a `workerTaskCount: Map<number, number>` counter
- Increment on task assign, decrement on task complete (O(1) per operation)
- Replace `findBestWorkerForTask()` body with a simple counter lookup  
**Acceptance**: Worker selection O(W) instead of O(W × T)

---

### [PERF-4] `safeStructuredClone` Deep Traversal on Every Task
**File**: `src/lib/workers/worker.pool.ts`  
**Lines**: 838–961  
**Problem**: `sanitizeForClone()` recursively walks entire object graphs (including image ArrayBuffers) for every task dispatched. `Object.getOwnPropertyDescriptors()` on class instances is particularly slow.  
**Fix**:
- For `batch` messages: use `Transferable` ArrayBuffers directly via `postMessage`, skip clone entirely
- For `batch-ref` messages: payload is already plain objects — skip sanitization
- Add fast path: if payload has no class instances, use `structuredClone` directly with try/catch fallback
- Pre-serialize known message shapes to avoid runtime reflection  
**Acceptance**: 30%+ reduction in task dispatch latency for image-heavy batches

---

### [PERF-5] Predictive Trait Loader Is Pure Overhead
**File**: `src/lib/workers/optimization/predictive.loader.ts`  
**Lines**: 61–87  
**Problem**: `predictNextTraits()` iterates all patterns, creates new Sets for similarity computation on every item. `prefetchedItems` is always 0 — predictions are never used for prefetching. Called 10k times → 1M+ wasted Set allocations.  
**Fix**:
- Profile whether predictions actually improve cache hit rates in `WorkerArrayBufferCache`
- If no measurable benefit: **remove `PredictiveTraitLoader` entirely** (dead optimization)
- If some benefit: throttle predictions to every 100th item, or simplify to last-3-trait co-occurrence  
**Acceptance**: Either meaningful cache hit rate improvement OR zero overhead from removed code

---

### [PERF-6] Cache Eviction Sorts Entire Cache Twice
**File**: `src/lib/workers/cache/array-buffer.cache.ts`  
**Lines**: 107–148  
**Problem**: On every eviction, scores and sorts ALL entries (O(n log n)). If not enough space freed, sorts AGAIN by creation time.  
**Fix**:
- Use a priority queue (min-heap) indexed by eviction score
- Maintain secondary sorted structure for creation-time fallback
- OR: Use simple LRU via `Map` iteration order — O(1) get and evict  
**Acceptance**: Eviction O(log n) instead of O(n log n)

---

## 🟡 P2 — Moderate Bugs & Tech Debt

### [BUG-4] Inconsistent Progress Counts in Batch Processing
**File**: `src/lib/workers/generation.worker.ts`  
**Lines**: 295–306  
**Problem**: Progress message contains both `generatedCount: solution.index + 1` (global) and `statusText` using `processedInChunk` (local). UI uses both inconsistently.  
**Fix**:
- Add `chunkGeneratedCount` and `chunkTotalCount` fields to progress payload
- OR remove `generatedCount` from individual progress messages, only use batch-complete counts  
**Acceptance**: Progress bar and text are consistent during batch processing

---

### [BUG-5] ImageBitmap Cache Key Omits `resizeQuality`
**File**: `src/lib/workers/generation.worker.ts`  
**Line**: 97  
**Problem**: If `resizeQuality` changes between calls, stale cached bitmaps are returned.  
**Fix**: Include `options?.resizeQuality || 'default'` in the cache key string.  
**Acceptance**: Cache key matches on all resize parameters

---

### [TECH-DEBT-1] `calculateOptimalWorkerCount()` Is Dead Code
**File**: `src/lib/workers/worker.pool.ts`  
**Lines**: 176–205  
**Problem**: Computed but never called from `initializeWorkerPool()` (which uses inline logic at line 1034–1038). Confusing duplication.  
**Fix**: Either refactor `initializeWorkerPool()` to use this function, or remove it (keeping only inline version with a comment).  
**Acceptance**: Single source of truth for worker count calculation

---

### [TECH-DEBT-2] Blob → ArrayBuffer → Blob Round-Trip
**Files**: `generation.worker.ts:206, 309–313`, `export.service.ts:446–448`  
**Problem**: Images created as Blobs in the worker, converted to ArrayBuffers for transfer, then JSZip expects Blobs. Wasteful conversion.  
**Fix**: Either keep images as ArrayBuffers throughout and convert to Blob only at export, or add Blob support to JSZip entry (JSZip already supports ArrayBuffers via `Blob` constructor).  
**Acceptance**: Zero ArrayBuffer→Blob conversions in hot path

---

### [TECH-DEBT-3] `MemoryManager` Discards Wrong-Sized Canvases
**File**: `src/lib/workers/memory/memory.manager.ts`  
**Lines**: 19–28  
**Problem**: If pool has 1000×1000 but caller needs 500×500, it creates a new canvas while old one occupies pool slot.  
**Fix**: Resize existing canvas (OffscreenCanvas supports width/height reassignment) or implement size-bucketed pools (e.g., 256px buckets).  
**Acceptance**: Pool hit rate improves; no canvas resizing in hot path

---

### [TECH-DEBT-4] No Cancellation Support for CSP Solver Worker
**File**: `src/lib/workers/csp-solver.worker.ts`  
**Problem**: `isCancelled` flag is checked per iteration, but worker has no mechanism to report partial progress on cancel. Cancelled mid-solve (e.g., at item 5000/10000) → client gets "Cancelled" with no partial results.  
**Fix**: On cancel, flush partial solutions as a final chunk before returning "cancelled". Generation client can import partial results.  
**Acceptance**: Cancelled generation returns all items solved so far

---

## 🔵 P3 — Minor Improvements

### [MINOR-1] Add Cache Metrics to ImageBitmap Cache
**File**: `generation.worker.ts:23–71`  
**Problem**: No visibility into cache hit rate. Unknown if caching is effective.  
**Fix**: Add `hits`/`misses` counters and expose via `getCacheStats()` called from `PerformanceMonitor`.

---

### [MINOR-2] Worker Health Check Skips During Generation
**File**: `worker.pool.ts:1219–1224`  
**Problem**: Workers skipped during active tasks. A hung worker in a long generation is never detected.  
**Fix**: Track `lastActivity` timestamps; if no activity for 60+ seconds on a "busy" worker, mark as degraded and restart after current batch completes.

---

### [MINOR-3] Consistent Naming: "solved" vs "generated"
**Problem**: CSP solver reports `solvedCount`, progress messages use `generatedCount`, store uses `currentIndex`. Three names for same concept.  
**Fix**: Standardize on `generatedCount` throughout.

---

## 📈 Success Metrics

| Metric | Current (estimated) | Target After Fixes |
|--------|--------------------|--------------------|
| 10k collection solve time | ~30–60s | <10s (PERF-1, PERF-2) |
| Max collections without error | ~20k (hash collisions) | 100k+ (BUG-1) |
| Memory during generation | Unbounded growth | Stable with streaming (PERF-2) |
| Worker dispatch overhead | O(W×T) per task | O(W) per task (PERF-3) |
| Dead code | ~50 lines | 0 lines |

---

## 📋 Implementation Order

```
Week 1 — Critical bugs (BUG-1, BUG-2, BUG-3)
  ├── Fix hash collision in CSPSolver (biggest correctness risk)
  ├── Remove/fix broken predictDeadEnd()
  └── Gate verifyAllConstraints() behind debug flag

Week 2 — Major performance (PERF-1, PERF-2, PERF-5)
  ├── Incremental AC-3 / undo stack for CSP solver
  ├── Remove or throttle PredictiveTraitLoader
  └── Snapshot/restore optimization

Week 3 — Worker pool & export improvements (PERF-3, PERF-4, TECH-DEBT-2)
  ├── O(1) worker task counting
  ├── Zero-copy worker message dispatch
  └── Eliminate Blob↔ArrayBuffer round-trip

Week 4 — Polish (P2/P3 bugs, metrics, health checks)
  ├── Fix progress consistency (BUG-4)
  ├── Add ImageBitmap cache metrics (MINOR-1)
  ├── Partial result support on cancel (TECH-DEBT-4)
  └── Worker health during generation (MINOR-2)
```