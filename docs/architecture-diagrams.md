# Architecture Documentation

## Overview of NFT Studio Architecture

NFT Studio follows a sophisticated, performance-first architecture with clear separation of concerns and modern web development patterns. The system is designed to handle large-scale NFT generation while maintaining optimal user experience.

### Core Architecture Layers

#### 1. UI Layer (`src/lib/components/`)

**Advanced Svelte 5 Component Architecture with Runes-Based Reactivity**

- **Layer Management Components** (`layer/`):
  - `LayerManager.svelte`: Main layer orchestration with bulk operations
  - `LayerItem.svelte`: Individual layer management with drag-and-drop reordering
  - `BulkOperations.svelte`: Batch trait editing and management
  - `LayerFilter.svelte`: Advanced layer filtering and search

- **Trait Management Components** (`layer/`):
  - `TraitCard.svelte`: Individual trait management with ruler trait controls
  - `VirtualTraitList.svelte`: Efficient rendering of large trait collections
  - `TraitUpload.svelte`: Drag-and-drop file handling with progress tracking

- **Gallery Components** (`gallery/`):
  - `SimpleVirtualGrid.svelte`: High-performance virtual scrolling for NFT collections
  - `GalleryImport.svelte`: ZIP import with automatic metadata parsing
  - `NFTDetails.svelte`: Interactive NFT information panel with trait filtering

- **Preview System** (`preview/`):
  - `Preview.svelte`: Real-time canvas preview with debounced updates (200ms)
  - `PreviewCache.svelte`: Intelligent image caching with adjacent trait preloading
  - `PreviewRenderer.svelte`: Canvas-based rendering with device pixel ratio support

- **Core UI Components** (`ui/`):
  - Comprehensive component library: Button, Card, Dialog, Input, and more
  - Custom modal system with viewport-based positioning
  - Accessibility-first design with ARIA support

#### 2. Store Layer (`src/lib/stores/`)

**Modern State Management with Svelte 5 Runes and Auto-Persistence**

- **`project.store.svelte.ts`**: Core project state with intelligent auto-persistence
  - 500ms debounced persistence to LocalStorage
  - Skips projects with traits to avoid broken image references
  - Reactive state management using `$state`, `$derived`, `$effect`

- **`gallery.store.svelte.ts`**: IndexedDB-based collection management
  - Virtual scrolling support for large collections
  - Advanced filtering and sorting capabilities
  - Multi-collection support with statistics tracking

- **`resource-manager.ts`**: Three-tier caching system with automatic cleanup
  - ImageBitmap Cache: 100MB, 500 entries, 30min TTL
  - ImageData Cache: 50MB, 200 entries, 15min TTL
  - ArrayBuffer Cache: 200MB, 1,000 entries, 1hr TTL

- **`file-operations.ts`**: ZIP import/export with progress tracking
  - Streaming import/export with real-time progress
  - Automatic metadata parsing and validation
  - Error recovery with exponential backoff

- **`loading-state.ts` & `loading-state.svelte.ts`**: Centralized loading management
  - Performance metrics tracking
  - Progress state coordination across components
  - Loading state persistence and recovery

#### 3. Domain Layer (`src/lib/domain/`)

**Business Logic with Complex Validation and Worker Orchestration**

- **`validation.ts`**: Comprehensive Zod-based validation system
  - Runtime type safety with branded types
  - Separate schemas for import/export vs runtime operations
  - Rich error context for debugging and user feedback

- **`project.domain.ts` & `project.service.ts`**: Project business logic
  - Factory pattern for entity creation
  - Project lifecycle management
  - Integration with worker orchestration

- **`rarity-calculator.ts`**: Advanced rarity calculation algorithms
  - Natural numeric sorting for NFT names
  - Rarity score calculation and ranking systems
  - Statistical analysis of trait distributions

- **`worker.service.ts`**: Worker orchestration and task management
  - Integration with advanced worker pool
  - Task complexity classification and routing
  - Error handling and recovery mechanisms

#### 4. Worker Layer (`src/lib/workers/`)

**Advanced Worker Pool with Dynamic Scaling and Health Monitoring**

- **`worker.pool.ts`**: Sophisticated worker pool management
  - Dynamic scaling based on device capabilities (CPU cores, memory, mobile detection)
  - Task complexity classification (LOW to VERY_HIGH)
  - Work-stealing algorithm for optimal task distribution
  - Health monitoring with ping-based checks and automatic restart

- **`generation.worker.ts`**: Canvas-based image generation
  - Direct Canvas API optimization with `createImageBitmap`
  - Transferable ArrayBuffer objects for zero-copy performance
  - Progressive generation with streaming updates

- **`generation.worker.client.ts`**: Worker client interface
  - Streaming vs chunked generation based on collection size
  - Real-time progress reporting
  - Error handling with automatic retry logic

#### 5. Persistence Layer (`src/lib/persistence/`)

**Multi-Backend Storage with Intelligent Caching**

