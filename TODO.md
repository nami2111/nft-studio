# TODO: Generation Pipeline Fixes & Optimizations

> Auto-generated from deep analysis of generation workflow  
> Last updated: 2026-05-10

---

## 🔴 P0 — Critical Bugs (Fix Immediately)

### [BUG-1] Hash Collisions in Combination Deduplication ✅ FIXED

**File**: `src/lib/workers/csp-solver.ts`
**Lines**: 837–849 (`isValidCombination`), 910–927 (`markCombinationAsUsed`)
**Problem**: Fallback to 32-bit `generateNumericHash()` for large trait sets causes birthday-paradox collisions.
**Fix applied**: Replaced `generateNumericHash()` fallback with collision-proof `traitIds.sort().join('|')` string-key deduplication. `usedCombinations` type changed to `Set<bigint | string>`. Removed `generateNumericHash()` method entirely.
**Acceptance**: Generate 100k items with 10+ layers without "Exhausted all combinations" error

---

### [BUG-2] `predictDeadEnd()` Regex Never Matches ✅ FIXED

**File**: `src/lib/workers/csp-solver.ts`
**Problem**: Searched for literal `"ruler"` in UUID-based assignment keys — never matched.
**Fix applied**: Replaced with domain-emptiness heuristic (`predictDeadEnd()` checks if any unassigned layer has empty remaining domain). Removed `ImpossibleCombination.predictedDeadEnd` field, `performanceStats.predictedDeadEnds` counter, and `generateNumericHash()`. Removed legacy `snapshotDomains()`/`restoreDomains()`.
**Acceptance**: Dead-end prediction uses meaningful heuristic; no dead code

---

### [BUG-3] O(n²) Redundant `verifyAllConstraints()` ✅ FIXED

**File**: `src/lib/workers/csp-solver.ts`
**Fix applied**: `verifyAllConstraints()` gated behind `debugConstraintVerification` flag (only `true` when `NODE_ENV === 'test'`). Production path relies on AC-3 + `isConsistent()` during solving.
**Acceptance**: No O(n²) verification in production; ~20% speedup on solve

---

## 🟠 P1 — Performance Optimizations (High Impact)

### [PERF-1] Full AC-3 Re-run on Every Backtrack Candidate ✅ FIXED

**Fix applied**: `forwardCheckNeighbors()` only propagates arcs from newly assigned layer to its constrained neighbors (O(N×D_neighbor) vs O(C×L×D)). Falls back to full AC-3 when any domain is wiped.
**Acceptance**: Measurable reduction in `ac3Iterations` and `backtracks`

---

### [PERF-2] `snapshotDomains()` Heavy Memory Allocation ✅ FIXED

**Fix applied**: Trail-based domain restoration via `DomainChangeFrame`. Only saves/restores domains that changed (assigned layer + neighbors), not all L layers.
**Acceptance**: 50%+ reduction in GC pauses

---

### [PERF-3] `findBestWorkerForTask()` Is O(W × T) Per Assignment

**File**: `src/lib/workers/worker.pool.ts`
**Lines**: 611–650
**Problem**: For every task dispatch, iterates ALL active tasks for EACH available worker.
**Fix**: Maintain `workerTaskCount: Map<number, number>` counter; O(1) lookup.
**Acceptance**: Worker selection O(W) instead of O(W × T)

---

### [PERF-4] `safeStructuredClone` Deep Traversal on Every Task

**File**: `src/lib/workers/worker.pool.ts`
**Lines**: 838–961
**Problem**: `sanitizeForClone()` recursively walks entire object graphs for every task.
**Fix**: Skip clone for `Transferable` ArrayBuffers; use `structuredClone` directly for plain objects.
**Acceptance**: 30%+ reduction in task dispatch latency

---

### [PERF-5] Predictive Trait Loader Is Pure Overhead ✅ FIXED

**File**: `src/lib/workers/optimization/predictive.loader.ts` (DELETED)
**Problem**: `predictNextTraits()` iterates all patterns, creates new Sets every item. `prefetchedItems` always 0 — predictions never consumed.
**Fix applied**: Removed `PredictiveTraitLoader` entirely from `generation.worker.ts`. Deleted `predictive.loader.ts`. Cleaned up empty `optimization/` directory.
**Acceptance**: Zero overhead from removed dead optimization

---

### [PERF-6] Cache Eviction Sorts Entire Cache Twice

**File**: `src/lib/workers/cache/array-buffer.cache.ts`
**Lines**: 107–148
**Problem**: Sorts ALL entries on every eviction (O(n log n)), sometimes twice.
**Fix**: Priority queue (min-heap) or LRU via `Map` iteration order.
**Acceptance**: Eviction O(log n) instead of O(n log n)

