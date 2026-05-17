# IndexedDB to OPFS Replacement TODO

This plan extends `research.md` into an implementation checklist. The goal is to
replace IndexedDB as the blob/session storage backend with OPFS while keeping
metadata explicit, preserving existing user data, and reducing serialization and
memory pressure in the hot paths.

## Target Outcome

- [ ] Large binary payloads no longer use IndexedDB structured clone as the
      primary path.
- [ ] OPFS stores gallery images, generation session files, and project layer
      asset blobs.
- [ ] Metadata is stored as compact JSON manifests, not hidden inside blob
      records.
- [ ] Existing IndexedDB data migrates without data loss.
- [ ] IndexedDB remains available as a temporary fallback during rollout.
- [ ] `localStorage` remains only for tiny UI/session values, such as selected
      collection IDs or small boot hints.
- [ ] Documentation and UI text no longer call the storage path "IndexedDB
      streaming" after the replacement lands.

## Current Storage Map

| Workload                           | Current files                                                                                                            | Current backend                                         | Replacement target                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Project metadata                   | `src/lib/services/persistence.service.ts`, `src/lib/persistence/storage.ts`                                              | `SmartStorageStore`, `localStorage`, IndexedDB fallback | OPFS `project.json` source of truth, optional tiny local snapshot |
| Project layer assets               | `src/lib/services/persistence.service.ts`                                                                                | `IndexedDbStore` in `gnstudio-assets`                   | OPFS files under project layer asset paths                        |
| Gallery metadata                   | `src/lib/utils/gallery-db.ts`, `src/lib/stores/gallery.store.svelte.ts`                                                  | IndexedDB `collections` store                           | OPFS collection manifests                                         |
| Gallery images                     | `src/lib/utils/gallery-db.ts`, gallery UI callers                                                                        | IndexedDB `gallery-images` store                        | OPFS item image files                                             |
| Generation session images/metadata | `src/lib/utils/streaming-storage.ts`, `src/lib/services/export.service.ts`, `src/lib/workers/generation.orchestrator.ts` | IndexedDB `gnstudio-generation`                         | OPFS session directories                                          |
| Tiny UI state                      | `gallery.store.svelte.ts`, `persistence.service.ts`                                                                      | `localStorage`                                          | Keep `localStorage`                                               |

## Proposed OPFS Layout

Use IDs in file paths. Keep user-controlled names inside JSON manifests only.

```text
gnstudio/
  storage-version.json
  projects/
    current/
      project.json
      layers/
        <layerId>/
          <traitId>.bin
  gallery/
    index.json
    collections/
      <collectionId>/
        collection.json
        items/
          <itemId>.bin
  generation/
    <sessionId>/
      manifest.json
      images/
        <index>.bin
      metadata/
        <index>.json
  migrations/
    indexeddb-to-opfs-v1.json
```

Rules:

- [ ] Never use display names as OPFS path segments.
- [ ] Store image format, item name, rarity, generated date, and collection
      references in JSON manifests.
- [ ] Write binary files before updating the manifest that references them.
- [ ] Treat the manifest as the index. OPFS is not a query database.
- [ ] Use `navigator.storage.estimate()` for quota checks and report
      `usageDetails.fileSystem` when the browser exposes it.
- [ ] Request persistent storage after the first successful project save,
      gallery import, or large generation session.

## Phase 0 - Baseline, Compatibility, and Rollout Flag

### Tasks

- [x] Add a feature flag for the new backend:
      `enableOpfsStorage`.
- [ ] Keep it default-off during implementation. Flip it only after migration,
      tests, and manual performance checks are complete.
- [x] Add capability detection for:
      `navigator.storage.getDirectory`
      `navigator.storage.estimate`
      `navigator.storage.persist`
      `navigator.storage.persisted`
- [ ] Record current baseline numbers before changing behavior:
      gallery import time, item image fetch latency, generation stream write
      time, ZIP packaging time, and peak memory.
