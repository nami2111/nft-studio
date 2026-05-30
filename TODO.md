# Architecture Improvements

Deepening opportunities for testability and AI-navigability. Vocabulary from CONTEXT.md and architecture principles.

## Priority 1: Extract CollectionDesignMutator

**Problem**: Project Store is 580-line god object handling 5+ concerns. Low locality — understanding "how to update a trait" requires reading batch logic, persistence scheduling, resource management.

**Files**:
- `src/lib/stores/project.store.svelte.ts`

**Solution**: Extract `CollectionDesignMutator` — owns all add/remove/update operations for Layers, Traits, Ruler rules. Returns mutation results with dirty flags. Store becomes thin state holder + delegation.

**Tasks**:
- [ ] Create `src/lib/domain/collection-design-mutator.ts`
- [ ] Move `updateLayer`, `updateTrait`, `addLayer`, `removeLayer`, `addTrait`, `removeTrait`
- [ ] Move `updateLayersBatch`, `updateTraitsBatch`
- [ ] Move ruler rule mutations from `collection-design.ts`
- [ ] Move strict pair config mutations
- [ ] Return `{ project: Project, dirty: Set<LayerId> }` from each mutation
- [ ] Add validation co-located with mutations
- [ ] Update store to delegate to mutator
- [ ] Add `src/lib/domain/collection-design-mutator.test.ts`

**Benefits**:
- Mutations testable in isolation
- Validation co-located with mutation logic
- Persistence decoupled from business logic
- Aligns with CONTEXT.md "Collection Design" concept

**Acceptance**:
- [ ] Store under 200 lines
- [ ] All mutation tests pass without store instantiation
- [ ] Existing UI behavior unchanged

---

## Priority 2: Deepen Persistence Service Interface

**Problem**: Service exposes low-level concerns — `markDirty(layerId)`, `schedulePersist()`, `saveProjectToObjectStorage()`. Callers must understand dirty-tracking protocol and storage backend selection.

**Files**:
- `src/lib/services/persistence.service.ts` (629 lines)
- `src/lib/persistence/storage.ts`

**Solution**: Hide dirty-tracking. Expose only `save(project)` and `load()`. Service decides when to persist via change detection. Unify backends behind `StorageAdapter` interface.

**Tasks**:
- [ ] Define `StorageAdapter` interface in `src/lib/storage/types.ts`
- [ ] Implement OPFS adapter (already exists, formalize interface)
- [ ] Implement legacy adapter (already exists, formalize interface)
- [ ] Refactor `PersistenceService` to accept `StorageAdapter`
- [ ] Internalize dirty-tracking — compare project snapshots
- [ ] Remove `markDirty`, `schedulePersist` from public API
- [ ] Expose only `save(project): Promise<void>` and `load(): Promise<Project | null>`
- [ ] Add `hasUnsavedChanges(): boolean` for UI indicators

**Benefits**:
- Callers don't know about backends
- Dirty-tracking logic concentrated (locality)
- Easier to add new backends (e.g., cloud sync)
- Testable with in-memory adapter

**Acceptance**:
- [ ] No caller imports from `src/lib/persistence/` directly
- [ ] `markDirty` removed from public API
- [ ] Auto-save still works via internal change detection

---

## Priority 3: Simplify Error Handling

**Problem**: 15+ specialized functions (`recoverableStorageOperation`, `recoverableFileOperation`, `recoverableWorkerOperation`...) all wrap `recoverableOperation` with different retry configs. Low leverage.

**Files**:
- `src/lib/utils/error-handler.ts` (536 lines)
- `src/lib/utils/retry.ts`

**Solution**: Single `withRetry(operation, context)` that auto-detects error type and applies appropriate strategy. Config registry keyed by error type.

**Tasks**:
- [ ] Create `RetryStrategyRegistry` in `src/lib/utils/retry-registry.ts`
- [ ] Register strategies: storage, file, worker, network, database
- [ ] Create unified `withRetry<T>(op: () => Promise<T>, context: string): Promise<T>`
- [ ] Auto-detect error type from caught error class
- [ ] Migrate callers from specialized functions to `withRetry`
- [ ] Deprecate then remove specialized wrappers
- [ ] Reduce `error-handler.ts` to under 200 lines

**Benefits**:
- Single entry point for retry logic
- Strategy selection automatic
- Easier to add new error types
- Less code to maintain

**Acceptance**:
- [ ] All `recoverableXxxOperation` functions removed
- [ ] Existing retry behavior preserved
- [ ] Error handler under 200 lines

---

## Priority 4: Extract CSP Solver Phases

**Problem**: 1006-line monolithic class with 30+ private methods. AC-3 constraint propagation + forward checking + trail-based backtracking intertwined. Hard to test phases independently.

**Files**:
- `src/lib/workers/csp-solver.ts`

**Solution**: Extract phases into composable modules. Expose metrics for monitoring.

**Tasks**:
- [ ] Extract `ConstraintPropagator` — AC-3 algorithm
- [ ] Extract `BacktrackingSearch` — search with trail
- [ ] Extract `SolverStats` — metrics collection
- [ ] Define `SolverHooks` interface for custom heuristics
- [ ] Compose phases in `CSPSolver` facade
- [ ] Expose `getStats(): SolverStats` for monitoring
- [ ] Add phase-level tests

**Benefits**:
- Phases testable in isolation
- Metrics exposed for debugging
- Custom heuristics injectable
- Easier to optimize individual phases

**Acceptance**:
- [ ] Each phase under 300 lines
- [ ] Solver performance unchanged (benchmark)
- [ ] Stats available after solve completes

---

## Priority 5: Hide ZIP Details in File Operations

**Problem**: Exposes ZIP-specific concerns — `ensureAllImagesLoaded()`, ID remapping, ruler rule updates. Callers must understand that loading regenerates IDs.

**Files**:
- `src/lib/stores/file-operations.ts` (274 lines)

**Solution**: Hide ZIP details. Expose only `saveProject(project)` and `loadProject(file)`. Handle ID remapping internally.

**Tasks**:
- [ ] Internalize `ensureAllImagesLoaded` — call automatically during load
- [ ] Internalize ID remapping — don't expose `originalLayerIds`
- [ ] Internalize ruler rule updates — apply during load
- [ ] Return ready-to-use `Project` from `loadProject`
- [ ] Define `ProjectImporter` interface for future formats
- [ ] Add JSON import adapter (for debugging/testing)

**Benefits**:
- Callers get ready-to-use project
- Format details hidden behind seam
- Easier to add new import formats

**Acceptance**:
- [ ] `loadProjectFromZip` returns `Project`, not tuple with ID maps
- [ ] All ID remapping tests pass
- [ ] Existing save/load behavior unchanged

---

## Backlog

Lower priority, tackle after top 5.

### Validation Service Composition
- Add `validateProjectUpdate(updates)` — validates multiple fields, returns aggregated errors
- Provide `ValidationContext` with full project state

### Loading State Cleanup
- Delete legacy `.ts` version
- Move loading state out of project store
- Create `LoadingStateStore` singleton

### Resource Manager Split
- Separate `CacheManager` (3 caches) from `MemoryManager` (pressure + cleanup)
- Make caches injectable with different eviction policies

### Generation Orchestrator Simplification
- Extract `GenerationPipeline` — step sequence
- Extract `ResultStreamer` — ZIP vs storage streaming
- Remove feature flag branching

### Metadata Strategy Base Class
- Add `BaseMetadataStrategy` with common field handling
- Add composition — strategies wrapping strategies

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