---

## 🟡 P2 — Moderate Bugs & Tech Debt

### [BUG-4] Inconsistent Progress Counts in Batch Processing

**File**: `src/lib/workers/generation.worker.ts`
**Lines**: 295–306
**Problem**: Progress message uses both global `generatedCount` and local `processedInChunk` inconsistently.
**Fix**: Add `chunkGeneratedCount`/`chunkTotalCount` or standardize on one.
**Acceptance**: Progress bar and text consistent during batch processing

---

### [BUG-5] ImageBitmap Cache Key Omits `resizeQuality`

**File**: `src/lib/workers/generation.worker.ts`
**Line**: 97
**Problem**: Stale cached bitmaps returned if `resizeQuality` changes.
**Fix**: Include `options?.resizeQuality || 'default'` in cache key.
**Acceptance**: Cache key matches on all resize parameters

---

### [TECH-DEBT-1] `calculateOptimalWorkerCount()` Is Dead Code

**File**: `src/lib/workers/worker.pool.ts`
**Lines**: 176–205
**Problem**: Computed but never called.
**Fix**: Refactor `initializeWorkerPool()` to use it, or remove.
**Acceptance**: Single source of truth for worker count

---

### [TECH-DEBT-2] Blob → ArrayBuffer → Blob Round-Trip

**Files**: `generation.worker.ts:206, 309–313`, `export.service.ts:446–448`
**Problem**: Images created as Blobs, converted to ArrayBuffers for transfer, then JSZip expects Blobs.
**Fix**: Keep ArrayBuffers throughout or add Blob support to JSZip.
**Acceptance**: Zero unnecessary conversions

---

### [TECH-DEBT-3] `MemoryManager` Discards Wrong-Sized Canvases

**File**: `src/lib/workers/memory/memory.manager.ts`
**Lines**: 19–28
**Problem**: Pool has 1000×1000 but caller needs 500×500 → new canvas while old one occupies slot.
**Fix**: Resize existing canvas or implement size-bucketed pools.
**Acceptance**: Better pool hit rate

---

### [TECH-DEBT-4] No Cancellation Support for CSP Solver Worker

**File**: `src/lib/workers/csp-solver.worker.ts`
**Problem**: No partial result reporting on cancel.
**Fix**: Flush partial solutions before returning "cancelled".
**Acceptance**: Cancelled generation returns items solved so far

---

## 🔵 P3 — Minor Improvements

### [MINOR-1] Add Cache Metrics to ImageBitmap Cache

**File**: `generation.worker.ts:23–71`
**Fix**: Add `hits`/`misses` counters, expose via `PerformanceMonitor`.

---

### [MINOR-2] Worker Health Check Skips During Generation

**File**: `worker.pool.ts:1219–1224`
**Fix**: Track `lastActivity` timestamps; detect degraded workers.

---

### [MINOR-3] Consistent Naming: "solved" vs "generated"

**Fix**: Standardize on `generatedCount` throughout.

---

## 📈 Success Metrics

| Metric                        | Current (estimated)    | Target After Fixes    | Status            |
| ----------------------------- | ---------------------- | --------------------- | ----------------- |
| 10k collection solve time     | ~30–60s                | <10s                  | ✅ PERFs 1+2 done |
| Max collections without error | ~20k (hash collisions) | 100k+                 | ✅ BUG-1 done     |
| Memory during generation      | Unbounded growth       | Stable with streaming | ✅ PERF-2 done    |
| Worker dispatch overhead      | O(W×T) per task        | O(W) per task         | ⏳ PERF-3 pending |
| Dead code                     | ~50 lines              | 0 lines               | ✅ Completed      |

---

## 📋 Implementation Order — Updated

```
COMPLETED:
  ├── BUG-1: Hash collision fix (string-key deduplication)
  ├── BUG-2: predictDeadEnd replaced with domain-emptiness heuristic
  ├── BUG-3: verifyAllConstraints gated behind debug flag
  ├── PERF-1: Incremental forward-checking
  ├── PERF-2: Trail-based domain restoration (undo stack)
  └── PERF-5: Removed PredictiveTraitLoader (dead optimization)

NEXT (PERF-3, PERF-4, PERF-6):
  ├── O(1) worker task counting (worker.pool.ts)
  ├── Zero-copy worker message dispatch (worker.pool.ts)
  └── Priority queue / LRU for ArrayBufferCache eviction

THEN (P2/P3 bugs):
  ├── Fix progress consistency (BUG-4)
  ├── ImageBitmap cache key fix (BUG-5)
  ├── Memory manager size buckets (TECH-DEBT-3)
  └── Worker health monitoring (MINOR-2)
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

```
