# Architecture Diagrams

## Overview of NFT Studio Architecture

NFT Studio follows a layered architecture pattern with clear separation of concerns:

### UI Layer (SvelteKit)

- **Components**: Reusable UI components built with Svelte 5 using runes for reactivity ($state, $derived, $effect)
  - Layer management (LayerManager, LayerItem)
  - Trait management (TraitCard, VirtualTraitList)
  - Project management (ProjectManagement, ProjectSettings)
  - Generation workflow (GenerationModal, Preview)
  - UI utilities (LoadingIndicator, ErrorBoundary)
- **Stores**: Reactive state management using Svelte 5 runes stores in src/lib/stores/
  - Project state (project.store.svelte.ts)
  - Resource management (resource-manager.ts)
  - File operations (file-operations.ts)
  - Loading states (loading-state.ts, loading-state.svelte.ts)

### Domain Layer

- **Models**: Core business logic and data structures
  - Project domain (project.domain.ts, project.service.ts)
  - Layer and Trait models (models.ts)
  - Validation logic (validation.ts)
- **Services**: Business logic implementations
  - Worker service for background processing
  - Error handling and logging utilities

### Worker Layer

- **Generation Workers**: Web Workers for heavy computation
  - Image processing and compositing (generation.worker.ts)
  - Image loading worker (image-loader.worker.ts)
  - Worker pool management (worker.pool.ts)
  - Client-side worker communication (generation.worker.client.ts)

### Persistence Layer

- **Storage Adapters**: Multiple storage backends
  - IndexedDB for structured data persistence (indexeddb.ts)
  - Storage abstraction layer (storage.ts)
- **Import/Export**: Project serialization
  - ZIP-based project packaging (JSZip integration)
  - JSON metadata handling
  - Image asset management with URL cleanup

### Infrastructure Layer

- **Utilities**: Common helper functions
  - Error handling and logging (error-handler.ts, error-logger.ts)
  - Validation and sanitization (validation.ts)
  - Retry mechanisms (retry.ts)
  - Typed errors (typed-errors.ts)
- **Configuration**: Environment and build settings
  - ICP blockchain integration with Juno hosting (juno.config.ts)
  - Vite build configuration with PWA support
  - Tailwind CSS 4 configuration

## Data Flow

1. User interacts with UI components
2. Actions update Svelte stores
3. Domain services process business logic
4. Workers handle intensive computations
5. Results are persisted through storage adapters
6. UI updates reflect changes

## Notes

- Architecture now fully implements Svelte 5 runes for reactive state management
- Worker pool management provides efficient background processing
- Error boundaries implemented with comprehensive error handling utilities
- Modular component structure with clear separation of concerns
- Performance optimizations include LRU caching and memory management
