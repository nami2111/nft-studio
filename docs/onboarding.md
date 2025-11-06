# NFT Studio Onboarding Guide

Welcome to the NFT Studio development team! This guide will help you get set up and start contributing to the project.

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (version 18 or higher)
- pnpm (package manager)
- Git

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nft-studio
```

### 2. Install Dependencies

```bash
pnpm install
```

This will automatically run post-install scripts including copying auth workers to the static directory.

### 3. Start the Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

## Application Modes

NFT Studio provides two sophisticated modes for working with NFT collections:

### Generate Mode (`/app`)

**Professional NFT Creation Environment**

- **Purpose**: Create new NFT collections from layers and traits with advanced controls
- **Core Features**:
  - Advanced layer management with drag-and-drop reordering
  - Sophisticated trait system with Ruler Trait compatibility rules
  - Real-time Canvas preview with debounced updates (200ms)
  - High-performance batch generation (up to 10,000 NFTs)
  - Intelligent worker pool with device optimization
- **Advanced Capabilities**:
  - Ruler Traits for complex trait compatibility rules
  - Bulk trait operations with progress tracking
  - Smart caching with three-tier memory management
  - Project auto-save with intelligent persistence
- **Workflow**: Design Layers → Upload Traits → Configure Rules → Generate Collection → Export ZIP

### Gallery Mode (`/app/gallery`)

**Interactive Collection Analysis & Management**

- **Purpose**: View, filter, and analyze existing NFT collections with professional tools
- **Core Features**:
  - Virtual scrolling gallery optimized for large collections
  - Interactive trait filtering with multi-dimensional selection
  - Automatic rarity calculation and ranking system
  - Import existing collections from ZIP files
  - Responsive layouts (3-6 columns based on device)
- **Advanced Capabilities**:
  - Click any trait to instantly filter the entire collection
  - Natural numeric sorting for NFT names ("Foxinity #1", "#001", etc.)
  - Multi-collection support with independent statistics
  - Real-time search with performance optimization
  - Collection statistics and rarity analysis
- **Workflow**: Import Collection → Analyze Rarity → Interactive Filtering → Export Results

### Mode Switching

- **Seamless Navigation**: Use the **"Gallery Mode"** button in the top-right corner to switch between modes
- **Independent State**: Each mode maintains its own workspace and data
- **Data Flow**: Generate Mode → Export ZIP → Import to Gallery Mode for analysis
- **Performance Optimization**: Each mode has specialized caching and performance tuning

For detailed information about Gallery Mode features and interactive filtering, see [User Guide: Gallery Mode](./user-guide-gallery-mode.md).

## Project Structure

```
nft-studio/
├── docs/                    # Comprehensive documentation
│   ├── onboarding.md        # Developer onboarding guide
│   ├── architecture-diagrams.md  # Detailed architecture documentation
│   ├── coding-standards.md  # Code style and conventions
│   └── user-guides/         # User documentation for features
├── scripts/                 # Build and utility scripts
├── src/                     # Source code
│   ├── lib/                 # Core application code
│   │   ├── components/       # Reusable UI components
│   │   │   ├── layer/       # Layer management components
│   │   │   ├── gallery/     # Gallery and collection components
│   │   │   ├── preview/     # Preview system components
│   │   │   └── ui/          # Base UI component library
│   │   ├── stores/           # State management with Svelte 5 runes
│   │   │   ├── project.store.svelte.ts  # Main project state
│   │   │   ├── gallery.store.svelte.ts  # Gallery collection state
│   │   │   ├── resource-manager.ts     # Memory and cache management
│   │   │   └── file-operations.ts      # Import/export functionality
│   │   ├── domain/           # Business logic and validation
│   │   │   ├── validation.ts          # Zod-based validation
│   │   │   ├── project.domain.ts      # Project business logic
│   │   │   ├── worker.service.ts      # Worker orchestration
│   │   │   └── rarity-calculator.ts   # Rarity calculation algorithms
│   │   ├── workers/          # Advanced worker pool system
│   │   │   ├── worker.pool.ts         # Dynamic worker pool management
│   │   │   ├── generation.worker.ts   # Canvas-based generation
│   │   │   └── generation.worker.client.ts  # Worker client interface
│   │   ├── utils/            # Performance and utility functions
│   │   │   ├── performance-monitor.ts  # Performance tracking
│   │   │   ├── error-handler.ts       # Error management
│   │   │   └── advanced-cache.ts       # Three-tier caching system
│   │   ├── types/            # TypeScript definitions with branded types
│   │   └── persistence/      # Data storage abstraction
│   ├── routes/               # SvelteKit page routes
│   │   ├── +page.svelte      # Landing page (Hero component)
│   │   ├── +layout.svelte    # Root layout
│   │   ├── app/              # Main application
│   │   │   ├── +page.svelte  # Generate mode interface
│   │   │   └── gallery/      # Gallery mode
│   │   │       └── +page.svelte  # Gallery interface
│   │   └── about/            # Documentation and about page
│   │       └── +page.svelte  # Interactive documentation
│   ├── hooks/                # SvelteKit hooks
│   ├── satellite/            # Juno satellite configuration
│   └── app.css               # Global styles with Tailwind CSS
├── static/                   # Static assets
├── package.json              # Project configuration and dependencies
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── tailwind.config.js        # Tailwind CSS configuration
└── README.md                 # Project overview and features
```

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Code Quality Checks

```bash
# Check for TypeScript and Svelte errors
pnpm check

