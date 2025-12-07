# NFT Studio

NFT Studio is a professional web application for creating and generating Non-Fungible Token collections. Built with SvelteKit 2, Svelte 5, TypeScript, and modern web technologies, it provides artists and creators with a comprehensive toolkit for building generative NFT collections through an intuitive, high-performance interface.

## Features

### Core Generation System

- **Advanced Layer Management**: Organize collections with multiple layers (background, character, accessories, etc.) with drag-and-drop reordering
- **Sophisticated Trait System**: Define traits with customizable rarity weights (1-5 scale) and advanced compatibility rules
- **Real-time Canvas Preview**: Instant visual feedback with debounced updates and intelligent caching
- **High-Performance Generation**: Generate up to 10,000 unique NFTs using optimized Canvas API with sequential processing
- **Smart Memory Management**: Three-tier caching system (ImageBitmap/ImageData/ArrayBuffer) with automatic cleanup
- **Optimized Architecture**: Streamlined performance system with sequential processing, sprite sheet optimization, and memory reduction

**Performance Achieved:** 1000 NFTs in ~128 seconds (7.8 items/sec) with 99.6% cache hit rate

### Advanced Trait Features

- **Ruler Traits**: Revolutionary trait compatibility system that controls which trait combinations can be generated
- **Complex Rule Engine**: Create sophisticated compatibility rules with allowed/forbidden trait combinations
- **Strict Pair Mode**: Advanced uniqueness tracking that prevents specific trait combinations from appearing more than once
- **Multi-Layer Combinations**: Support for unlimited layer combinations (2+ layers) with automatic duplicate prevention
- **Bulk Trait Operations**: Efficient batch editing, renaming, and deletion with progress tracking
- **Smart Trait Filtering**: Advanced search and filtering capabilities with multi-dimensional trait selection

### Gallery & Collection Management

- **Virtual Scrolling Gallery**: Optimized for large collections with responsive layouts (3-6 columns based on device)
- **Interactive Trait Filtering**: Click any trait in NFT details to instantly filter the entire collection
- **Automatic Rarity Calculation**: Advanced rarity scoring system with natural numeric sorting
- **Import/Export Support**: ZIP-based import for existing collections with automatic metadata parsing
- **Multi-Collection Support**: Manage multiple collections with independent statistics and filtering

### Performance Architecture

- **Intelligent Worker Pool**: Dynamic scaling based on device capabilities and task complexity classification
- **Adaptive Chunking**: Real-time memory monitoring with dynamic chunk sizing for large collections
- **Transferable Objects**: Zero-copy ArrayBuffer transfers for maximum performance
- **Progressive Generation**: Real-time preview updates during batch processing
- **Performance Monitoring**: Decorator-based timing with automatic metric collection

### Modern Development Stack

- **Svelte 5 Runes**: Reactive state management using `$state`, `$derived`, and `$effect`
- **TypeScript**: Comprehensive type safety with branded types and Zod validation
- **Modular Architecture**: Clean separation of concerns with SRP-based design patterns
- **PWA Support**: Installable web application with offline capabilities
- **Responsive Design**: Mobile-first approach with device-optimized layouts

### File Operations & Persistence

- **Drag & Drop Upload**: Intuitive file handling with progress tracking and security validation
- **Project Auto-Save**: Intelligent persistence that skips projects with traits to avoid broken references
- **ZIP Export**: Complete collection packaging with images, metadata, and project configuration
- **IndexedDB Storage**: Client-side database for gallery collections with quota monitoring

### User Experience

- **Real-time Previews**: Instant feedback with 200ms debounced updates and adjacent trait preloading
- **Natural Sorting**: Handles "Foxinity #1", "#001", etc. patterns automatically
- **Theme Support**: Built-in theme switching capabilities
- **Analytics Integration**: Generation completion tracking and page visit analytics
- **Comprehensive Error Handling**: Typed error hierarchy with graceful degradation

## Tech Stack

### Core Framework

- **Frontend**: SvelteKit 2, Svelte 5 with runes, TypeScript
- **Styling**: Tailwind CSS 4, bits-ui components, lucide-svelte icons
- **State Management**: Svelte 5 runes ($state, $derived, $effect) with modular store architecture
- **Build System**: Vite with static adapter, bundle visualization, and PWA support

