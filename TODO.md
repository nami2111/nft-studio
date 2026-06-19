# TODO.md — GNStudio Generation Flow Improvement Plan

> Updated from codebase audit on 2026-06-20.
> Scope: generation pipeline, worker orchestration, CSP solving, state management, dead code.
>
> Important correction: the previous plan had a few unsafe recommendations. This version separates
> verified bugs from speculative cleanup and explicitly marks items that should **not** be implemented.

---

## Baseline finding

`pnpm exec svelte-check --tsconfig ./tsconfig.json` currently reports generation-related type
errors. Fix these before changing orchestration semantics so later regressions are easier to spot.

---

## 🐛 P0 — Fix current correctness/type-check blockers

### 1. Fix generation UI type-check blockers

**Why:** The generation UI has existing compile/type errors unrelated to future refactors.

**Current issues:**
- `GenerationForm.svelte` uses undefined `generationState` in the delayed background cleanup.
- `GenerationForm.svelte` calls undefined `resetState()` in the `catch` block.
- `GenerationForm.svelte` types `onProgress` as `ProgressMessage`, but `GenerationCallbacks` accepts
  a lighter progress shape without required `taskId`.
- `GenerationProgress.svelte` assumes `memoryUsage` is always an object, but the worker currently sends
  a number.
- `GenerationProgress.svelte` has an unkeyed phase `{#each}` block.
- `PerformanceDashboard.svelte` has the same `memoryUsage` union bug if the file is kept.

**Fix:**
- In `GenerationForm.svelte`, use `generationStore.state` in the delayed cleanup.
- Replace the catch-block `resetState()` call with `generationStore.actions.resetState()`.
- Remove the explicit `ProgressMessage` parameter type from `buildCallbacks().onProgress`, or introduce
  a shared `GenerationProgressEvent` type matching `GenerationCallbacks`.
- Add a derived memory display normalizer in `GenerationProgress.svelte`:
  - `number` → MB string.
  - `{ used, available, units }` → formatted usage string.
- Key the phase loop: `{#each ['solving', 'generating', 'packaging'] as p (p)}`.
- If `PerformanceDashboard.svelte` is deleted as dead code, no need to fix it; otherwise normalize memory there too.

**Files:**
- `src/lib/components/generation/GenerationForm.svelte`
- `src/lib/components/generation/GenerationProgress.svelte`
- `src/lib/components/monitor/PerformanceDashboard.svelte` — delete or fix

---

### 2. Codify single owner of generation completion

**Previous plan correction:** Do **not** blindly remove `callbacks.onComplete()` at
`generation.orchestrator.ts:207`. In the current runtime, worker batch completions are marked
`isChunk: true`, and the orchestrator-level completion after `streamer.finalize()` is what marks the
whole generation complete.

**Real problem:** Completion semantics are ambiguous:
- Worker `complete` = one pool task/batch finished.
- Orchestrator `onComplete` = entire generation solved, rendered, streamed, packaged, and downloaded.

**Fix:**
- Keep orchestration-level `callbacks.onComplete()` after `streamer.finalize()`.
- Make `routePoolMessage()` treat pool `complete` messages as task/batch events only.
- Remove or guard the `!msg.payload.isChunk` route-level `callbacks.onComplete()` branch so a future
  non-chunk worker completion cannot double-toast.
- Add tests proving `onComplete` fires exactly once for a normal generation.

**Files:**
- `src/lib/workers/generation.orchestrator.ts`
- `src/lib/workers/generation.orchestrator.test.ts`

---

### 3. Fix generated file index parsing used by streaming storage

**Why:** `parseInt('42.png', 10)` happens to work, but the parser is fragile and silently maps bad
names to index `0`.

**Fix:**
- Strip the extension.
- Prefer a trailing numeric stem, e.g. `42.png`, `item-42.png` → `41`.
- Return a safe fallback only when no numeric stem exists.
- Consider extracting this into a tiny exported helper with focused tests.

**Files:**
- `src/lib/workers/generation.orchestrator.ts`
- New/updated test near orchestrator or a small utility test

---

## 🟠 P1 — High-impact cleanup and behavior fixes

### 4. Fix cancel flow without coupling the store to the orchestrator

**Why:** The orchestrator owns the active worker session; the generation store only owns UI state.
The store action named `cancelGeneration()` currently only resets state and does not cancel workers.

**Current call flow:**
- `GenerationForm.handleCancel()` calls orchestrator `cancelGeneration()`.
- Orchestrator calls callback `onCancelled()` when a session exists.
- Callback resets store state.

