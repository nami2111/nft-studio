# Architecture Improvements

Deepening opportunities for testability and AI-navigability. Vocabulary from CONTEXT.md and architecture principles.

## Priority 1: Extract CollectionDesignMutator ✓ (partial)

**Status**: Mutator extracted, 32 tests passing. Store delegates all mutations.

**Problem**: Project Store is 580-line god object handling 5+ concerns. Low locality — understanding "how to update a trait" requires reading batch logic, persistence scheduling, resource management.

**Files**:

- `src/lib/domain/collection-design-mutator.ts` (460 lines, new)
- `src/lib/domain/collection-design-mutator.test.ts` (453 lines, new)
- `src/lib/stores/project.store.svelte.ts` (535 lines, was 580)

**Solution**: Pure mutation functions return `{ changed, dirtyLayers, dirtyMetadata }`. Store calls `handleMutationResult(result)` to schedule persistence.

**Tasks**:

- [x] Create `src/lib/domain/collection-design-mutator.ts`
- [x] Move all add/remove/update operations for project, layers, traits
- [x] Move ruler rule mutations (kept old `collection-design.ts` for back-compat types)
- [x] Move strict pair config mutations
- [x] Return `MutationResult` with `dirtyLayers: Set<LayerId>` and `dirtyMetadata: boolean`
- [x] Update store to delegate to mutator via `handleMutationResult()`
- [x] Add `src/lib/domain/collection-design-mutator.test.ts` (32 tests)
- [x] All tests pass: `vp fmt`, `vp lint`, `vp test` (384 passed)

**Remaining for full deepening** (covered by other priorities):

- [ ] Store still 535 lines — file I/O remains (Priority 5)
- [ ] Pending trait async loading still in store — could extract `TraitFileLoader`
- [ ] Batch scheduling logic in store — could move to mutator with timer injection

**Benefits achieved**:

- Mutations testable in isolation (32 tests, no store needed)
- Validation co-located with mutation calls in store
- `MutationResult` makes dirty-tracking explicit and composable
- Aligns with CONTEXT.md "Collection Design" concept

**Acceptance**:

- [ ] Store under 200 lines (currently 535 — needs Priority 5 file ops extraction)
- [x] All mutation tests pass without store instantiation
- [x] Existing UI behavior unchanged (full test suite passes)

---

## Priority 2: Deepen Persistence Service Interface ✓

**Status**: Public API simplified to `save(project)` / `flush(project)`. Old methods deprecated for back-compat.

**Problem**: Service exposed low-level concerns — `markDirty(layerId)`, `schedulePersist()`, `saveProjectToObjectStorage()`. Callers had to manage dirty-tracking protocol.

**Files**:

- `src/lib/services/persistence.service.ts`
- `src/lib/stores/project.store.svelte.ts` (callers updated)

**Solution**: Internal change detection via snapshot comparison. Service computes layer fingerprints and compares trait buffer references to populate dirty flags itself.

**Tasks**:

- [x] Internalize dirty-tracking via `detectChanges(project)` — compares manifest JSON, layer fingerprints, trait buffer identity
- [x] New `save(project)` method — debounced persist with internal change detection
- [x] New `flush(project)` method — immediate persist
- [x] Deprecate `markDirty`, `schedulePersist`, `saveProject` — kept as compat shims
- [x] Update store: removed all `markDirty` / `schedulePersist` calls, single `save()` call
- [x] All tests pass

**Remaining (later)**:

- [ ] Remove deprecated methods after one release
- [ ] Add `hasUnsavedChanges(): boolean` for UI dirty indicators
- [ ] Formalize `StorageAdapter` interface to unify OPFS + legacy backends fully

**Benefits achieved**:

- Store no longer manages dirty state — single `save()` call replaces `markDirty + schedulePersist`
- Dirty-tracking logic concentrated in `detectChanges()`
- Snapshot-based detection catches changes the store didn't explicitly mark
- Internal API for backend selection unchanged — adapter unification deferred

**Acceptance**:

- [x] Auto-save still works via internal change detection
- [x] No callers use `markDirty` (store updated, deprecated methods preserved for compat)
- [ ] Remove deprecated wrappers (next release)

---

## Priority 3: Simplify Error Handling ✓

**Status**: Single `withRetry(op, category, options)` + `handleTypedError(error, category, options)` replace 12 specialized functions. Old wrappers kept as one-line shims.

**Problem**: 15+ specialized functions wrapping `recoverableOperation` with category-specific retry configs. Low leverage — each wrapper was a thin preset application.

**Files**:

- `src/lib/utils/error-handler.ts` (was 536 lines, now 466 — but core API reduced to 2 functions)
- `src/lib/persistence/storage.ts` (9 callers migrated)
- `src/lib/workers/generation.orchestrator.ts` (2 callers migrated)
- `src/lib/domain/project.service.ts` (1 caller migrated)
- `src/lib/stores/file-operations.ts` (1 caller migrated)

