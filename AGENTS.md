# GNStudio - Agent Guidelines

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
│   ├── components/      # UI: layer/, preview/, ui/ (NeoBr-UI wrappers)
│   ├── domain/          # Business logic + Zod validation schemas
│   ├── stores/          # Svelte 5 rune stores (*.svelte.ts suffix)
│   ├── workers/         # Web workers for generation (multi-worker pool)
│   ├── persistence/     # IndexedDB + LocalStorage abstraction
│   ├── utils/           # Optimization: sprite-packer, combination-indexer
│   └── types/           # Branded types (ProjectId, LayerId, TraitId)
└── satellite/           # Juno satellite config
```

**Key stores**: `project.store.svelte.ts` (auto-persists with 500ms debounce), `gallery.store.svelte.ts` (IndexedDB), `resource-manager.ts` (3-tier cache).

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
- NeoBr-UI components are wrapped in `src/lib/components/ui/` — use those wrappers, not raw imports
- `@neobr/tailwind-preset` is overridden to v1.0.4 in pnpm overrides — don't upgrade without testing
- Projects with traits are skipped during auto-save to avoid broken references

## How to navigate this repo

- Use `codedb_tree` first to orient.
- Use `codedb_context` with a natural-language task when starting work
  on an unfamiliar area — one call replaces 3–5 search/word/symbol calls.
- Use `codedb_symbol` for exact definition lookups, `codedb_search` for
  substring matches, `codedb_word` for single-identifier lookups.
- Use `codedb_callers` to find every usage of a symbol before refactoring.