### Performance & Processing

- **Image Processing**: Canvas API with Web Workers for background processing
- **Worker Architecture**: Simplified single-worker architecture with sequential processing
- **Three-Phase Optimization**: Bit-packed indexing, sprite sheet atlases, AC-3 CSP with sequential rendering
- **Memory Management**: Three-tier caching (ImageBitmap/ImageData/ArrayBuffer) with LRU eviction
- **Performance Monitoring**: Decorator-based timing with automatic metric collection
- **Real-World Performance**: Sequential processing with 40-60% memory reduction from sprite sheets, 99.6% cache hit rate

### Data & Storage

- **Persistence**: IndexedDB for gallery collections, LocalStorage for project settings
- **File Operations**: JSZip for import/export, ObjectURL management for image handling
- **Validation**: Zod schemas with branded types for compile-time and runtime safety
- **Data Structures**: Maps and Sets for optimized filtering and indexing

### UI/UX Components

- **Custom Components**: Modal system, virtual scrolling grid, interactive trait filters
- **Notifications**: svelte-sonner for toast notifications and user feedback
- **Theme System**: mode-watcher for dark/light theme switching
- **Responsive Design**: Mobile-first approach with adaptive layouts

### Development & Testing

- **Testing**: Vitest with @testing-library/svelte, jsdom environment
- **Code Quality**: ESLint (flat config), Prettier, TypeScript ESLint
- **Validation**: Comprehensive type coverage with strict TypeScript configuration
- **Documentation**: JSDoc for API documentation with automated formatting

### Deployment & Analytics

- **Platform**: ICP Blockchain deployment with Juno hosting
- **PWA Support**: Service worker, manifest file, offline capabilities
- **Analytics**: Generation completion tracking and page visit analytics
- **Static Hosting**: Ready for deployment to any static hosting service

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- pnpm (package manager)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/nami2111/nft-studio.git
   cd nft-studio
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
# Build the application
pnpm build