- **IndexedDB Integration**: Structured data persistence for large collections
  - Gallery collections with automatic quota monitoring
  - Efficient indexing for fast filtering and sorting
  - Transaction-based operations for data integrity

- **LocalStorage Management**: Project settings and user preferences
  - Intelligent persistence strategies to avoid broken references
  - Automatic cleanup and migration handling

- **ZIP File Operations**: Complete project import/export
  - Streaming file processing for large projects
  - Automatic metadata validation and sanitization
  - Progress tracking with user-friendly feedback

#### 6. Utils Layer (`src/lib/utils/`)

**Performance Monitoring and Error Handling**

- **`performance-monitor.ts`**: Decorator-based performance tracking
  - Automatic metric collection and reporting
  - Function timing with configurable thresholds
  - Memory usage monitoring and optimization

- **`error-handler.ts` & `typed-errors.ts`**: Comprehensive error management
  - Typed error hierarchy with recoverable/non-recoverable flags
  - Rich error context propagation
  - User-friendly error messaging with toast notifications

- **`simple-debug.ts`**: Efficient debugging and logging
  - Performance-optimized logging for development
  - Conditional debug output based on environment

## Performance Architecture

### Three-Tier Caching System

1. **ImageBitmap Cache** (100MB, 500 entries, 30min TTL)
   - Optimized for fast GPU-accelerated rendering
   - LRU eviction with automatic cleanup
   - Device pixel ratio support for sharp rendering

2. **ImageData Cache** (50MB, 200 entries, 15min TTL)
   - Canvas manipulation operations
   - Pixel-level access for advanced effects
   - Faster than ImageBitmap for manipulation tasks

3. **ArrayBuffer Cache** (200MB, 1,000 entries, 1hr TTL)
   - Worker communication optimization
   - Transferable object support for zero-copy transfers
   - Long-term storage for frequently used assets

### Intelligent Worker Pool

- **Device-Aware Scaling**: Automatically adjusts worker count based on:
  - CPU core count (75% utilization target)
  - Available memory (128MB per worker estimate)
  - Mobile detection (50% worker reduction)
  - Task complexity (collection size, layers, resolution)

- **Health Monitoring**: Continuous worker health checks with:
  - Ping-based responsiveness testing
  - Automatic restart for failed workers
  - Configurable restart limits and error thresholds
  - Performance degradation detection

### Memory Management

- **Adaptive Chunking**: Dynamic chunk sizing based on:
  - Real-time memory pressure monitoring
  - Available system resources
  - Task complexity and collection size
  - Garbage collection timing optimization

- **Resource Cleanup**: Automatic cleanup of:
  - ObjectURLs to prevent memory leaks
  - Expired cache entries
  - Worker resources on task completion
  - Event listeners and timers

## Data Flow Architecture

1. **User Interaction**: UI components capture user input with reactive updates
2. **State Management**: Svelte 5 runes automatically propagate changes through the store system
3. **Business Logic**: Domain layer processes requests with validation and error handling
4. **Worker Processing**: Complex operations are delegated to the intelligent worker pool
5. **Persistence**: Results are stored using multi-backend persistence with caching
6. **UI Updates**: Reactive updates automatically refresh the interface with optimal performance

## Advanced Features

### Ruler Trait System

**Revolutionary Trait Compatibility Engine**:
- Complex rule definitions with allowed/forbidden combinations
- Visual indicators (crown icons, color-coded badges)
- Interactive rule configuration interface
- Real-time validation during generation

### Interactive Gallery Filtering

**Multi-Dimensional Trait Filtering**:
- Click any trait in NFT details to instantly filter collections
- Build complex filters by selecting multiple traits
- Visual feedback with selected trait highlighting
- Natural sorting with numeric pattern recognition

### Progressive Generation

**Real-Time Preview During Batch Processing**:
- Streaming generation with preview updates
- Adaptive preview frequency based on collection size
- Performance monitoring with automatic optimization
- User-configurable preview settings

## Development Patterns

### Svelte 5 Runes Integration

- **`$state`**: Reactive state management with fine-grained updates
- **`$derived`**: Computed values with automatic dependency tracking
- **`$effect`**: Side effects with proper cleanup and debouncing
- **Auto-persistence Proxy**: Intelligent state persistence with conflict resolution

### Type Safety

- **Branded Types**: Compile-time safety for critical identifiers
- **Zod Validation**: Runtime type checking with rich error context
- **Strict TypeScript**: Full type coverage with no implicit any
- **Error Boundaries**: Graceful error handling with recovery mechanisms

### Performance Optimization

- **Virtual Scrolling**: Efficient rendering of large collections
- **Debounced Updates**: 200ms debouncing for trait operations
- **Lazy Loading**: Progressive content loading with intersection observers
- **Memory Monitoring**: Real-time memory usage tracking and optimization

This architecture provides a robust foundation for large-scale NFT generation while maintaining excellent user experience and developer productivity.
