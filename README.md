# GNStudio

Browser-based generative art collection designer. Built with SvelteKit 2, Svelte 5 runes, and TypeScript.

## Features

- **Layer Management** — Multi-layer organization with drag-and-drop reordering
- **Trait System** — Rarity weights (1-5), Ruler Traits for compatibility rules, Strict Pair mode
- **Real-time Preview** — Canvas preview with debounced updates and intelligent caching
- **High-Performance Generation** — Up to 10,000 unique items via Web Worker pool with CSP solving
- **Smart Export** — Streaming ZIP, optimized chunking, multi-ZIP, and storage-backed batch packaging
- **Three-Tier Caching** — ImageBitmap / ImageData / ArrayBuffer with LRU eviction
- **Virtual Gallery** — Interactive trait filtering, rarity calculation, ZIP import
- **PWA Support** — Installable app with offline capabilities
- **Multi-Standard Metadata** — ERC-721 (EVM) and Solana (Metaplex) output formats

## Tech Stack

| Category    | Technologies                                                       |
| ----------- | ------------------------------------------------------------------ |
| Frontend    | SvelteKit 2, Svelte 5 (runes), TypeScript                          |
| Styling     | Tailwind CSS 4, NeoBr-UI, Hugeicons                                |
| Workers     | Multi-worker pool with dynamic scaling, work-stealing              |
| Storage     | OPFS-backed object storage, LocalStorage (project settings), JSZip |
| Validation  | Zod v4 schemas with branded types                                  |
| Testing     | Vitest 4 + jsdom, @testing-library/svelte                          |
| Lint/Format | Oxlint + Oxfmt (via Vite+)                                         |
| Deployment  | Juno (ICP static hosting)                                          |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
git clone https://github.com/nami2111/gnstudio.git
cd gnstudio
pnpm install
vp dev
```

Open `http://localhost:5173`.

### Production Build

```bash
vp run build
vp preview
```

## Development

### Project Structure

```
src/
├── lib/
│   ├── components/    # UI: layer/, generation/, gallery/, ui/ wrappers
│   ├── domain/        # Business logic + Zod validation schemas
│   ├── storage/       # OPFS/IndexedDB object storage backends
│   ├── persistence/   # Legacy project persistence helpers
│   ├── services/      # Application services (persistence, export, validation)
│   ├── stores/        # Svelte 5 rune stores (*.svelte.ts)
│   ├── types/         # Branded types (ProjectId, LayerId, TraitId)
│   ├── utils/         # Cache, formatting, storage, retry, and monitoring helpers
│   └── workers/       # Web workers: generation, ZIP, worker pool
└── satellite/         # Juno satellite config
```

### Key Scripts

| Command        | Description                |
| -------------- | -------------------------- |
| `vp dev`       | Start dev server           |
| `vp run build` | Build for production       |
| `vp check`     | Format + lint + type check |
| `vp lint`      | Lint with Oxlint           |
| `vp fmt`       | Format with Oxfmt          |
| `vp test`      | Run tests                  |

### Code Style

Tabs, single quotes, semicolons, no trailing commas, 100 char line width. JSDoc for public APIs. See `docs/coding-standards.md` for full guidelines.

### Architecture

GNStudio follows a layered, performance-first architecture:

1. **UI Layer** — Svelte 5 components with runes-based reactivity
2. **Domain Layer** — Business logic, validation, worker orchestration
3. **Store Layer** — Reactive state with auto-persistence (500ms debounce)
4. **Worker Layer** — CSP solving, batch scheduling, worker pool, ZIP worker
5. **Storage Layer** — OPFS-backed object storage with IndexedDB fallback
6. **Utils Layer** — Performance monitoring, error handling, memory management

**Export Pipeline**: Two paths — streaming ZIP (persistent worker, 700MB volume flush) or storage streaming (size-bounded 500MB ZIP batches, OPFS when available with IndexedDB fallback). Feature flags: `enableStreamingStorage` (default on), `enableZipWorkerOffloading` (default off).

Browser storage is private to the current browser profile and quota-managed by the browser. Users can export projects/collections to ZIP files when they need a portable copy.

For detailed architecture, see `docs/architecture-diagrams.md` and `docs/performance-architecture.md`.

## Application Structure

### Routes

| Route          | Purpose                                            |
| -------------- | -------------------------------------------------- |
| `/`            | Landing page                                       |
| `/app`         | Generate mode: layers, traits, preview, generation |
| `/app/gallery` | Gallery mode: view, filter, analyze collections    |

### Key Components

- `LayerManager.svelte` — Layer and trait management
- `Preview.svelte` — Real-time item preview
- `GenerationForm.svelte` — Collection generation controls
- `GalleryImport.svelte` — ZIP import interface
- `ModeSwitcher.svelte` — Generate ↔ Gallery navigation

## Documentation

| File                                        | Contents                                  |
| ------------------------------------------- | ----------------------------------------- |
| `docs/onboarding.md`                        | Developer onboarding guide                |
| `docs/architecture-diagrams.md`             | Architecture documentation                |
| `docs/performance-architecture.md`          | Performance architecture                  |
| `docs/api-documentation.md`                 | API reference (stores, services, workers) |
| `docs/feature-flags.md`                     | Feature flag system                       |
| `docs/coding-standards.md`                  | Code style and conventions                |
| `docs/user-guide-generating-collections.md` | User guide: generation & export           |
| `docs/user-guide-gallery-mode.md`           | User guide: gallery mode                  |
| `docs/user-guide-adding-traits.md`          | User guide: adding traits                 |

## Environment Variables

- `VITE_APP_SATELLITE_ID` — Juno satellite ID (optional)
- `VITE_ENABLE_<FLAG>` / `VITE_DISABLE_<FLAG>` — Feature flag overrides

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- [SvelteKit](https://kit.svelte.dev/) and Svelte 5
- [NeoBr-UI](https://github.com/nami2111/NeoBr-UI) design system
- [Hugeicons](https://hugeicons.com/) icons
- [Tailwind CSS](https://tailwindcss.com/)
- [Juno](https://juno.build/) for static hosting
