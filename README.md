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

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4
- **UI Components**: bits-ui, lucide-svelte, svelte-sonner
- **State Management**: Svelte 5 runes and stores
- **Image Processing**: Canvas API with Web Workers for performance
- **Persistence**: IndexedDB for local storage, ZIP for export
- **Build Tool**: Vite with static adapter, bundle visualization, and PWA support
- **Deployment**: ICP Blockchain with Juno hosting, static hosting ready

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- pnpm (package manager)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
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
│   ├── domain/         # Business logic and models
│   ├── persistence/    # Data storage and retrieval
│   ├── stores/         # Modular Svelte stores (SRP-based)
│   ├── types/          # TypeScript types and interfaces
│   ├── utils/          # Utility functions (error handling, logging, retry)
│   └── workers/        # Web workers for background processing
├── routes/             # SvelteKit page routes
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

### Code Quality

We maintain high code quality standards with a focus on maintainable architecture:

- **Single Responsibility Principle**: Each module has one clear purpose
- **TypeScript**: Comprehensive type safety and interfaces
- **Prettier**: Consistent code formatting
- **ESLint**: Code quality and style enforcement
- **Modular Design**: Focused, reusable components and services
- **Error Handling**: Centralized error management with typed errors
- **Performance**: Memory management and Web Worker optimization
- **JSDoc**: Comprehensive API documentation
- **Test Coverage**: Unit tests for business logic and utilities

## Architecture

NFT Studio follows a clean, modular architecture built on Single Responsibility Principle (SRP):

### Core Architecture Layers

1. **UI Layer**: Svelte components for user interaction
2. **Domain Layer**: Business logic and data models
3. **Persistence Layer**: Data storage and retrieval
4. **Worker Layer**: Background processing for intensive operations

### Modular Store Architecture

The state management system is organized into focused, single-responsibility modules:

- **`stores/project.store.svelte.ts`**: Core project state and business logic
- **`stores/resource-manager.ts`**: Memory management and URL cleanup
- **`stores/file-operations.ts`**: ZIP import/export functionality
- **`stores/loading-state.ts`**: Loading states and progress tracking
- **`stores/loading-state.svelte.ts`**: Svelte 5 reactive loading states

### Component Modularity

Large components have been refactored into focused sub-modules:

#### Preview System

- **`components/preview/trait-selector.ts`**: Trait selection logic
- Image caching and canvas rendering integrated into core components

#### Layer Management

- **`components/layer/trait-bulk-operations.ts`**: Bulk trait operations
- **`components/layer/file-upload-handler.ts`**: Drag/drop and file processing
- **`components/layer/trait-filter.ts`**: Trait search and filtering

### Design Principles

- **Single Responsibility**: Each module has one clear purpose
- **Separation of Concerns**: UI, business logic, and data are cleanly separated
- **Dependency Injection**: Services are injected rather than tightly coupled
- **Type Safety**: Comprehensive TypeScript coverage
- **Performance Optimized**: Web Workers and efficient memory management

See [Architecture Documentation](docs/architecture-diagrams.md) for detailed diagrams.

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- [Onboarding Guide](docs/onboarding.md) - Getting started for developers
- [User Guide: Adding Traits](docs/user-guide-adding-traits.md) - How to add traits to your collection
- [User Guide: Generating Collections](docs/user-guide-generating-collections.md) - How to generate NFT collections
- [API Documentation](docs/api-documentation.md) - Complete API reference
- [Architecture Documentation](docs/architecture-diagrams.md) - System architecture overview
- [Coding Standards](docs/coding-standards.md) - Development guidelines
- [Comment Formatting](docs/comment-formatting-summary.md) - Comment style guide
- [In-Code Documentation](docs/in-code-docs.md) - Documentation standards

## Contributing

We welcome contributions! Please see our documentation for details:

- [Onboarding Guide](docs/onboarding.md) - Development environment setup
- [Coding Standards](docs/coding-standards.md) - Code style and best practices
- [AGENTS.md](AGENTS.md) - Guidelines for agentic coding assistants
- [Changelog](CHANGELOG.md) - Version history and changes

## Roadmap

Check our [TODO List](TODO.md) for upcoming features and improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev/)
- UI components from [bits-ui](https://www.bits-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Deployed on [Juno](https://juno.build/)
