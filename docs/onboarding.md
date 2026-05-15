# GNStudio Onboarding Guide

Welcome to the GNStudio development team! This guide will help you get set up and start contributing to the project.

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (version 18 or higher)
- pnpm (package manager)
- Git

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd gnstudio
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Run Full Check

```bash
vp check
```

### 4. Start the Development Server

```bash
vp dev
```

The application will be available at `http://localhost:5173`

## Application Modes

GNStudio provides two sophisticated modes for working with item collections:

### Generate Mode (`/app`)

#### Professional Item Creation Environment

- **Purpose**: Create new item collections from layers and traits with advanced controls
- **Core Features**:
  - Advanced layer management with drag-and-drop reordering
  - Sophisticated trait system with Ruler Trait compatibility rules
  - Real-time Canvas preview with debounced updates (200ms)
  - High-performance batch generation (up to 10,000 items)
  - Intelligent worker pool with device optimization
- **Advanced Capabilities**:
  - Ruler Traits for complex trait compatibility rules
  - Bulk trait operations with progress tracking
  - Smart caching with three-tier memory management
  - Project auto-save with intelligent persistence
- **Workflow**: Design Layers → Upload Traits → Configure Rules → Generate Collection → Export ZIP

### Gallery Mode (`/app/gallery`)

#### Interactive Collection Analysis & Management

- **Purpose**: View, filter, and analyze existing item collections with professional tools
- **Core Features**:
  - Virtual scrolling gallery optimized for large collections
  - Interactive trait filtering with multi-dimensional selection
  - Automatic rarity calculation and ranking system
  - Import existing collections from ZIP files
  - Responsive layouts (3-6 columns based on device)
- **Advanced Capabilities**:
  - Click any trait to instantly filter the entire collection
  - Natural numeric sorting for item names ("Foxinity #1", "#001", etc.)
  - Multi-collection support with independent statistics
  - Real-time search with performance optimization
  - Collection statistics and rarity analysis
- **Workflow**: Import Collection → Analyze Rarity → Interactive Filtering → Export Results

### Mode Switching