# Preview the built application
pnpm preview
```

## Development

### Project Structure

```
src/
├── lib/
│   ├── components/         # Reusable UI components
│   │   ├── layer/          # Layer-specific components (bulk ops, upload, filter)
│   │   ├── preview/        # Preview system (cache, renderer, selector)
│   │   └── ui/             # Base UI components (button, card, dialog, input, etc.)
│   ├── domain/             # Business logic and validation
│   ├── persistence/        # Data storage and retrieval
│   ├── stores/             # Modular Svelte stores using Svelte 5 runes
│   ├── types/              # TypeScript types and interfaces with branded types
│   ├── utils/              # Utility functions and optimization systems
│   │   ├── combination-indexer.ts    # Phase 1: Bit-packed indexing (10x faster lookups)
│   │   ├── sprite-packer.ts          # Phase 2: Sprite sheet atlases (40-60% memory reduction)
│   │   ├── webgl-renderer.ts         # Phase 4: GPU-accelerated rendering
│   │   ├── error-handler.ts          # Centralized error management
│   │   ├── performance-analyzer.ts   # Generation performance analysis
│   │   └── memory-monitor.ts         # Memory usage tracking
│   └── workers/            # Web workers for background processing
├── routes/                 # SvelteKit page routes (+page.svelte, app/+page.svelte)
├── hooks/                  # SvelteKit hooks
├── satellite/              # Juno satellite configuration
└── app.css                 # Global styles
```

### Available Scripts

| Script                      | Description                      |
| --------------------------- | -------------------------------- |
| `pnpm dev`                  | Start development server         |
| `pnpm build`                | Build for production             |
| `pnpm preview`              | Preview production build         |
| `pnpm check`                | Run TypeScript and Svelte checks |
| `pnpm check:watch`          | Watch mode for type checking     |
| `pnpm lint`                 | Check code style                 |
| `pnpm format`               | Format code                      |
| `pnpm test`                 | Run tests                        |
| `pnpm test:watch`           | Run tests in watch mode          |
| `pnpm test:coverage`        | Run tests with coverage          |
| `pnpm standardize-comments` | Standardize comment formatting   |
| `pnpm verify-lockfile`      | Verify package lock integrity    |
| `pnpm test:ci`              | Run tests with JUnit reporter    |
| `pnpm lint-ci`              | CI linting (same as lint)        |

### Code Quality

We maintain high code quality standards with a focus on maintainable architecture:

- **Single Responsibility Principle**: Each module has one clear purpose
- **TypeScript**: Comprehensive type safety with branded types for compile-time safety
- **Prettier**: Consistent code formatting with tab indentation
- **ESLint**: Code quality and style enforcement
- **Modular Design**: Focused, reusable components and services
- **Error Handling**: Centralized error management with typed errors
- **Performance**: Memory management and Web Worker optimization
- **JSDoc**: Comprehensive API documentation
- **Test Coverage**: Unit tests for business logic and utilities
- **Zod Validation**: Runtime type checking and validation schemas

## Architecture

NFT Studio follows a sophisticated, performance-first architecture built on modern web technologies and Single Responsibility Principle (SRP) with Svelte 5 patterns:

### Core Architecture Layers

1. **UI Layer** (`src/lib/components/`): Svelte 5 components with runes-based reactivity
2. **Domain Layer** (`src/lib/domain/`): Business logic, validation, and worker orchestration
3. **Store Layer** (`src/lib/stores/`): Modular state management with auto-persistence
4. **Worker Layer** (`src/lib/workers/`): Advanced worker pool with dynamic scaling
5. **Persistence Layer** (`src/lib/persistence/`): Multi-backend storage abstraction
6. **Utils Layer** (`src/lib/utils/`): Performance monitoring and error handling

### Modern State Management with Svelte 5 Runes

The state management system leverages Svelte 5's advanced runes with intelligent auto-persistence:

- **`stores/project.store.svelte.ts`**: Core project state with 500ms debounced persistence
- **`stores/gallery.store.svelte.ts`**: IndexedDB-based collection management with filtering
- **`stores/resource-manager.ts`**: Three-tier caching with automatic ObjectURL cleanup
- **`stores/file-operations.ts`**: ZIP import/export with progress tracking
- **`stores/loading-state.ts`**: Centralized loading states and performance metrics

### Simplified Worker Architecture

**Single-threaded processing with optimized performance**:

- **Sequential Processing**: Simplified single-worker architecture for easier debugging and maintenance
- **Task Complexity Classification**: LOW to VERY_HIGH based on collection size and layer complexity
- **Memory Optimization**: Sprite sheet packing and three-tier caching for efficient memory usage
- **Health Monitoring**: Basic health checks for worker reliability
- **Streaming vs Chunked**: Adaptive generation strategy based on collection size

### Performance-First Features

#### Three-Tier Caching System

- **ImageBitmap Cache**: 100MB, 500 entries, 30min TTL for fast rendering
- **ImageData Cache**: 50MB, 200 entries, 15min TTL for manipulation operations
- **ArrayBuffer Cache**: 200MB, 1,000 entries, 1hr TTL for worker transfers

#### Intelligent Memory Management

- **Adaptive Chunking**: Dynamic sizing based on runtime memory monitoring
- **LRU Eviction**: Least recently used items purged first
- **Transferable Objects**: Zero-copy ArrayBuffer transfers for maximum performance
- **Resource Cleanup**: Automatic ObjectURL tracking and cleanup

#### Domain-Driven Design

- **Zod Validation System**: Runtime type safety with branded types and error context
- **Factory Pattern**: Consistent entity creation with validation and error handling
- **Multi-Schema Validation**: Separate schemas for import/export vs runtime operations
- **String Sanitization**: Injection prevention with comprehensive input validation

### Component Architecture

#### Reactivity and Performance

- **Svelte 5 Runes**: `$state`, `$derived`, `$effect` for fine-grained reactivity
- **Batch Processing**: 100ms debounced trait updates for improved performance
- **Virtual Scrolling**: Efficient rendering of large NFT collections
- **Progressive Loading**: Real-time preview updates during generation

#### Modular Component System

- **Layer Management**: Drag & drop, bulk operations, trait filtering with performance optimization
- **Preview System**: Canvas rendering with debounced updates and adjacent trait preloading
- **Gallery Interface**: Virtual scrolling, interactive filtering, responsive layouts
- **UI Components**: Comprehensive library with accessibility and mobile support

### Type Safety and Validation

#### Comprehensive TypeScript Coverage

- **Branded Types**: Compile-time safety for IDs (ProjectId, LayerId, TraitId)
- **Strict Configuration**: Full type coverage across the codebase
- **Zod Schemas**: Runtime validation with detailed error context
- **Error Hierarchy**: Typed errors with recoverable vs non-recoverable flags

### Design Principles

- **Performance First**: Web Workers, intelligent caching, and memory optimization
- **Single Responsibility**: Each module has one clear purpose with clean interfaces
- **Separation of Concerns**: UI, business logic, and persistence are cleanly separated
- **Modern Patterns**: Leverages Svelte 5 features and latest web APIs
- **Developer Experience**: Comprehensive tooling, testing, and documentation
- **Error Resilience**: Graceful degradation with automatic recovery mechanisms

## Application Structure

### Main Routes

- **`/`** - Landing page with hero section and introduction
- **`/app`** - Main application interface with project settings, layer management, and generation
- **`/app/gallery`** - Gallery mode for viewing, filtering, and managing generated NFT collections

### Key Components

- **Hero.svelte** - Landing page with feature highlights
- **ProjectSettings.svelte** - Project configuration (name, dimensions, description)
- **LayerManager.svelte** - Layer and trait management interface
- **Preview.svelte** - Real-time NFT preview with trait selection
- **GenerationForm.svelte** - Collection generation controls and progress tracking
- **GalleryImport.svelte** - Import interface for existing NFT collections
- **ModeSwitcher.svelte** - Navigation between Generate and Gallery modes

## Common Development Tasks

### Adding a New Feature

1. Define types in `src/lib/types/`
2. Add validation schemas in `src/lib/domain/validation.ts`
3. Implement business logic in `src/lib/domain/`
4. Update relevant store in `src/lib/stores/`
5. Create UI components in `src/lib/components/`
6. Add error handling with typed errors

### Working with Optimization Systems

**Three-Phase Architecture:**

1. **Bit-Packed Indexing**: Use `CombinationIndexer` for O(1) trait combination lookups
2. **Sprite Sheets**: Use `SpritePacker` for 40-60% memory reduction with texture atlases
3. **AC-3 CSP**: Leverage enhanced CSP solver with 60-80% fewer constraint checks

**Sequential Processing:**

- Simplified single-worker architecture for easier maintenance
- Sequential image processing with optimized performance
- Sprite sheet optimization maintained for memory efficiency

### Working with Web Workers

- Message types defined in `src/lib/types/worker-messages.ts`
- Worker client: `src/lib/workers/generation.worker.client.ts`
- Worker implementation: `src/lib/workers/generation.worker.ts`
- Sequential processing with single worker for simplified architecture

### Testing

- Unit tests for validation: `src/lib/domain/validation.test.ts`
- Worker pool tests: `src/lib/workers/worker.pool.test.ts`
- Run tests with `pnpm test`, `pnpm test:watch`, or `pnpm test:coverage`

## Environment Variables

- `VITE_APP_SATELLITE_ID` - Juno deployment ID (optional, for ICP blockchain integration)

## File Naming Conventions

- `.svelte.ts` for stores using Svelte 5 runes
- `.test.ts` for test files
- Kebab-case for components, camelCase for utilities
- PascalCase for interfaces, camelCase for implementations
- Branded types use PascalCase with descriptive suffixes (e.g., `ProjectId`, `LayerId`)

## Code Style

- **Indentation**: Tabs
- **Strings**: Single quotes
- **Semicolons**: Always used
- **Line Width**: 100 characters
- **Equality**: Strict operators (`===`, `!==`)
- **Comments**: JSDoc for functions, inline comments with capital letters and periods

## Contributing

We welcome contributions! Key files to review:

- [CLAUDE.md](CLAUDE.md) - Development guidelines and project instructions
- [AGENTS.md](AGENTS.md) - Guidelines for agentic coding assistants
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes

## Roadmap

Check our [TODO List](TODO.md) for upcoming features and improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev/) and Svelte 5
- Custom modal system for consistent viewport-based positioning
- Icons from [Lucide](https://lucide.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Deployed on [Juno](https://juno.build/) for ICP blockchain integration