**Solution**: `CATEGORIES` registry maps `ErrorCategory` to `{ title, description, ErrorClass, retryConfig, isRetryable }`. Single `withRetry()` and `handleTypedError()` look up strategy by category. Auto-detection via `detectCategory()` for `'generic'` category.

**Tasks**:

- [x] Create `CATEGORIES` registry — 7 categories (storage, file, validation, worker, generation, network, generic)
- [x] Single `withRetry<T>(op, category, options)` — replaces 6 `recoverableXxxOperation` wrappers
- [x] Single `handleTypedError<T>(error, category, options)` — replaces 7 `handleXxxError` wrappers
- [x] `detectCategory(error)` auto-classifies unknown errors via instanceof + message heuristics
- [x] Migrate all 13 callers to new API
- [x] Keep old wrappers as deprecated one-line shims for back-compat
- [x] All tests pass: 384 passed, fmt + lint clean

**Remaining (later)**:

- [ ] Remove deprecated wrappers after one release
- [ ] Add unit tests for `withRetry` strategy selection
- [ ] Document custom category registration if needed

**Benefits achieved**:

- Single entry point for retry — `withRetry(op, 'storage', opts)` vs `recoverableStorageOperation(op, opts)`
- Strategy registry — adding a new category = one entry in `CATEGORIES`
- Auto-detection — `withRetry(op)` (no category) infers from caught error
- Old API still works — incremental migration, no breaking change

**Acceptance**:

- [x] Existing retry behavior preserved (all tests pass)
- [x] All callers migrated to new API
- [ ] Old wrappers removed (next release)

---

## Priority 4: Extract CSP Solver Phases ✓ (partial)

**Status**: Constraint cache + stats tracking extracted to `csp/` folder. Phase boundaries documented inline. Full algorithm extraction (AC-3, backtracking) deferred — too tightly coupled to risk now.

**Problem**: 1006-line monolithic class with 30+ private methods. AC-3 + forward checking + trail-based backtracking + constraint caching intertwined. Hard to test phases independently.

**Files**:

- `src/lib/workers/csp-solver.ts` (was 1005 lines, now 964 — algorithm intact)
- `src/lib/workers/csp/constraint-cache.ts` (52 lines, new)
- `src/lib/workers/csp/constraint-cache.test.ts` (64 lines, new — 6 tests)
- `src/lib/workers/csp/solver-stats.ts` (58 lines, new)
- `src/lib/workers/csp/solver-stats.test.ts` (60 lines, new — 5 tests)

**Solution**: Two pragmatic extractions instead of full phase split:

1. **`ConstraintCache`** — testable cache for ruler-rule compatibility lookups
2. **`SolverStats`** — counter aggregation with snapshot semantics; exposed via `getStats()`

Phase boundaries documented at top of `csp-solver.ts` for navigation. Algorithm methods (AC-3, backtracking) remain in main class because optimizations are entwined.

**Tasks**:

- [x] Extract `ConstraintCache` to `csp/constraint-cache.ts`
- [x] Extract `SolverStats` with `start()`, `stop()`, `snapshot()`
- [x] Replace `performanceStats` field + `rulerViolationCount` field with single `stats` instance
- [x] Document phase boundaries at top of `csp-solver.ts`
- [x] Expose `getStats(): SolverStatsSnapshot` (deprecates `getPerformanceStats`)
- [x] Add 11 unit tests for extracted helpers
- [x] All tests pass (395 passed)

**Deferred** (full phase split):

- [ ] Extract `ConstraintPropagator` (AC-3) — methods access shared `domains`, `constraintCache`, `domainChangeStack`
- [ ] Extract `BacktrackingSearch` — calls into propagator + uses MRV heuristic on shared state
- [ ] Define `SolverHooks` for custom heuristics

Doing the full split would require introducing a `SolverState` parameter object passed between phases, which risks regression in hot-path performance. Recommend benchmarking before committing.

**Benefits achieved**:

- Constraint cache testable in isolation (6 tests)
- Stats testable in isolation (5 tests, snapshot semantics)
- Phase boundaries visible in file header — AI-navigability improved
- `getStats()` returns snapshot — internal counter mutations don't leak

**Acceptance**:

- [x] Stats available after solve completes via `getStats()`
- [x] Solver behavior unchanged (full test suite passes)
- [ ] Each phase under 300 lines (deferred — see above)

---

## Priority 5: Hide ZIP Details in File Operations ✓

**Status**: Load decomposed into named phases. `ProjectImporter` interface added for future formats. Public API already returned `Project` — main fix was internal locality.

**Problem**: `loadProjectFromZip` was 130-line procedure mixing validation, parsing, ID remapping, image hydration, and ruler rule rewriting. Hard to reason about each step in isolation.

**Files**:

- `src/lib/stores/file-operations.ts` (was 274 lines, now 320 with cleaner structure + adapter)
- `src/lib/stores/file-operations.test.ts` (new — 4 tests for importer surface)

