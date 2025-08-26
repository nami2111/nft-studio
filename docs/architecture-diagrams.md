# Architecture Diagrams

## Overview of NFT Studio Architecture

NFT Studio follows a layered architecture pattern with clear separation of concerns:

### UI Layer (SvelteKit)

- **Components**: Reusable UI components built with Svelte 5
  - Layer management (LayerManager, LayerItem)
  - Trait management (TraitCard, VirtualTraitList)
  - Project management (ProjectManagement, ProjectSettings)
  - Generation workflow (GenerationModal, Preview)
  - UI utilities (LoadingIndicator, ErrorBoundary)
- **Stores**: Reactive state management using Svelte stores
  - Project state (project.store)
  - Layer state (layers.store)
  - Trait state (traits.store)
  - Application state (loading.store)

### Domain Layer

- **Models**: Core business logic and data structures
  - Project domain (Project model and operations)
  - Layer and Trait models
- **Services**: Business logic implementations
  - Generation service for NFT creation
  - Validation service for data integrity
  - Error handling service

### Worker Layer

- **Generation Workers**: Web Workers for heavy computation
  - Image processing and compositing
  - Rarity distribution algorithms
  - Batch generation operations
- **Worker Pool**: Management of worker instances
  - Dynamic scaling based on system capabilities
  - Task queuing and load distribution

### Persistence Layer

- **Storage Adapters**: Multiple storage backends
  - IndexedDB for structured data persistence
  - LocalStorage for simple key-value storage
- **Import/Export**: Project serialization
  - ZIP-based project packaging
  - JSON metadata handling
  - Image asset management

### Infrastructure Layer

- **Utilities**: Common helper functions
  - Error handling and logging
  - Validation and sanitization
  - Retry mechanisms
- **Configuration**: Environment and build settings
  - Juno integration for decentralized storage
  - Vite build configuration

## Data Flow

1. User interacts with UI components
2. Actions update Svelte stores
3. Domain services process business logic
4. Workers handle intensive computations
5. Results are persisted through storage adapters
6. UI updates reflect changes

## Notes

- Diagrams are placeholders; replace with real diagrams as you evolve.
- Architecture may be updated to use Svelte 5 runes for better reactivity
- Consider implementing proper error boundaries for worker failures
