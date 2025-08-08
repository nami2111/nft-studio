# NFT Studio Memory Bank — Architecture

Overview
The Memory Bank provides a structured, self-describing source of truth for isolated sessions,
enabling consistent interpretation of project context across tool interactions.

System structure
- Frontend UI: SvelteKit components and stores that drive memory-bank interactions
- Persistence layer: IndexedDB-based storage for long-term state
- Memory Bank artifacts: brief.md, product.md, architecture.md, tech.md, context.md
- Worker pipelines: Web Workers that implement background tasks (e.g., generation)
- Data models and domain objects: project, trait, layer, etc.

Data models and mappings
- Projects, Traits, and Layers map to local storage schemas; IDs are stable keys
- Memory Bank artifacts describe higher-level semantics and constraints

Data flows
- User actions in the UI lead to updates to in-memory stores and persisted state
- Persistence layer writes to IndexedDB; memory-bank docs reflect current state
- Workers consume and produce data, emitting progress back to UI

Key integration points
- IndexedDB: src/lib/persistence/indexeddb.ts, storage.ts
- In-browser state: src/lib/stores and src/routes
- Web Workers: src/lib/workers/generation.worker.ts

Design decisions
- In-browser persistence to support offline and quick recovery
- Separation of concerns between UI, persistence, and workers
- Documentation of memory bank state as the single source of truth

References
- src/lib/persistence/storage.ts
- src/lib/persistence/indexeddb.ts
- src/lib/workers/generation.worker.ts
- src/lib/stores