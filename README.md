# NFT Studio

NFT Studio is a powerful web-based application for creating, managing, and generating Non-Fungible Tokens (NFTs). Built with SvelteKit, TypeScript, and modern web technologies, it provides an intuitive interface for artists and creators to design unique NFT collections.

## Features

- **Layer Management**: Organize your NFT collection with multiple layers (background, character, accessories, etc.)
- **Trait System**: Define traits for each layer with customizable rarity weights (1-5)
- **Visual Preview**: Real-time preview of your NFT collection as you build it
- **Batch Generation**: Generate up to 10,000 unique NFT combinations
- **Rarity Control**: Fine-tune the distribution of traits with adjustable rarity sliders
- **Project Management**: Save, load, and export your projects
- **Web Worker Processing**: Offload intensive image processing to background workers
- **Progressive Previews**: Real-time preview generation during batch processing
- **ZIP Export**: Complete collection packaging with images and metadata
- **Performance Optimized**: Automatic memory management, adaptive chunking, and Canvas-based processing
- **Modular Architecture**: Clean separation of concerns with SRP-based design
- **Bulk Operations**: Efficient bulk trait editing, renaming, and deletion
- **Drag & Drop**: Intuitive file upload with progress tracking
- **Smart Caching**: LRU image caching for optimal performance
- **Ruler System**: Advanced trait compatibility rules and conditional logic
- **PWA Support**: Installable web application with offline capabilities

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4
- **UI Components**: Custom modal system, bits-ui (progress, slider), lucide-svelte, svelte-sonner, mode-watcher
- **State Management**: Svelte 5 runes ($state, $derived) and modular stores
- **Image Processing**: Canvas API with Web Workers for performance
- **Persistence**: IndexedDB for local storage, ZIP for export/import
- **Build Tool**: Vite with static adapter, bundle visualization, and PWA support
- **Deployment**: ICP Blockchain with Juno hosting, static hosting ready
- **Testing**: Vitest with @testing-library/svelte and jsdom
- **Validation**: Zod for runtime type checking and validation

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
│   ├── components/     # Reusable UI components
│   │   ├── layer/      # Layer-specific components (bulk ops, upload, filter)
│   │   ├── preview/    # Preview system (cache, renderer, selector)
│   │   └── ui/         # Base UI components (button, card, dialog, input, etc.)
│   ├── domain/         # Business logic and validation
│   ├── persistence/    # Data storage and retrieval
│   ├── stores/         # Modular Svelte stores using Svelte 5 runes
│   ├── types/          # TypeScript types and interfaces with branded types
│   ├── utils/          # Utility functions (error handling, logging, retry)
│   └── workers/        # Web workers for background processing
├── routes/             # SvelteKit page routes (+page.svelte, app/+page.svelte)
├── hooks/              # SvelteKit hooks
├── satellite/          # Juno satellite configuration
└── app.css             # Global styles
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

NFT Studio follows a clean, modular architecture built on Single Responsibility Principle (SRP) with modern Svelte 5 patterns:

### Core Architecture Layers

1. **UI Layer**: Svelte 5 components with runes-based reactivity
2. **Domain Layer**: Business logic and data models with Zod validation
3. **Persistence Layer**: Data storage and retrieval (IndexedDB/ZIP)
4. **Worker Layer**: Background processing for intensive operations

### State Management with Svelte 5 Runes

The state management system leverages Svelte 5's modern runes system:

- **`stores/project.store.svelte.ts`**: Core project state using `$state` and `$derived`
- **`stores/resource-manager.ts`**: Memory management and ObjectURL cleanup
- **`stores/file-operations.ts`**: ZIP import/export functionality
- **`stores/loading-state.ts`**: Loading states and progress tracking
- **`stores/loading-state.svelte.ts`**: Svelte 5 reactive loading states

### Key Features of the Architecture

#### Modern Reactivity

- **Svelte 5 Runes**: Uses `$state`, `$derived`, and `$effect` for fine-grained reactivity
- **Batch Processing**: Debounced trait updates to improve performance
- **Resource Management**: Automatic cleanup of ObjectURLs and memory

#### Component Modularity

- **Layer Management**: Bulk operations, drag & drop file handling, trait filtering
- **Preview System**: Canvas rendering, image caching, trait selection
- **UI Components**: Comprehensive library of reusable components (buttons, custom modals, cards, etc.)

#### Worker Architecture

- **Generation Worker**: Multi-threaded NFT generation with canvas processing
- **Image Loader Worker**: Background image processing and optimization
- **Worker Pool**: Efficient task distribution across multiple workers

#### Type Safety

- **Branded Types**: Compile-time safety for IDs (ProjectId, LayerId, TraitId)
- **Zod Validation**: Runtime validation for all data models
- **Comprehensive TypeScript**: Full type coverage across the codebase

### Design Principles

- **Single Responsibility**: Each module has one clear purpose
- **Separation of Concerns**: UI, business logic, and data are cleanly separated
- **Modern Patterns**: Leverages Svelte 5 features and latest web APIs
- **Performance First**: Web Workers, efficient memory management, and smart caching
- **Developer Experience**: Comprehensive tooling and testing setup

## Application Structure

### Main Routes

- **`/`** - Landing page with hero section and introduction
- **`/app`** - Main application interface with project settings, layer management, and generation

### Key Components

- **Hero.svelte** - Landing page with feature highlights
- **ProjectSettings.svelte** - Project configuration (name, dimensions, description)
- **LayerManager.svelte** - Layer and trait management interface
- **Preview.svelte** - Real-time NFT preview with trait selection
- **GenerationForm.svelte** - Collection generation controls and progress tracking

## Common Development Tasks

### Adding a New Feature

1. Define types in `src/lib/types/`
2. Add validation schemas in `src/lib/domain/validation.ts`
3. Implement business logic in `src/lib/domain/`
4. Update the project store in `src/lib/stores/project.store.svelte.ts`
5. Create UI components in `src/lib/components/`
6. Add error handling with typed errors

### Working with Web Workers

- Message types defined in `src/lib/types/worker-messages.ts`
- Worker client: `src/lib/workers/generation.worker.client.ts`
- Worker implementation: `src/lib/workers/generation.worker.ts`
- Worker pool for parallel processing: `src/lib/workers/worker.pool.ts`

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
