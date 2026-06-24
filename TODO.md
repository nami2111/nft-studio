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

## Phase 2 — Storage spine collapse (~1.2–1.7k lines) [biggest, do carefully]

3 layers → 2. Call `storage/` backends from `persistence.service` directly; delete the
`persistence/` store wrappers in between. Verify each sub-claim with grep first.

- [ ] **Delete `persistence/indexeddb.ts` (84L)** [R]. Only caller is `persistence.service`,
  which already has a legacy path via SmartStorageStore. Confirm + remove.
- [ ] **Delete `LocalStorageStore` + `SmartStorageStore` from `persistence/storage.ts`
  (~256L)** [R]. `LocalStorageStore` has 0 production users. Route `persistence.service`
  to backends directly.
- [ ] **Decide `migrations/indexeddb-to-opfs.ts` (662L)** [R]. Currently runs in boot path
  inside a `.catch`. If OPFS adoption complete → delete. Else → lazy-import only when a
  migration is actually needed (not on every boot). **Needs product call — do not blind-delete.**
- [ ] **Dedup ArrayBuffer serialize/restore helpers (~80L)** [R]. Same logic in
  `persistence/storage.ts`, `opfs.ts`, `indexeddb-legacy.ts`. One shared
  `utils/storage-serialization.ts`.
- [ ] **Delete `storage/telemetry.ts` (26L)** [R→verify] if unused after Phase 1 repoint.

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

## Phase 4 — Cache consolidation (~800 lines) [R, highest-risk logic]

3 hand-rolled caches → 1 generic Map + evict-on-limit. Has perf implications — bench before/after.

- [ ] **Merge `advanced-cache.ts` (489L) + `object-url-cache.ts` (383L) +
  `workers/cache/array-buffer.cache.ts` (217L)** → one `lru-cache.ts` (~80L). Each
  reimplements LRU eviction. Object-URL cache adds blob revocation — keep that as a thin
  `onEvict` hook, not a separate class.
- [ ] **Kill `advanced-cache`'s internal 30s memory-pressure timer** — it races
  `MemoryPressureMonitor`. Drive eviction from the single monitor.
- [ ] Bench gallery scroll + generation memory before/after. Revert if regression.

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