# Lint code for style issues
pnpm lint

# Format code according to project standards
pnpm format

# Standardize comments
pnpm standardize-comments
```

### Building for Production

```bash
# Build the application
pnpm build

# Preview the built application
pnpm preview
```

## Contributing

### Branching Strategy

- Create feature branches from `main`
- Use descriptive branch names (e.g., `feature/add-layer-drag-drop`)
- Keep branches focused on a single feature or bug fix

### Commit Messages

Follow conventional commit format:

- `feat: Add layer drag and drop functionality`
- `fix: Resolve trait image loading issue`
- `docs: Update architecture documentation`
- `refactor: Optimize layer validation logic`

### Code Reviews

- All changes require review before merging
- Ensure tests pass and code quality checks are clean
- Address all review comments before merging

### Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run all checks (`pnpm check`, `pnpm lint`, `pnpm test`)
3. Create a PR with a clear description of changes
4. Request review from team members
5. Address feedback and merge after approval

## Project Architecture

The NFT Studio follows a layered architecture:

1. **UI Layer**: Svelte components for user interaction
2. **Domain Layer**: Business logic and data models
3. **Persistence Layer**: Data storage and retrieval
4. **Worker Layer**: Background processing for intensive operations

Refer to `docs/architecture-diagrams.md` for detailed architecture information.

## Coding Standards

Follow the coding standards documented in `docs/coding-standards.md`:

- Use TypeScript for type safety
- Document public APIs with JSDoc
- Write unit tests for critical functionality
- Maintain consistent code formatting

## Useful Scripts

| Script                      | Purpose                          |
| --------------------------- | -------------------------------- |
| `pnpm dev`                  | Start development server         |
| `pnpm build`                | Build for production             |
| `pnpm check`                | Run TypeScript and Svelte checks |
| `pnpm check:watch`          | Watch mode for type checking     |
| `pnpm lint`                 | Check code style                 |
| `pnpm format`               | Format code                      |
| `pnpm test`                 | Run tests                        |
| `pnpm test:watch`           | Run tests in watch mode          |
| `pnpm test:coverage`        | Run tests with coverage          |
| `pnpm standardize-comments` | Standardize comment formatting   |
| `pnpm verify-lockfile`      | Verify package lock integrity    |

## Getting Help

- Check existing documentation in the `docs/` directory
- Review the TODO list in `TODO.md` for upcoming work
- Ask questions in the team chat
- Pair with experienced team members for complex features

## Common Tasks

### Adding a New Component

1. Create the component in `src/lib/components/`
2. Follow existing patterns for props and events
3. Add stories for documentation (if using Storybook)
4. Write tests for the component

### Adding a New Feature

1. Create a feature branch
2. Implement the feature following architecture patterns
3. Add tests for new functionality
4. Update documentation if needed
5. Create a pull request for review

### Fixing a Bug

1. Create a test that reproduces the bug
2. Fix the bug
3. Verify the test now passes
4. Create a pull request with a clear description of the issue and fix

## Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Svelte 5 Documentation](https://svelte.dev/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Juno Documentation](https://juno.build/docs)
- [ICP Blockchain Documentation](https://internetcomputer.org/docs)
- [Vitest Documentation](https://vitest.dev/docs)
- [Project TODO List](../TODO.md)
- [Architecture Documentation](./architecture-diagrams.md)
- [Coding Standards](./coding-standards.md)
- [User Guide: Adding Traits](./user-guide-adding-traits.md)
- [User Guide: Generating Collections](./user-guide-generating-collections.md)
- [User Guide: Gallery Mode](./user-guide-gallery-mode.md)
- [User Guide: Ruler Traits](./user-guide-ruler-traits.md)
- [AGENTS.md](../AGENTS.md) - Agent development guidelines

## UI Flow Screenshots

> **Note**: Screenshots will be added as the UI evolves. This section documents the expected user interface flow.

### Main Application Interface

- **Project Management**: Create, save, and load NFT projects
- **Layer Management**: Add, remove, and reorder layers for your NFT collection
- **Trait Management**: Upload and configure traits with rarity settings
- **Preview Panel**: Real-time preview of generated NFTs
- **Generation Controls**: Configure and start batch NFT generation

### Key Screens

1. **Welcome Screen** - Project creation and loading
2. **Layer Editor** - Layer organization and configuration
3. **Trait Upload** - Image upload and rarity configuration
4. **Generation Progress** - Real-time progress monitoring
5. **Export Options** - ZIP export and project packaging

### Navigation Flow

1. Start with project creation or loading
2. Configure layers and upload traits
3. Set output dimensions and project metadata
4. Preview individual NFTs
5. Generate complete collection
6. Export as ZIP package

> **TODO**: Add actual screenshots once UI is stable and production-ready.
