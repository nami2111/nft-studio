# Over-Engineering Cleanup Plan

Source: ponytail repo-wide audit (2026-06-25). Goal: cut ~3.5–4.2k lines, 0 deps,
no behavior change. Confidence tags: **[V]** grep-verified, **[R]** agent-reported
(verify before cutting). Each phase ends green: `pnpm test` + `pnpm check` pass.

The bloat is two stacked spines. Collapsing each to 2 layers is the structural win:
- **Project mutations, 4 layers:** `collection-design-mutator` → `project.store` → `project.facade`, plus orphan `project.service`.
- **Storage, 3 layers:** `storage/` backends → `persistence/` stores → `persistence.service`.

---

## Phase 1 — Dead code, zero-risk deletes (~500 lines) [DONE ✅]

High confidence, no logic moves. Pure deletion + import repointing.
Green gate passed: `tsc --noEmit` clean, 481 tests pass.

- [x] **Deleted `src/lib/domain/project.service.ts` (296L)** [V]. Zero importers confirmed.
- [x] **Deleted `src/lib/monitoring/performance-monitor.ts` shim** [V]. Added `productionMonitor`
  alias to `utils/performance-monitor.ts`; repointed 3 importers (`gallery.store`,
  `storage/telemetry`, `utils/gallery-storage`). Empty `monitoring/` dir removed.
- [x] **Deleted dead `constants.ts` objects** [V]. `FILE_SIZE`, `BATCH`, `VALIDATION`, `UI`,
  `WORKER`, `CACHE` — all verified 0 imports. Kept `MEMORY`, `TIME` (ResourceManager).
- [x] **Deleted dead `sanitization.ts` exports** [V]. `escapeText`, `createSafeElement`,
  `sanitizeSVG` — 0 imports. Kept `sanitizeHTML` (called internally by `initTrustedTypesPolicy`
  — audit was wrong to list it dead), `isTrustedTypesSupported`, `initTrustedTypesPolicy`.
- [x] **Pruned `performance.config.ts` helpers** [V]. Dropped `getPerformanceConfig`,
  `getOptimalBatchSize`, `getOptimalWorkerCount`, `PerformanceConfig` type — all 0 callers.
  Kept `calculateAdaptiveDelay`, `PERF_CONFIG`.

## Phase 2 — Storage: delete completed migration subsystem (~1.16k lines) [DONE ✅]

OPFS migration confirmed complete (product call). The completed migration machinery +
its boot-path triggers were the real bloat. The `persistence/` "wrapper layer" the audit
flagged turned out to be **load-bearing legacy-fallback / data-safety code — NOT cut.**
Green gate passed: `tsc --noEmit` clean, 476 tests pass.

- [x] **Deleted entire `src/lib/storage/migrations/` dir (1,125L)** — `indexeddb-to-opfs.ts`
  (662) + its test (187) + `legacy-cleanup.ts` (113) + its test (105) + `types.ts` (38) +
  `index.ts` (20). Removed the 2 boot-path call sites (`persistence.service.loadProject`,
  `gallery.store.loadFromStorage`) + a stale mock in `gallery.store.test`.
- [x] **Deleted `storage/telemetry.ts` (26L)** [V]. Both exports
  (`measureStorageOperation`, `logStorageDebugSummary`) had 0 importers.

### Audit overclaims corrected — NOT cut (load-bearing):
- `persistence/indexeddb.ts` — `loadProjectFromLegacyStorage`/`deleteLegacyProject` are
  active legacy-fallback reads in `persistence.service`. Data-safety net. Keep.
- `LocalStorageStore` + `SmartStorageStore` (`persistence/storage.ts`) — `SmartStorageStore`
  is `persistence.service.metaStorage` (legacy save/load path); it depends on
  `LocalStorageStore` + the sync helpers + `createCompactVersion` internally. Whole chain
  is coupled and live. The audit's "0 production users" was a grep artifact (excluded the
  defining file). Keep.
- ArrayBuffer serialize/restore dedup (~80L) — skipped: touches the data-serialization path
  for marginal gain. Not worth the risk now.

Reality: audit's ~1.2–1.7k estimate was mostly `persistence/`, which is real. The migration
dir delivered the bulk (~1.16k) on its own and was the only safe cut here.

## Phase 3 — Project mutation spine + facades (~480 lines) [DONE ✅]

4 layers → 2. Facades were pure 1:1 passthrough over module-level singleton stores;
context added nothing (every facade pointed at the same singleton).
Green gate passed: `tsc --noEmit` clean, 481 tests pass.