- [x] Add a small storage debug summary for development logs:
      backend name, quota, usage, persisted status, and migration status.

### File Changes

- [x] Edit `src/lib/config/feature-flags.ts`.
  - [x] Add `enableOpfsStorage: boolean`.
  - [x] Read `VITE_ENABLE_OPFS_STORAGE`.
  - [x] Keep default `false` until final rollout.
- [x] Add `src/lib/storage/capabilities.ts`.
  - [x] Export `getStorageCapabilities()`.
  - [x] Export `requestPersistentStorage()`.
  - [x] Export `getStorageEstimate()`.
- [x] Add `src/lib/storage/telemetry.ts`.
  - [x] Small helpers for timing storage operations.
  - Reuse `productionMonitor.recordDatabaseQuery(...)` temporarily or add a
    storage-specific wrapper if that monitor supports it cleanly.

### Acceptance Checks

- [ ] App behavior is unchanged when `enableOpfsStorage` is false.
- [ ] Capability helpers return safe falsey values in SSR/test environments.
- [ ] Existing tests still pass before deeper replacement work starts.

## Phase 1 - Introduce the Storage Seam

Create a real storage seam before changing callers. One adapter will be OPFS,
one adapter will be legacy IndexedDB. The interface is the test surface.

### Proposed Interfaces

Add compact interfaces. Avoid leaking OPFS handles or IndexedDB request objects
to callers.

```ts
export interface BinaryObjectStore {
	write(path: string, data: ArrayBuffer): Promise<void>;
	read(path: string): Promise<ArrayBuffer | null>;
	exists(path: string): Promise<boolean>;
	remove(path: string): Promise<void>;
	removeTree(path: string): Promise<void>;
	list(path: string): Promise<string[]>;
	size(path: string): Promise<number>;
}

export interface JsonObjectStore {
	writeJson<T>(path: string, value: T): Promise<void>;
	readJson<T>(path: string): Promise<T | null>;
	removeJson(path: string): Promise<void>;
}
```

### Tasks

- [x] Add path builders for each workload.
- [x] Add path sanitization and tests. IDs should still be treated as
      untrusted input.
- [x] Add OPFS binary and JSON adapters.
- [x] Add an in-memory adapter for tests.
- [x] Add a legacy IndexedDB adapter that wraps existing behavior enough for
      fallback and migration.
- [x] Add a backend selector:
      OPFS when feature flag and capabilities are available, otherwise legacy.
- [ ] Avoid synchronous OPFS access handles in main-thread modules. If sync
      handles are used, isolate them inside dedicated workers later.

### File Changes

- [x] Add `src/lib/storage/types.ts`.
- [x] Add `src/lib/storage/paths.ts`.
- [x] Add `src/lib/storage/opfs.ts`.
- [x] Add `src/lib/storage/memory.ts` for tests.
- [x] Add `src/lib/storage/indexeddb-legacy.ts`.
- [x] Add `src/lib/storage/backend.ts`.
- [x] Add `src/lib/storage/paths.test.ts`.
- [ ] Add `src/lib/storage/opfs.test.ts` with mocked OPFS handles or use the
      memory adapter where jsdom lacks OPFS support.

### Acceptance Checks

- [ ] All storage callers can use the seam without knowing the backend.
- [ ] Path tests reject traversal-like input.
- [ ] OPFS adapter gracefully fails when unavailable.
- [ ] Legacy adapter stays available for fallback and migration.

## Phase 2 - Move Generation Session Storage First

Generation session storage is the best first migration because it is temporary,
hot, and isolated. There is no long-lived migration requirement for
`gnstudio-generation`; failed sessions can be cleared.

### Tasks

- [x] Replace the internals of `streamBatch`, `iterateBySize`, and
      `clearSession` with the storage seam.
- [x] Keep the public behavior stable while changing the backend.
- [x] Write one manifest per session:
      session ID, item count, indices, image byte sizes, metadata names, and
      created timestamp.
