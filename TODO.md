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

### [PERF-3] `findBestWorkerForTask()` Is O(W × T) Per Assignment ✅ FIXED

**File**: `src/lib/workers/worker.pool.ts`
**Problem**: For every task dispatch, iterates ALL active tasks for EACH available worker.
**Fix applied**: Added `workerTaskCount: number[]` for O(1) task count per worker. Incremented on assignment, decremented on completion/failure/removal.
**Acceptance**: Worker selection O(W) instead of O(W × T)

---

### [PERF-4] `safeStructuredClone` Deep Traversal on Every Task ✅ FIXED

**File**: `src/lib/workers/worker.pool.ts`
**Problem**: `sanitizeForClone()` recursively walks entire object graphs for every task.
**Fix applied**: `batch-ref` messages skip `safeStructuredClone` entirely (plain objects → `structuredClone`). `batch`/`init-layers` try `structuredClone` first (Transferable ArrayBuffers), fall back to `safeStructuredClone` only on failure.
**Acceptance**: 30%+ reduction in task dispatch latency

---

### [PERF-5] Predictive Trait Loader Is Pure Overhead ✅ FIXED

**File**: `src/lib/workers/optimization/predictive.loader.ts` (DELETED)
**Problem**: `predictNextTraits()` iterates all patterns, creates new Sets every item. `prefetchedItems` always 0 — predictions never consumed.
**Fix applied**: Removed `PredictiveTraitLoader` entirely from `generation.worker.ts`. Deleted `predictive.loader.ts`. Cleaned up empty `optimization/` directory.
**Acceptance**: Zero overhead from removed dead optimization

---

### [PERF-6] Cache Eviction Sorts Entire Cache Twice ✅ FIXED

**File**: `src/lib/workers/cache/array-buffer.cache.ts`
**Problem**: Sorts ALL entries on every eviction (O(n log n)), sometimes twice.
**Fix applied**: Single-pass top-k selection using a sorted candidate list of size ≤10 (O(n × k) instead of O(n log n)). Extracted `computeEvictionScore()` helper. Fallback uses Map insertion-order iteration.
**Acceptance**: Eviction O(n × k) ≈ O(n) instead of O(n log n)

---

## 🟡 P2 — Moderate Bugs & Tech Debt

### [BUG-4] ~~Inconsistent Progress Counts in Batch Processing~~ ✅ SKIPPED (No Real Bug)

**File**: `src/lib/workers/generation.worker.ts`
**Analysis**: `generatedCount` is globally accurate for progress bar. The `processedInChunk` is supplementary text for status detail. No misalignment in user-facing UI.

---

### [BUG-5] ImageBitmap Cache Key Omits `resizeQuality` ✅ FIXED

**File**: `src/lib/workers/generation.worker.ts`
**Line**: 95
**Fix applied**: Included `options?.resizeQuality || 'default'` in cache key to prevent stale bitmaps if quality settings change.
**Acceptance**: Cache key matches on all resize parameters

---

### [TECH-DEBT-1] `calculateOptimalWorkerCount()` Is Dead Code ✅ REMOVED

**File**: `src/lib/workers/worker.pool.ts`
**Problem**: `calculateOptimalWorkerCount()` (lines 177–206) and `estimateTaskDuration()` were never called or are no longer referenced.
**Fix applied**: Removed both functions. Also removed unused `estimatedDuration` field from task creation in `postMessageToPool()`. `performDynamicScaling()` now computes its `maxWorkers` fallback inline.
**Acceptance**: Dead code eliminated; TypeScript compiles clean.

---

### [TECH-DEBT-2] Blob → ArrayBuffer → Blob Round-Trip ~~⬜~~ → ❌ SKIP (Architecturally Required)

**Files**: `generation.worker.ts:206, 309–313`, `export.service.ts:446–448`
**Analysis**: The Blob→ArrayBuffer conversion at the worker→main thread boundary is required by `postMessage` Transferable protocol. JSZip already accepts ArrayBuffers. No unnecessary conversion exists.
**Decision**: No change needed.

---

### [TECH-DEBT-3] `MemoryManager` Discards Wrong-Sized Canvases ✅ FIXED

**File**: `src/lib/workers/memory/memory.manager.ts`
**Problem**: Pool had 1000×1000 but caller needs 500×500 → new canvas allocated while old one wastes slot.
**Fix applied**: Replaced single flat pool with size-bucketed pool (`Map<string, OffscreenCanvas[]>`). Canvases now keyed by `widthxheight` — wrong-size canvases never returned from pool. Also removed unused `ctxPool` field.
**Acceptance**: Pool hit rate approaches 100% for same-size reuses.

---

### [TECH-DEBT-4] No Cancellation Support for CSP Solver Worker ✅ FIXED

**File**: `src/lib/workers/csp-solver.worker.ts`, `src/lib/workers/generation.worker.client.ts`
**Problem**: Cancelling generation discarded all already-solved items.
**Fix applied**: CSP worker flushes accumulated solutions via `chunk` message before sending `cancelled`. Client resolves (not rejects) with partial results on cancel.
**Acceptance**: Cancelled generation returns items solved so far.

---

## 🔵 P3 — Minor Improvements

### [MINOR-1] Add Cache Metrics to ImageBitmap Cache ✅ FIXED

**File**: `generation.worker.ts:23–71`
**Fix applied**: Added `bitmapCacheHits`/`bitmapCacheMisses` counters. Metrics reported via `perfMonitor.addCacheMetrics('imageBitmap', ...)` in `clearImageBitmapCache()`.

---

### [MINOR-2] Worker Health Check Skips During Generation ✅ FIXED

**File**: `worker.pool.ts:1219–1237`
**Fix applied**: Added degradation detection — workers active >5 minutes are marked `DEGRADED`. Status resets when worker becomes idle and passes health check.

---

### [MINOR-3] Consistent Naming: "solved" vs "generated" ✅ FIXED

**File**: `csp-solver.worker.ts:116`
**Fix applied**: Changed `solvedCount` → `generatedCount` in CSP worker progress messages to match naming convention everywhere else.

---

## 📈 Success Metrics

| Metric                        | Current (estimated)    | Target After Fixes    | Status            |
| ----------------------------- | ---------------------- | --------------------- | ----------------- |
| 10k collection solve time     | ~30–60s                | <10s                  | ✅ PERFs 1+2 done |
| Max collections without error | ~20k (hash collisions) | 100k+                 | ✅ BUG-1 done     |
| Memory during generation      | Unbounded growth       | Stable with streaming | ✅ PERF-2 done    |
| Worker dispatch overhead      | O(W×T) per task        | O(W) per task         | ✅ PERF-3 done    |
| Task dispatch clone overhead  | Deep recursive clone   | Structured path only  | ✅ PERF-4 done    |
| Cache eviction complexity     | O(n log n)             | O(n × k) ≈ O(n)       | ✅ PERF-6 done    |
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
  ├── PERF-3: O(1) worker task counting
  ├── PERF-4: Zero-copy worker message dispatch
  ├── PERF-5: Removed PredictiveTraitLoader (dead optimization)
  └── PERF-6: O(n) cache eviction with top-k selection

NEXT (P2/P3 bugs):
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
