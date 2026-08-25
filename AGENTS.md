# GNStudio - Agent Guidelines

## Memory (NWron MCP)

- Before answering questions about this project's history, decisions, or setup, call `remember` first and ground your answer in what it returns.
- After reaching a decision, changing an architecture choice, or learning a fact worth keeping, call `memorize` to persist it.
- On session start, call `recent` to scan what's already known.

## Project Overview

Browser-based generative art collection designer. SvelteKit 2 (static adapter) + Svelte 5 runes + TypeScript. Deployed to Juno.

## Commands

**Package manager**: `pnpm` (not npm/yarn)

| Command                                         | Description                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `vp run build`                                  | Build for production (runs `tsc --noEmit` + `vp build` + comment removal) |
| `vp check`                                      | Format + lint + type check                                                |
| `vp lint`                                       | Lint with Oxlint (type-aware)                                             |
| `vp fmt`                                        | Format with Oxfmt                                                         |
| `vp test`                                       | Run all tests (vitest + jsdom)                                            |
| `vp test run src/lib/domain/validation.test.ts` | Run single test file                                                      |
| `pnpm verify-lockfile`                          | Verify pnpm-lock.yaml integrity                                           |

**Order for verification**: `vp fmt` → `vp lint` → `vp test`

## Architecture

```
src/
├── routes/              # SvelteKit routes: / (landing), /app (main), /app/gallery
├── lib/
│   ├── components/      # UI: layer/, generation/, gallery/, project/, shared/, layout/, ui/ (NeoBr-UI wrappers)
│   ├── config/          # Feature flags + constants
│   ├── domain/          # Business logic + Zod validation schemas
│   ├── services/        # persistence.service (storage seam consumer), export.service
│   ├── storage/         # Object-storage backends: OPFS primary, IndexedDB fallback
│   ├── stores/          # Svelte 5 rune stores (*.svelte.ts suffix)
│   ├── workers/         # Web workers for generation (multi-worker pool) + zip.worker
│   ├── persistence/     # Read-only legacy readers (pre-OPFS data migration on load)
│   ├── utils/           # zip.ts, error handling, performance-monitor, combination-indexer
│   └── types/           # Branded types (ProjectId, LayerId, TraitId)
└── satellite/           # Juno satellite config
```

**Key stores**: `project.store.svelte.ts` (auto-persists with 1s debounce via `persistenceService`), `gallery.store.svelte.ts` (object-storage backed), `resource-manager.ts` (3-tier cache).

**Custom path aliases**: `$components` → `src/lib/components`, `$utils` → `src/lib/utils` (in addition to SvelteKit defaults).

## Code Style

- **Formatting**: Tabs, single quotes, semicolons, no trailing commas, 100 char line width
- **Imports**: External libs → Svelte imports → Project imports (`$lib`), blank lines between groups
- **Naming**: camelCase for vars/functions, PascalCase for types, UPPER_CASE for constants
- **File naming**: `.svelte.ts` for rune-based stores/modules, `.test.ts` for tests, kebab-case for components
- **Comments**: JSDoc for functions; inline comments start with capital letter and end with period
- **Validation**: Zod v4 schemas with branded types for runtime + compile-time safety

## Svelte 5 Conventions

- Use runes (`$state`, `$derived`, `$effect`) for all reactivity — no legacy `$:` stores
- Components use `.svelte` extension; reactive modules use `.svelte.ts`
- Async markup (`{#await}`) requires `svelte.config.js` async option

## Testing

- Framework: Vitest 4 with jsdom environment
- Component testing: `@testing-library/svelte`
- Test setup: `src/lib/components/test-setup.ts` (auto-loaded via vite.config.ts)
- Coverage thresholds: statements 40%, branches 33%, functions 48%, lines 40%
- Test files excluded from tsconfig (separate compilation)

## Gotchas

- PWA is enabled in dev mode (`devOptions.enabled: true` in vite config)
- `global` is mapped to `globalThis` in vite optimizeDeps (needed for some deps)
- Worker format is `es` — don't use CommonJS patterns in worker files
- NeoBr-UI components are wrapped in `src/lib/components/ui/` — use those wrappers, not raw imports (exception: pass-through barrels only; real components live in feature folders)
- `@neobr/tailwind-preset` is overridden to v1.0.4 in pnpm overrides — don't upgrade without testing
- ZIP read/write goes through `utils/zip.ts` (`@zip.js/zip.js`) — jsdom can't execute zip.js writes, verify ZIP changes in a real browser

## How to navigate this repo

- Use `codedb_tree` first to orient.
- Use `codedb_context` with a natural-language task when starting work
  on an unfamiliar area — one call replaces 3–5 search/word/symbol calls.
- Use `codedb_symbol` for exact definition lookups, `codedb_search` for
  substring matches, `codedb_word` for single-identifier lookups.
- Use `codedb_callers` to find every usage of a symbol before refactoring.