- [x] During `streamBatch`, write each image to
      `generation/<sessionId>/images/<index>.bin`.
- [x] During `streamBatch`, write each metadata object to
      `generation/<sessionId>/metadata/<index>.json`.
- [x] Update the session manifest after file writes complete.
- [x] Rework `iterateBySize` to read sizes from the manifest instead of
      loading every image to measure byte length.
- [x] Keep memory bounded by reading only the current batch.
- [x] Clear the whole session directory in `clearSession`.
- [x] Keep a legacy IndexedDB fallback path when OPFS is unavailable.

### File Changes

- [x] Edit `src/lib/utils/streaming-storage.ts`.
  - Keep direct `idb` dependency only in the legacy fallback path.
  - [x] Use `src/lib/storage/backend.ts`.
  - [x] Rename comments from IndexedDB-specific wording to storage-neutral wording.
- [x] Edit `src/lib/services/export.service.ts`.
  - [x] Rename `packageFromIndexedDBBySize` to `packageFromStorageBySize`.
  - [x] Keep a deprecated wrapper `packageFromIndexedDBBySize` for one release if
        that avoids a large call-site change.
  - [x] Update comments and progress messages.
- [x] Edit `src/lib/workers/generation.orchestrator.ts`.
  - [x] Rename `_idbSessionId` to `_storageSessionId`.
  - [x] Rename comments and warnings from IndexedDB to storage.
  - [x] Import the renamed packaging function.
- [x] Add `src/lib/utils/streaming-storage.test.ts`.
  - [x] Test ordered writes.
  - [x] Test batch splitting by byte target.
  - [x] Test missing metadata/image handling.
  - [x] Test session cleanup.

### Acceptance Checks

- [x] Large generation can stream without keeping all images in memory.
- [x] ZIP packaging still reads batches in index order.
- [x] Clearing after success, cancel, and error removes the session directory.
- [x] Feature flag off still uses the legacy path.

## Phase 3 - Move Gallery Storage

Gallery storage is the second priority because it stores many binary item
images and is used by virtual grid image fetching.

### Durable Gallery Decision

Gallery is now intended to persist across route reloads and app reloads. The
gallery route must load stored collections on mount and only delete gallery data
through the explicit clear action.

### Tasks

- [x] Rename the module concept from "gallery DB" to "gallery storage".
- [x] Keep exported function names stable at first, then rename call sites.
- [x] Store collection metadata in:
      `gallery/collections/<collectionId>/collection.json`.
- [x] Store image bytes in:
      `gallery/collections/<collectionId>/items/<itemId>.bin`.
- [x] Store `gallery/index.json` with collection IDs and ordering.
- [x] Rebuild collection arrays from manifests in `getAllCollections`.
- [x] Continue returning metadata-only items with empty `ArrayBuffer`
      placeholders from `getAllCollections`.
- [x] Continue fetching item images on demand from `getItemImage`.
- [x] Preserve `imageFormat` on items. The path can stay `.bin`; format belongs
      in JSON metadata.
- [x] Add storage estimate warnings that use the shared quota helper.
- [x] Fix gallery load/clear lifecycle:
      either load stored collections on mount, or document and enforce
      session-only behavior explicitly.
- [x] Keep fallback reads from the old IndexedDB gallery stores during rollout.

### File Changes

- [x] Rename or replace `src/lib/utils/gallery-db.ts`.
  - Preferred final name: `src/lib/utils/gallery-storage.ts`.
  - Keep a temporary re-export from `gallery-db.ts` if that keeps the diff
    smaller during migration.
- [x] Edit `src/lib/stores/gallery.store.svelte.ts`.
  - [x] Change imports from gallery DB to gallery storage.
  - [x] Rename `debouncedSaveToIndexedDB()` to `debouncedSaveToStorage()`.
  - [x] Rename `saveToIndexedDB()` to `saveToStorage()`.
  - [x] Add `loadFromStorage()` if durable gallery storage is intended.
  - [x] Keep rune state updates inside `untrack` where the current code already
        avoids reactive loop costs.
