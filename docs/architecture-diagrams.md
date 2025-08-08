# Architecture diagrams

Overview of NFT Studio architecture (high level)

- UI Layer (Svelte/Vitest)
  - Components: LayerManager, TraitCard, Preview, etc.
  - Stores: project.store, domain/state glue
- Domain Layer
  - Domain models (Project, Layer, Trait)
  - Worker preparation for generation
- Persistence Layer
  - LocalStorageStore, IndexedDbStore, and persistence helpers
- Persistence/Zip IO
  - saveProjectToZip, loadProjectFromZip, import/export
- Worker / Gen
  - generation.worker.ts

Notes:
- Diagrams are placeholders; replace with real diagrams as you evolve.