**Fix:**
- Keep cancellation routed through the orchestrator.
- Make `handleCancel()` `async` and `await cancelGeneration()`; report cancellation errors if any.
- Rename/remove the store action `cancelGeneration()` to avoid a misleading API. Prefer `resetState()`
  or `resetGenerationState()` for UI-only reset.
- Do **not** import the orchestrator into `generation-progress.svelte.ts`; that creates the wrong seam.

**Files:**
- `src/lib/components/generation/GenerationForm.svelte`
- `src/lib/stores/generation-progress.svelte.ts`
- `src/lib/stores/facades/generation.facade.ts`
- Related tests

---

### 5. Remove verified dead code only

**Previous plan correction:** Some files previously listed as dead are live and must not be deleted.

**Do not delete:**
- `src/lib/utils/object-url-cache.ts` — used by gallery route/components/store.
- `src/lib/utils/advanced-cache.ts` — used by `src/lib/stores/resource-manager.ts`.
- `src/lib/workers/image-loader.worker.ts` — spawned by `Preview.svelte`.

**Likely safe deletion candidates after one final search:**
- `src/lib/utils/sprite-packer.ts`
- `src/lib/components/preview/canvas-renderer.ts`
- `src/lib/components/preview/trait-selector.ts`
- `src/lib/components/preview/image-cache.ts` — only used by dead `canvas-renderer.ts`
- `src/lib/components/monitor/CacheMonitor.svelte`
- `src/lib/components/monitor/PerformanceMonitor.svelte`
- `src/lib/components/monitor/PerformanceDashboard.svelte` — no current callers and currently type-fails
- `src/lib/stores/performance-store.svelte.ts` — if `PerformanceMonitor.svelte` is deleted and no callers remain

**Also update:**
- `src/routes/app/+page.svelte` — remove lazy monitor state/imports/functions/dev preload.

**Verification before delete:**
```bash
rg -n "sprite-packer|SpritePacker|canvas-renderer|CanvasRenderer|trait-selector|TraitSelector|image-cache|ImageCache|CacheMonitor|PerformanceMonitor|PerformanceDashboard|performance-store" src vite.config.ts svelte.config.*
```

---

### 6. Remove dead `TraitBatchScheduler.onMessage`

**Why:** `BatchConfig.onMessage` is not passed by the orchestrator, and worker pool messages already
flow through the pool callback bridge.

**Fix:**
- Remove `onMessage` from `BatchConfig`.
- Remove the synthetic empty `CompleteMessage` emitted at the end of `scheduleBatches()`.
- Remove now-unused message type imports from the scheduler.

**Files:**
- `src/lib/workers/trait-batch-scheduler.ts`

---

### 7. Add/adjust orchestration tests around pool completions

**Why:** The completion and chunk behavior is the highest-risk part of the pipeline.

**Tests to add:**
- Worker `complete` with `isChunk: true` streams but does not call user `onComplete` directly.
- Orchestrator calls `onComplete` once after `streamer.finalize()`.
- Cancellation calls streamer cancel, terminates the pool, and resets active session.
- Storage streaming waits for queued writes before packaging.

**Files:**
- `src/lib/workers/generation.orchestrator.test.ts`
- Existing streaming-storage tests if needed

---

## 🟡 P2 — Medium-impact refactors

### 8. Consolidate generation validation without losing UI-specific checks

**Previous plan correction:** `prepareLayersForWorker()` only validates empty traits and missing image
buffers. It does **not** validate no layers or invalid output dimensions.

**Fix:**
- Create a domain-level validation helper for generation input, e.g. `validateGenerationRequest()`.
- It should check:
  - at least one layer,
  - valid output dimensions,
  - no empty layers,
  - no missing image data,
  - collection size range if appropriate.
- `GenerationForm` should call this helper and show friendly warning/error messages.
- Keep defensive validation inside `prepareLayersForWorker()` because it protects the worker seam.

**Files:**
- `src/lib/domain/project.domain.ts` or new `src/lib/domain/generation.validation.ts`
- `src/lib/components/generation/GenerationForm.svelte`
- Tests

---

### 9. Rename worker pool dispatch message type

**Current:** `GenerationWorkerMessage` means messages sent **to** generation workers through the pool.

**Better name:** `WorkerPoolDispatchMessage`.

**Avoid:** `IncomingWorkerMessage`, because `IncomingMessage` already exists and includes broader
worker control messages.

**Also fix while touching this area:**
- `setMessageCallback` should include `GenerationChunkMessage` or use a precise forwarded-message union.
  The pool currently forwards `chunk` messages but its callback type does not reflect that cleanly.

**Files:**
- `src/lib/types/worker-messages.ts`
- `src/lib/workers/pool/pool.ts`
- `src/lib/workers/pool/types.ts`
- `src/lib/workers/pool/state.ts`
- `src/lib/workers/generation.orchestrator.ts`