- [x] Edit `src/routes/app/gallery/+page.svelte`.
  - [x] Replace mount-time `clearAllCollections()` with
        `galleryStore.loadFromStorage()` if durable.
  - [x] Keep "Clear Cache" as the explicit destructive action.
- [x] Edit `src/lib/components/gallery/GalleryImport.svelte`.
  - [x] Import `getStorageEstimate` from the new storage module.
  - [x] Change comments and warning text away from IndexedDB.
- [x] Edit `src/lib/components/gallery/SimpleVirtualGrid.svelte`.
  - [x] Update comments to "storage" instead of IndexedDB.
  - [x] Keep the on-demand image fetch behavior unchanged.
- [x] Edit `src/lib/components/gallery/ItemDetail.svelte`.
  - [x] Update comments to "storage" instead of IndexedDB.
- [x] Add `src/lib/utils/gallery-storage.test.ts`.
  - [x] Test save/load collection metadata.
  - [x] Test save/fetch item image.
  - [x] Test delete collection removes images.
  - [x] Test clear all removes index, collections, and images.

### Acceptance Checks

- [ ] Importing a ZIP stores metadata and images in OPFS when enabled.
- [x] The virtual grid can fetch images on demand after RAM image buffers are
      nulled.
- [x] Item detail fetches images from storage when `imageData` is empty.
- [x] Removing one collection deletes only that collection.
- [x] Clearing gallery deletes all gallery OPFS data and selected collection UI
      state.
- [ ] Existing IndexedDB gallery data still appears through migration/fallback.

## Phase 4 - Move Project Layer Asset Storage

Project layer assets are long-lived and user-critical, so migrate them after the
generation and gallery paths prove the storage seam.

### Tasks

- [x] Move project metadata source of truth to:
      `projects/current/project.json`.
- [x] Move each trait image to:
      `projects/current/layers/<layerId>/<traitId>.bin`.
- [x] Store trait metadata without `imageData` and without object URLs.
- [x] Hydrate `trait.imageData` from OPFS during project load.
- [x] Let UI code recreate object URLs from `imageData` as it already does.
- [x] Keep `localStorage` only as a tiny boot hint if needed.
- [x] Make `clearData()` delete the full OPFS project tree, not only cached
      layer keys known in the current service instance.
- [x] Keep legacy project reads from `SmartStorageStore`, `IndexedDbStore`, and
      `src/lib/persistence/indexeddb.ts` during migration.

### File Changes

- [x] Edit `src/lib/services/persistence.service.ts`.
  - [x] Replace `IndexedDbStore` layer asset writes with the storage seam.
  - [x] Replace `assetStorages` map with path-based writes.
  - [x] Update `saveProject` to write dirty layer asset files by trait ID.
  - [x] Update `loadProject` to hydrate from OPFS first, then legacy.
  - [x] Update `clearData` to delete `projects/current`.
  - [x] Update `hasData` to check OPFS asynchronously, or split into sync hint and
        async source-of-truth checks.
- [x] Edit `src/lib/persistence/storage.ts`.
  - [x] Keep `LocalStorageStore` for small state.
  - [x] Mark `IndexedDbStore` as legacy/fallback once OPFS is active.
  - [x] Avoid using `SmartStorageStore` for large project assets.
- [x] Review `src/lib/persistence/indexeddb.ts`.
  - [x] Kept it as a legacy migrator module temporarily.
  - [ ] Remove it only after the migration/fallback window closes.
- [x] Review `src/lib/stores/project.store.svelte.ts` for API impact.
  - [x] Keep current persistence service calls.
  - [x] Do not push storage details into the store.
- [x] Add `src/lib/services/persistence.service.test.ts` or a focused storage
      hydration test.
  - [x] Save project with multiple layers and traits.
  - [x] Load project and verify `imageData.byteLength`.
  - [x] Clear project and verify OPFS tree deletion.