**Solution**: Decompose into pure phases — `validateZipFile`, `parseAndHydrateProject`, `remapProjectIds`, `hydrateTraitImages`, `rewriteRulerRules`, `finalizeImportedProject`. Each phase has one job. Add `ProjectImporter` interface + `zipImporter` adapter.

**Tasks**:

- [x] Extract `validateZipFile(file)` — pre-flight checks
- [x] Extract `parseAndHydrateProject(zip, fileName)` — orchestrates parse + hydrate
- [x] Extract `remapProjectIds(project)` — generates new UUIDs, returns `IdRemap`
- [x] Extract `hydrateTraitImages(zip, project, remap)` — uses reverse map to find ZIP paths
- [x] Extract `rewriteRulerRules(project, remap)` — applies remap to layer/trait references
- [x] Extract `finalizeImportedProject(project)` — sets new project ID + load flag
- [x] Add `ProjectImporter` interface — `canImport(file)` + `import(file)`
- [x] Export `zipImporter: ProjectImporter` adapter
- [x] Extract `MAX_FILE_SIZE_BYTES` and `IMAGE_LOAD_TIMEOUT_MS` constants
- [x] Decompose save: `stripImageData`, `collectImageFiles`, `offloadZipToWorker`
- [x] Test importer surface — 4 tests
- [x] All checks pass: 399 tests, fmt + lint clean

**Remaining (later)**:

- [ ] Add JSON import adapter — `jsonImporter` for debug/testing workflows
- [ ] Move `IdRemap` to shared types if other importers need it
- [ ] Hide `ProjectImporter` registration behind a registry if formats grow

**Benefits achieved**:

- Each load phase named and testable in isolation
- `ProjectImporter` seam — adding a new format is one adapter, not editing `loadProjectFromZip`
- Constants extracted from magic numbers
- Save path also decomposed (worker offload now isolated)

**Acceptance**:

- [x] `loadProjectFromZip` returns ready-to-use `Project` (already true; preserved)
- [x] Existing save/load behavior unchanged (full test suite passes)
- [x] ID remapping handled internally (was already true; clarified via reverse-map helper)

---

## Backlog

### Validation Service Composition ✓

- [x] Added `validateProjectUpdate(updates)` returning `{ valid, errors }` with aggregated `FieldError[]`
- [x] Validates name, dimensions, sellerFeeBasisPoints (0-10000), externalUrl, animationUrl
- [x] Single-field methods retained for input-time validation (throw on first error)
- [x] 13 tests in `validation.service.test.ts`

### Loading State Cleanup ✓

- [x] Deleted legacy `src/lib/stores/loading-state.ts` (LoadingStateManager class — unused)
- [x] Moved `LoadingState` type into `loading-state.svelte.ts` (single source of truth)
- [x] Verified no callers used legacy module
- [ ] Future: extract loading state from project store re-exports — UI concern, not project state

### Generation Orchestrator Simplification ✓

- [x] Extracted `ResultStreamer` interface → `src/lib/workers/result-streamer.ts`
- [x] `ZipStreamer` and `StorageStreamer` adapters hide branching
- [x] Orchestrator now calls `streamer.start()`, `streamer.finalize()`, `streamer.cancel()`
- [x] Removed feature-flag branching from orchestrator hot path
- [x] Removed dead `_activeStreamingSession` tracking — streamer owns session state
- [x] 50+ lines of branching collapsed; orchestrator: 515 → 458 lines

### Resource Manager Split ✓

- [x] Extracted `MemoryPressureMonitor` → `src/lib/stores/memory-pressure-monitor.ts`
- [x] Monitor takes `getCurrentUsageBytes` probe + `onCleanup(intensity)` callback
- [x] `ResourceManager` owns cleanup policy, monitor owns when-to-trigger
- [x] Three pressure thresholds: 100MB aggressive, 50MB moderate, 20MB light
- [x] Removed 3 private methods + 2 fields from `ResourceManager`
- [x] 5 unit tests for monitor

### Metadata Strategy Base Class ✓

- [x] Added `BaseMetadataStrategy` → `src/lib/domain/metadata/base.strategy.ts`
- [x] Template method: subclasses implement `buildPayload`, base handles passthrough + validation
- [x] `validateOutput` hook for format-specific checks
- [x] `ERC721Strategy` and `SolanaStrategy` extend base
- [x] 19 unit tests covering both strategies + base hooks

---

## Principles

From LANGUAGE.md:

- **Module** — anything with interface + implementation
- **Interface** — everything caller must know (types, invariants, errors, config)
- **Depth** — leverage at interface. Deep = high leverage. Shallow = interface ≈ implementation
- **Seam** — where interface lives; behavior alterable without editing in place
- **Adapter** — concrete thing satisfying interface at seam
- **Locality** — changes/bugs/knowledge concentrated in one place

**Deletion test**: Imagine deleting module. If complexity vanishes → pass-through. If complexity reappears across N callers → earning its keep.

**One adapter = hypothetical seam. Two adapters = real seam.**