- **Seamless Navigation**: Use the **"Gallery Mode"** button in the top-right corner to switch between modes
- **Independent State**: Each mode maintains its own workspace and data
- **Data Flow**: Generate Mode → Export ZIP → Import to Gallery Mode for analysis
- **Performance Optimization**: Each mode has specialized caching and performance tuning
- **Feature Flags**: Generation behavior can be tuned via feature flags (`enableStreamingStorage`, `enableAdaptiveBatchSize`, `enableLayerRef`, `enableZipWorkerOffloading`) — see [Feature Flags](#feature-flags) section for details

### Metadata Standards

GNStudio supports two metadata output formats for generated collections:

- **ERC-721** (`MetadataStandard.ERC721`): Compatible with OpenSea and EVM marketplaces. Includes `external_url`, `animation_url`, `youtube_url`, `background_color` (6-char hex), and standard `attributes` array with optional `display_type` and `max_value` for numeric traits.

- **Solana** (`MetadataStandard.SOLANA`): Metaplex standard for Solana NFTs. Includes `symbol`, `seller_fee_basis_points`, `creators` array (address + share), `collection` info, and `properties` with a `files` array listing image and animation URIs.

The default strategy is ERC-721. Strategies are registered in `src/lib/domain/metadata/strategies.ts` and selected via the metadata configuration UI.

For detailed information about Gallery Mode features and interactive filtering, see [User Guide: Gallery Mode](./user-guide-gallery-mode.md).

## Project Structure

```bash
gnstudio/
├── docs/                    # Comprehensive documentation
│   ├── onboarding.md        # Developer onboarding guide
│   ├── architecture-diagrams.md  # Detailed architecture documentation
│   ├── coding-standards.md  # Code style and conventions
│   └── user-guides/         # User documentation for features
├── scripts/                 # Build and utility scripts
├── src/                     # Source code
│   ├── lib/                 # Core application code
│   │   ├── components/       # Reusable UI components
│   │   │   ├── layer/       # Layer and trait management components
│   │   │   ├── gallery/     # Gallery and collection components
│   │   │   ├── generation/  # Generation and preview components
│   │   │   ├── layout/      # Page layout and structural components
│   │   │   ├── monitor/     # Performance monitoring components
│   │   │   ├── project/     # Project management components
│   │   │   ├── shared/      # Common shared components
│   │   │   └── ui/          # Base UI component library (Shadcn-like)
│   │   ├── stores/           # State management with Svelte 5 runes
│   │   │   ├── project.store.svelte.ts  # Main project state
│   │   │   ├── gallery.store.svelte.ts  # Gallery collection state
│   │   │   ├── resource-manager.ts     # Memory and cache management
│   │   │   └── file-operations.ts      # Import/export functionality
│   │   ├── domain/           # Business logic and validation
│   │   │   ├── validation.ts          # Logic-based validation
│   │   │   ├── project.domain.ts      # Project business logic
│   │   │   ├── worker.service.ts      # Worker orchestration
│   │   │   ├── rarity-calculator.ts   # Rarity calculation algorithms
│   │   │   └── metadata/              # Metadata output strategies
│   │   │       ├── metadata.strategy.ts  # Strategy interface & types
│   │   │       └── strategies.ts         # ERC-721 & Solana implementations
│   │   ├── services/         # Application services
│   │   │   ├── persistence.service.ts  # Storage management
│   │   │   └── validation.service.ts   # Core validation service
│   │   ├── workers/          # Advanced worker pool system
│   │   │   ├── cache/                 # Worker-level caching
│   │   │   │   └── array-buffer.cache.ts  # ArrayBuffer cache for images
│   │   │   ├── pool/                  # Worker pool infrastructure
│   │   │   │   ├── pool.ts           # Dynamic worker pool management
│   │   │   │   ├── state.ts          # Pool state tracking
│   │   │   │   ├── types.ts          # Pool type definitions
│   │   │   │   ├── sanitize.ts       # Worker data sanitization
│   │   │   │   └── index.ts          # Pool public API
│   │   │   ├── worker.pool.ts        # Legacy pool (re-export)
│   │   │   └── generation.worker.ts  # Canvas-based generation
│   │   ├── utils/            # Performance and utility functions
│   │   │   ├── performance-monitor.ts  # Performance tracking
│   │   │   ├── error-handler.ts       # Error management
│   │   │   ├── advanced-cache.ts       # Three-tier caching system
│   │   │   └── combination-indexer.ts  # Trait combination indexing
│   │   ├── config/           # Application configuration
│   │   │   └── feature-flags.ts       # Runtime feature flag system
│   │   ├── types/            # TypeScript definitions
│   │   └── persistence/      # Data storage abstraction
│   ├── routes/               # SvelteKit page routes
│   │   ├── +page.svelte      # Landing page
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

## PWA & Offline Support

GNStudio is a Progressive Web App with offline capabilities powered by `vite-plugin-pwa`:

- **Service Worker**: Auto-update registration (`registerType: 'autoUpdate'`) with `skipWaiting` and `clientsClaim` for seamless updates.
- **Runtime Caching**: Google Fonts (both `fonts.googleapis.com` and `fonts.gstatic.com`) cached with a CacheFirst strategy for 365 days.
- **Manifest**: Configured in `vite.config.ts` with icons at 64x64, 192x192, 512x512, and a dedicated maskable icon at 512x512. Theme color `#3b82f6`, display mode `standalone`.
- **Offline Capabilities**: Navigate fallback to `/` (excluding `/_app/`, `/api/`, and `/manifest.webmanifest` paths). Static assets (JS, CSS, images, fonts, JSON) are precached via `globPatterns`.

The service worker is injected via a script tag in `src/app.html`. The manifest is linked as `/manifest.webmanifest`.

## Development Workflow

### Running Tests

```bash
# Run all tests
vp test

# Run tests in watch mode
vp test watch

# Run tests with coverage
vp test run --coverage
```

### Code Quality Checks

```bash
# Format + lint + type check
vp check

# Lint code with Oxlint
vp lint

# Format code with Oxfmt
vp fmt
```

### Building for Production

```bash
# Build the application
vp run build

# Preview the built application
vp run preview
```

## Feature Flags

Runtime feature flags allow phased rollout of optimizations without redeployment. Flags are defined in `src/lib/config/feature-flags.ts` and toggled via environment variables:

| Flag                         | Default   | Purpose                                             |
| ---------------------------- | --------- | --------------------------------------------------- |
| `enableStreamingStorage`     | Enabled   | Stream generated images/metadata to IndexedDB instead of accumulating in memory |
| `enableLayerRef`             | Disabled  | Transfer layers by reference (ID-based batching) instead of full layers per batch |
| `enableAdaptiveBatchSize`    | Enabled   | Dynamic batch sizing based on collection size, worker count, and resolution |
| `enableZipWorkerOffloading`  | Disabled  | Offload ZIP packaging to a dedicated Web Worker |

### Environment Variable Convention

- `VITE_ENABLE_<FLAG>` — enable a feature originally disabled
- `VITE_DISABLE_<FLAG>` — disable a feature originally enabled

Example: `VITE_DISABLE_STREAMING_STORAGE=true vp dev` runs the dev server with streaming storage disabled.

Flags can also be overridden at runtime via `setFeatureFlags()` (useful for dev UI panels or testing). Call `resetFeatureFlags()` to restore defaults.

## Deployment

GNStudio is deployed to the Internet Computer via **Juno** (ICP-based static hosting):

- **Platform**: Juno with `@junobuild/vite-plugin`
- **Production Satellite ID**: `dpl4s-kqaaa-aaaal-asg3a-cai`
- **Orbiter ID**: `p2pi7-hiaaa-aaaal-asaia-cai` (analytics)
- **Config**: `juno.config.ts` — defines satellite IDs per environment, storage headers (CSP, gzip content types), and predeploy hook

### Deploy Commands

```bash
# Build the production bundle
vp run build

# Deploy to the satellite
juno hosting deploy
```

The `predeploy` hook in `juno.config.ts` runs `vp run build` automatically before deployment. Use `juno hosting deploy --mode staging` for staging deployments.

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
2. Run all checks (`vp check`)
3. Create a PR with a clear description of changes
4. Request review from team members
5. Address feedback and merge after approval

## Project Architecture

The GNStudio follows a layered architecture:

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

| Script                   | Purpose                    |
| ------------------------ | -------------------------- |
| `vp dev`                 | Start development server   |
| `vp run build`           | Build for production       |
| `vp check`               | Format + lint + type check |
| `vp lint`                | Lint with Oxlint           |
| `vp fmt`                 | Format with Oxfmt          |
| `vp test`                | Run tests                  |
| `vp test watch`          | Run tests in watch mode    |
| `vp test run --coverage` | Run tests with coverage    |
| `vp run preview`         | Preview production build   |

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

- **Project Management**: Create, save, and load item projects
- **Layer Management**: Add, remove, and reorder layers for your item collection
- **Trait Management**: Upload and configure traits with rarity settings
- **Preview Panel**: Real-time preview of generated items
- **Generation Controls**: Configure and start batch item generation

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
4. Preview individual items
5. Generate complete collection
6. Export as ZIP package

> **TODO**: Add actual screenshots once UI is stable and production-ready.