### Acceptance Checks

- [x] Project save no longer stores trait image bytes in IndexedDB when OPFS is
      enabled.
- [x] Project load restores all trait buffers.
- [x] Export project ZIP still includes images after loading from storage.
- [x] Clearing persisted data clears OPFS project data and old fallback keys.

## Phase 5 - Legacy IndexedDB Migration

Migration must be idempotent. A failed migration should leave old IndexedDB data
untouched and should be safe to retry.

### Legacy Sources

- [ ] Project differential assets:
      IndexedDB database `gnstudio-assets`, object store `store`, keys like
      `gnstudio-layer-assets-<layerId>`.
- [ ] Gallery collections:
      IndexedDB database `gnstudio-gallery`, object store `collections`.
- [ ] Gallery images:
      IndexedDB database `gnstudio-gallery`, object store `gallery-images`.
- [ ] Temporary generation data:
      IndexedDB database `gnstudio-generation`. Do not migrate; clear stale
      sessions after confirming no generation is active.
- [ ] Older project wrapper:
      IndexedDB database `gnstudio`, object store `projects`.
- [ ] Local legacy keys:
      `gnstudio-project`, `gnstudio-project-metadata`,
      `gnstudio-gallery-selected-collection`.

### Tasks

- [ ] Add a migration manifest at:
      `migrations/indexeddb-to-opfs-v1.json`.
- [ ] Migration status values:
      `not-started`, `running`, `completed`, `failed`.
- [ ] On app startup, if OPFS is enabled and migration is not completed:
      read legacy data, write OPFS data, verify it, then mark completed.
- [ ] Verify gallery migration by comparing collection count, item count, and
      total image bytes.
- [ ] Verify project migration by comparing layer count, trait count, and total
      trait image bytes.
- [ ] Do not delete legacy IndexedDB immediately after migration.
- [ ] Add an explicit cleanup helper for old IndexedDB after the fallback window.
- [ ] If OPFS read misses a file during the fallback window, try legacy
      IndexedDB before returning null.

### File Changes

- [ ] Add `src/lib/storage/migrations/indexeddb-to-opfs.ts`.
- [ ] Add `src/lib/storage/migrations/types.ts`.
- [ ] Add `src/lib/storage/migrations/index.ts`.
- [ ] Edit `src/lib/stores/gallery.store.svelte.ts` or route startup code to
      trigger gallery migration before loading gallery data.
- [ ] Edit `src/lib/services/persistence.service.ts` to trigger project
      migration before project hydration.
- [ ] Add `src/lib/storage/migrations/indexeddb-to-opfs.test.ts`.

### Acceptance Checks

- [ ] Migration can run twice without duplicating or corrupting data.
- [ ] Failed migration leaves legacy data readable.
- [ ] Completed migration prefers OPFS.
- [ ] Fallback reads still work for one rollout window.

## Phase 6 - Quota, Persistence, and Cleanup

### Tasks

- [ ] Centralize quota and persistence calls in `src/lib/storage/capabilities.ts`.
- [ ] Call `navigator.storage.persist()` after:
      first successful project save, first successful gallery import, and first
      large generation session write.
- [ ] Surface low-storage warnings through existing `showWarning(...)` paths in
      gallery import and generation flows.
- [ ] Add stale generation cleanup for abandoned OPFS sessions.
- [ ] Update `src/lib/utils/session-cleanup.ts` so it does not leave temporary
      OPFS generation sessions behind.
- [ ] Keep gallery data cleanup intentional. Do not delete durable gallery data
      from generic session cleanup unless the product intentionally wants
      session-only gallery storage.

### File Changes

- [ ] Edit `src/lib/utils/session-cleanup.ts`.
- [ ] Edit `src/lib/components/gallery/GalleryImport.svelte`.
- [ ] Edit `src/lib/workers/generation.orchestrator.ts`.
- [ ] Edit `src/lib/services/persistence.service.ts`.