---

### 10. Normalize feature flag naming with backward compatibility

**Current inconsistency:**
- Some defaults are controlled by `VITE_DISABLE_*`.
- Some are controlled by `VITE_ENABLE_*`.
- `enableOpfsStorage` defaults on while using an `ENABLE`-named env var with `!== 'false'` semantics.

**Fix:**
- Pick one public convention, preferably `VITE_ENABLE_*`.
- Keep backward-compatible handling for existing `VITE_DISABLE_*` env vars for at least one release.
- Make defaults explicit in code and comments.
- Update comments: current file comment says phase flags default false, but several default true.

**Files:**
- `src/lib/config/feature-flags.ts`
- Tests if feature flag tests exist or are added

---

### 11. Logging policy for worker/pool diagnostics

**Previous plan correction:** Do not blindly hide every `console.error` in production. Some errors are
useful diagnostics. The problem is inconsistent logging policy.

**Fix:**
- Route non-critical debug/trace logs through a conditional logger.
- Keep unrecoverable errors visible, or use a logger that can be configured per environment.
- Prioritize noisy worker/pool logs:
  - `src/lib/workers/csp-solver.ts`
  - `src/lib/workers/generation.worker.ts`
  - `src/lib/workers/pool/pool.ts`
  - `src/lib/workers/generation.orchestrator.ts` storage-stream warnings

**Files:**
- `src/lib/utils/logger.ts` or new worker-safe logger helper
- Worker/pool files above

---

## 🟢 P3 — Optimizations and later architecture work

### 12. Improve packaging progress semantics

**Previous plan correction:** `ResultStreamer.start()` does not currently fire progress. The issue is
not “100% at creation”. The current progress model mixes item-generation progress and packaging status.

**Fix options:**
- Keep item progress at 100% during packaging, but ensure phase detection treats both `Packaging` and
  `Finalizing` as packaging.
- Or add separate `phase`/`packagingProgress` fields to generation state.

**Files:**
- `src/lib/workers/generation.orchestrator.ts`
- `src/lib/components/generation/GenerationProgress.svelte`
- `src/lib/stores/generation-progress.svelte.ts` if adding fields

---

### 13. Offload CSP solving to a worker only after designing a lightweight solver seam

**Worth exploring, not a quick P3 patch.**

**Current:** `solveOnMainThread()` runs on the main thread and yields every 50 items for larger
collections.

**Risk:** Sending full `TransferrableLayer` objects to a CSP worker can clone/transfer large image
buffers unnecessarily. CSP solving only needs trait IDs, rarity weights, types, rules, and layer order.

**Better design:**
- Introduce a lightweight solver input type without `imageData`.
- CSP worker returns trait IDs, not full traits.
- The scheduler maps trait IDs back to transferable traits or uses the existing layer-ref mode.
- Support cancellation and progress messages.
- Only enable above a measured threshold, e.g. complex constraints or large collection size.

**Files:**
- New: `src/lib/workers/csp.worker.ts`
- New/updated solver input types
- `src/lib/workers/generation.orchestrator.ts`
- `src/lib/workers/trait-batch-scheduler.ts`

---

## ❌ Do not implement from the old plan

### A. Do not remove orchestrator `callbacks.onComplete()` by itself

That callback is currently the whole-generation completion signal after packaging. Removing it can
prevent success UI from firing at all.

### B. Do not delete live files

Do not delete:
- `object-url-cache.ts`
- `advanced-cache.ts`
- `image-loader.worker.ts`

### C. Do not suppress final empty worker completion messages

The empty final `complete` emitted by `flushGenerationChunk(..., isFinal: true)` is the sentinel that
lets the worker pool resolve the active task. Guarding it away can hang `scheduleBatches()` forever.

---

## Recommended implementation order

1. **Baseline compile fixes**
   - GenerationForm undefined refs and callback type.
   - GenerationProgress memory display + keyed each.
   - Delete or fix PerformanceDashboard.

2. **Generation completion/cancel correctness**
   - Codify completion ownership.
   - Add completion tests.
   - Fix cancel flow naming/API.
   - Fix file index parser.

3. **Safe deletion pass**
   - Delete only verified dead preview/monitor files.
   - Update `src/routes/app/+page.svelte`.
   - Re-run `rg`, `vp lint`, and tests.

4. **Medium refactors**
   - Remove scheduler `onMessage`.
   - Consolidate validation.
   - Rename worker pool dispatch type.
   - Normalize feature flags.

5. **Later optimization**
   - CSP worker with lightweight solver input after profiling confirms the need.