- [x] **Deleted `src/lib/stores/facades/` (483L)** [V]. Repointed 5 components +
  `+layout.svelte` to import stores directly (`$lib/stores` barrel for project,
  `generation-progress.svelte` for generation). Updated 3 tests (`GenerationForm`,
  `LayerManager`, `TraitCard`) — facade mocks swapped for direct-store mocks.
- [x] **Deleted `resource-manager-context.ts` (61L)** [V]. 0 callsites confirmed.

Note: `routes/app/+page.svelte` uses a `projectStore` object export from
`project.store.svelte` directly — unrelated to facades, left untouched.

## Phase 4 — Cache: kill redundant timer + dead policies (~90 lines) [DONE ✅]

**The 800L "merge 3 caches → 1" was rejected — false premise.** The three caches do three
different jobs and share only the shallow Map-and-evict shape:
- `advanced-cache.ts` — generic main-thread LRU/TTL with typed subclasses + metrics feeding
  `performanceMonitor`.
- `object-url-cache.ts` — blob-URL **lifecycle** (lazy revocation + recreation to dodge
  ERR_FILE_NOT_FOUND on live DOM refs, collection-size-aware thresholds). Not a generic cache.
- `workers/cache/array-buffer.cache.ts` — worker-side, device-memory-sized, frequency/size
  eviction score, no timers (no `window` in a worker).
A unified cache would need config switches for all three behaviors — that's *more* complexity,
not less. Kept all three. Did the one bounded, safe cut the audit got right:

- [x] **Killed `AdvancedCache`'s internal 30s memory-pressure timer** [V]. `resource-manager`
  already delegates pressure detection to `MemoryPressureMonitor` (the single authority);
  the cache's own `adaptToMemoryPressure` timer raced it. Removed timer + method + 2 dead
  fields. No bench needed — deleting a timer that fought the monitor is strictly better.
- [x] **Removed dead `evictionPolicy` option + `lfu`/`ttl` branches** [V]. Every caller passes
  `'lru'`; the other two `evictEntry` branches were unreachable. Collapsed to LRU-only,
  dropped the option from the interface + 3 `resource-manager` call sites.

Net ~90L from `advanced-cache.ts`. `object-url-cache.ts` + worker cache left intact.

## Phase 5 — Smaller shrinks (~700 lines) [R, opportunistic]

- [ ] **Merge 3 error modules** (`error-handler` 466 + `error-handling` 261 +
  `typed-errors` 255) into one; they cross-import and dup retry+toast logic. ~200L.
- [ ] **Fold validation 3→1**: delete `services/validation.service.ts`, move
  `generation.validation.ts` (1 UI caller) into the form. Keep `domain/validation.ts`. ~200L.
- [ ] **3 memory monitors → 1** (`memory-monitor` + `memory-pressure-monitor` +
  `workers/memory/memory.manager`). One callback monitor; inline canvas pool into
  `generation.worker`. ~140L.
- [ ] **Prune `retry.ts` (413L)**: callers use 3 configs + `withRetry`; ~200L is
  predicate/config dispatch. Collapse to options objects. ~150L.
- [ ] **Inline `result-streamer.ts`** (2 identical-interface classes on a flag) +
  `trait-batch-scheduler.ts` (1-method wrapper, 1 caller). ~150L.
- [ ] **Flatten metadata strategy** (`base.strategy` + `metadata.strategy` interface for 2
  impls that share nothing) → 2 standalone fns. ~91L.
- [ ] **pool.ts**: drop `TaskComplexity` enum+calc (feeds only stats logging, not
  scheduling), unused `getOptimalWorkerCount`/`warmUpWorkers`, phantom `WorkerTask<T>`. ~130L.
- [ ] **Collapse `toast.ts`** (dups error-handling toasts, ~1 live caller) +
  `logger.ts`/`simple-debug.ts` (trivial console wrappers). ~130L.

---

## DO NOT cut (audit overclaims, corrected)

- **Feature flags** — all 5 (`enableLayerRef`, `enableAdaptiveBatchSize`,
  `enableZipWorkerOffloading`, `enableStreamingStorage`, `enableOpfsStorage`) are read in
  real code [V]. Default-off ≠ dead.
- **rarity-calculator.ts** (634L), **csp-solver.ts** core, **combination-indexer.ts** —
  real domain complexity, not bloat.
- **storage/ backends** (opfs, indexeddb-legacy, memory) — clean abstraction; the bloat is
  the `persistence/` layer *above* them.

## Net target

~3.5–4.2k lines removed, 0 dependencies removed (none were the problem). Phases 1+3 are
verified and safe; 2+4 need grep confirmation and a bench gate; 5 is opportunistic.