### Acceptance Checks

- [ ] Browser storage pressure warnings still happen before large imports.
- [ ] OPFS temporary generation directories are removed after success, cancel,
      and error.
- [ ] Durable project/gallery data is not removed by accident.

## Phase 7 - Documentation and Naming Cleanup

### Tasks

- [ ] Replace "IndexedDB streaming" with "storage streaming" or "OPFS
      streaming" where accurate.
- [ ] Keep historical migration notes where needed, but mark IndexedDB as
      legacy/fallback.
- [ ] Update user-facing docs to explain that storage is browser-private and
      quota-managed.
- [ ] Update developer docs to describe the storage seam and OPFS layout.
- [ ] Update About page copy that lists IndexedDB as the storage technology.

### File Changes

- [ ] Edit `docs/performance-architecture.md`.
- [ ] Edit `docs/user-guide-generating-collections.md`.
- [ ] Edit `docs/user-guide-gallery-mode.md`.
- [ ] Edit `docs/feature-flags.md`.
- [ ] Edit `docs/onboarding.md`.
- [ ] Edit `docs/architecture-diagrams.md`.
- [ ] Edit `docs/api-documentation.md`.
- [ ] Edit `src/lib/components/about/AboutTechnicalDetails.svelte`.
- [ ] Edit `src/lib/components/about/AboutGalleryMode.svelte`.
- [ ] Edit `src/lib/components/about/AboutPerformance.svelte`.
- [ ] Edit `src/lib/components/about/AboutOverview.svelte`.

### Acceptance Checks

- [ ] Docs match the final backend behavior.
- [ ] User-facing copy does not mention IndexedDB as the primary performance
      storage after OPFS is enabled by default.

## Phase 8 - Verification Plan

Run verification in the project-required order.

- [ ] `vp fmt`
- [ ] `vp lint`
- [ ] `vp test`

Add manual checks because OPFS behavior depends on browser APIs that jsdom may
not fully emulate.

- [ ] Chrome: generate 1,000 items with streaming storage enabled.
- [ ] Chrome: import a multi-part gallery ZIP and scroll the virtual grid.
- [ ] Chrome: open item detail for images that are not in memory.
- [ ] Chrome: reload app and verify durable project/gallery behavior, if
      durability is intended.
- [ ] Chrome: cancel generation and verify generation session cleanup.
- [ ] Safari latest: verify OPFS fallback or native path, depending on feature
      detection.
- [ ] Private/incognito mode: verify fallback path and user-facing warning.

Performance numbers to compare with the baseline:

- [ ] Gallery import total time.
- [ ] Average item image fetch latency in virtual grid.
- [ ] Generation stream write time per batch.
- [ ] ZIP packaging preparation time.
- [ ] Peak memory during large generation.
- [ ] `navigator.storage.estimate()` usage and quota before/after import.

## Final Rollout Steps

- [ ] Ship with `enableOpfsStorage` default-off.
- [ ] Test with `VITE_ENABLE_OPFS_STORAGE=true`.
- [ ] Enable OPFS by default only after migration is stable.
- [ ] Keep legacy IndexedDB fallback for at least one release.
- [ ] Add cleanup command or UI path for legacy IndexedDB after the fallback
      window.
- [ ] Remove deprecated names:
      `packageFromIndexedDBBySize`, `gallery-db.ts`, `IndexedDbStore` primary
      references, and IndexedDB-specific comments.

## Do Not Do

- [ ] Do not replace this with `localStorage`; it is too small and synchronous.
- [ ] Do not replace this with Cache Storage; the data model is not
      `Request`/`Response` pairs.
- [ ] Do not introduce SQLite unless future requirements need real SQL queries
      across collections.
- [ ] Do not delete legacy IndexedDB data until OPFS writes are verified and a
      fallback window has passed.
- [ ] Do not expose OPFS paths or handles to Svelte components. Stores and UI
      should call storage modules, not backend adapters.
