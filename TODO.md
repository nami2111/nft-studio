# NFT Studio Improvement Plan

## 🚀 High Priority (Core Architecture)

- [ ] **Refactor `GenerationForm.svelte`**
  - **Current State**: The component is ~560 lines and handles UI, worker communication, ZIP packaging, and analytics.
  - **Action**: Split into smaller, focused components:
    - `GenerationProgress.svelte`: Visual progress bar and status text.
    - `GenerationControls.svelte`: Buttons and input fields.
    - `GenerationPreview.svelte`: Grid of generated previews.
    - Move packaging logic to a dedicated `ExportService`.

- [ ] **Implement Constraint Satisfaction Solver (CSP)**
  - **Current State**: `selectTraitWithRetry` uses a random retry loop (max 50 attempts) to satisfy "Strict Pair" rules. This is inefficient and can fail for complex rule sets.
  - **Action**: Implement a backtracking algorithm or use a lightweight CSP library to deterministically find valid combinations.
  - **File**: `src/lib/workers/generation.worker.ts`

- [ ] **Metadata Standards Support**
  - **Current State**: Generates a generic metadata object.
  - **Action**: Add support for standard formats:
    - **ERC-721** (Ethereum/Polygon)
    - **Metaplex** (Solana)
    - **OpenSea Standard**
  - **Implementation**: Create a `MetadataStrategy` pattern in `project.service.ts`.

## ✨ New Features

- [ ] **Layer Groups / Folders**
  - **Goal**: Allow users to group related layers (e.g., "Face Parts" -> Eyes, Nose, Mouth).
  - **UI**: Collapsible sections in `LayerManager`.
  - **Data**: Update `Project` interface to support nested layers or groups.

- [ ] **Undo/Redo System**
  - **Goal**: Allow users to revert accidental changes.
  - **Implementation**: Implement a `HistoryStore` that tracks snapshots of `project.store`. Svelte 5 Runes make this efficient with fine-grained reactivity.

- [ ] **Direct IPFS Upload**
  - **Goal**: Upload generated collection directly to IPFS (via Pinata or Juno).
  - **Implementation**: Add an "Upload" step after generation.

- [ ] **Collection Analytics Dashboard**
  - **Goal**: Visualize trait distribution of the _generated_ collection.
  - **Implementation**: A chart showing actual rarity vs. target rarity after generation.

## ⚡ Performance Optimizations

- [ ] **Worker Memory Management**
  - **Current State**: Manual `gc()` calls and `WorkerArrayBufferCache`.
  - **Action**: Implement `WeakRef` for cache entries to allow automatic GC pressure handling if supported.
  - **Action**: Use `SharedArrayBuffer` (if headers allow) to avoid copying data between main thread and workers entirely.

- [ ] **Optimized Rarity Calculation**
  - **Current State**: Recalculates on every change.
  - **Action**: Use a derived store that only recalculates when relevant fields (weight) change, using Svelte 5 `$derived.by`.

## 🎨 UI/UX Improvements

- [ ] **Keyboard Shortcuts**
  - `Ctrl+Z` (Undo)
  - `Ctrl+S` (Save Project - though auto-save exists, manual trigger is reassuring)
  - `Space` (Preview Generation)

- [ ] **Drag-and-Drop Enhancements**
  - Allow dragging images directly from OS into specific layer slots.
  - Multi-select layers for bulk actions (delete, move).

- [ ] **Accessibility (a11y)**
  - Ensure all form inputs have associated labels.
  - Add `aria-live` regions for generation progress.
  - Ensure keyboard navigation works for the drag-and-drop lists.

## 🛠 Tech Debt & Code Quality

- [ ] **Unit Testing Coverage**
  - Increase coverage for `src/lib/domain/project.service.ts`.
  - Add integration tests for the Worker flow (mocking `Worker`).

- [ ] **Type Safety Enhancements**
  - Stricter typing for `metadata` objects (currently `Record<string, unknown>`).
  - Use `zod` schemas for all external inputs (imported ZIPs).

- [ ] **Documentation**
  - Add JSDoc to all exported functions in `src/lib/utils`.
  - Create a `CONTRIBUTING.md` with architectural diagrams.
