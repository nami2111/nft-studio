# NFT Studio — Improvement Plan

Last updated: 2026-04-28
Source: Deep codebase analysis across 5 dimensions (structure, types, state, UI, data layer)

---

## Critical (Fix Immediately)

### 1. Fix Broken Component Test Suite

**Problem**: 53 of 114 tests (0% component pass rate) fail with `lifecycle_function_unavailable: mount()`.
`@testing-library/svelte` 5.3.1 + Svelte 5.54.0 loads the server-side module in jsdom, where `mount()` doesn't exist.
Two test files (`GenerationForm.test.ts`, `ProjectManagement.test.ts`) can't even load due to a broken import
(`@testing-library/jest-dom/vite-plus/test` — this path doesn't exist).

**Action**:

- [ ] Upgrade `@testing-library/svelte` to latest (check for Svelte 5 fix)
- [ ] If no fix available, switch to `@sveltejs/vite-plugin-svelte` testing mode or `svelte/testing` helpers
- [ ] Fix broken import in `GenerationForm.test.ts` and `ProjectManagement.test.ts` — use `@testing-library/jest-dom` (without `/vite-plus/test`)
- [ ] Remove dead test files: `StrictPair.test.ts` (1 test, 0 assertions), `crypto.test.ts` (console.log check)

**Success criteria**: `vp test` passes 100%.

### 2. Set Up CI/CD Pipeline

**Problem**: `.github/` contains only an empty `inventory.md`. No automated testing, linting, or build verification
on push/PR.

**Action**:

- [ ] Create `.github/workflows/ci.yml` with jobs: lint, typecheck, test, build
- [ ] Wire `test:ci` and `lint-ci` scripts from package.json
- [ ] Add branch protection rules on `main` (require passing CI)

**Success criteria**: PRs are blocked if CI fails.

### 3. Decide: NFT Tool or Collection Builder?

**Problem**: The app name implies blockchain integration, but there is **zero on-chain functionality** — no wallet connect,
no minting, no IPFS, no smart contracts. No `ethers`/`viem`/`wagmi` deps. Metadata `image` field hardcoded to `'cid:image'`.

**Action**:

- [ ] Decide product direction: (A) rename/reposition as "generative collection builder" or (B) add real NFT minting
- [ ] If (A): update README, OG tags, PWA name, and landing page copy to remove NFT branding
- [ ] If (B): add wallet connect (wagmi), IPFS upload, smart contract deployment tools
- [ ] Either way: remove the `'cid:image'` placeholder and show a clear "upload your images to IPFS" step in export flow

**Success criteria**: Name/description accurately reflects what the tool does.

---

## High Priority (Fix Soon)

### 4. Split the Project Store God Object

**Problem**: `project.store.svelte.ts` is 559 lines with ~40 exported mutator functions. Handles validation,
persistence, loading state, batch updates, strict pair config, and ZIP import/export. Will resist refactoring as features grow.

**Action**:

- [ ] Extract `load/save` orchestration into `project.persistence.ts`
- [ ] Extract domain mutations into `project.mutations.ts`
- [ ] Move commented-out disabled feature blocks to commit history or docs (lines 30-58)
- [ ] Keep `project.store.svelte.ts` as a thin re-export barrel

**Success criteria**: File < 200 lines, each concern in its own module.

### 5. Fix Runtime Branded Type Enforcement

**Problem**: Branded types (`ProjectId`, `LayerId`, `TraitId`) are compile-time only. `isProjectId()` just checks
`typeof val === 'string'`. Zod schemas strip brands. No runtime guard.

**Action**:

- [ ] Add actual runtime discriminant (e.g., `Branded<T, B>` → `{ __brand: B, __value: T }` wrapper class) or use branded string functions that validate format
- [ ] Remove unused `Brand.value` field from the type signature
- [ ] Integrate brand validation into Zod schemas (`.refine()` or `.transform()`) so `safeParse` output retains brands

**Success criteria**: Passing a plain `string` where a `ProjectId` is expected fails at runtime.

### 6. Consistent Store Access Patterns

**Problem**: Components import stores 4 different ways: barrel (`$lib/stores`), direct path, `getGalleryStore()`,
`usePerformanceMonitoring()`. Gallery and generation stores aren't in the barrel. Unclear what comes from where.

**Action**:

- [ ] Decide on one pattern: module-level `$state` singleton with barrel re-export (matches current majority)
- [ ] Add `galleryStore` and `generationState` to `src/lib/stores/index.ts` barrel
- [ ] Remove `getGalleryStore()` indirection — direct import the singleton
- [ ] Document the pattern in AGENTS.md

**Success criteria**: Every store import comes from `$lib/stores`.

---

## Medium Priority (Fix When Possible)

### 7. Gallery Image Persistence

**Problem**: `gallery-db.ts` stores `imageData: new ArrayBuffer(0)` — gallery images are lost if in-memory cache
is evicted (tab close, memory pressure). No recovery.

**Action**:

- [ ] Store generated images in IndexedDB (per-collection image stores) with lazy load
- [ ] Or: add a clear "gallery images are session-only" warning to the UI
- [ ] Consider using `CacheStorage` API for image blob persistence

**Success criteria**: Gallery images survive page refresh.

### 8. Remove Dead Speculative Abstractions

**Problem**: `DomainValidationResult`, `IDomainProjectLike`, `IDomainRepository`, `IDomainService`, domain event types
(`ProjectCreatedEvent`, etc.) are defined but never consumed. These were designed for a multi-implementation pattern
that never materialized.

**Action**:

- [ ] Remove unused exports from `src/lib/domain/models.ts`
- [ ] Remove `_needsProperLoad: boolean` from the public `Project` interface — move to store-level state
- [ ] Remove commented-out auto-load/background-load blocks in `project.store.svelte.ts` (lines 30-58)

**Success criteria**: No dead exports remain. `Project` interface has only user-facing fields.

### 9. Lock In CI-Ready Test Infrastructure

**Problem**: Tests pass locally but format/lint config is scattered across `vite.config.ts` only. No pre-commit hooks.

**Action**:

- [ ] Add `simple-git-hooks` or `husky` pre-commit hook running `vp check`
- [ ] Add `simple-git-hooks` pre-push hook running `vp test`
- [ ] Move lint/fmt config from `vite.config.ts` to dedicated config files if oxlint/oxfmt support them

**Success criteria**: Can't commit without formatting, can't push without passing tests.

### 10. Fix sanitizeString() Truncation-for-Validation Issue

**Problem**: `sanitizeString()` truncates to 100 chars before Zod `max(100)` validation. A 500-char name silently
passes as a 100-char truncated string instead of failing. Tests at `validation.test.ts:78-80` confirm this.

**Action**:

- [ ] Separate truncation from validation: validate first, truncate only for display
- [ ] Or: validate raw input before sanitization

**Success criteria**: `validateProjectName('a'.repeat(500))` should fail, not silently pass as 100 chars.

---

## Low Priority (Polish)

### 11. Fix Dark Mode in Gallery Sort Dropdown

- File: `src/routes/app/gallery/+page.svelte`
- Hardcoded `background: rgba(255, 255, 255, 0.95)` — add dark variant with `dark:bg-card/95`

### 12. Use SvelteKit goto() Instead of window.location.href in ModeSwitcher

- File: `src/lib/components/shared/ModeSwitcher.svelte`
- Causes full page reloads between generate/gallery modes
- Import and use `goto()` from `$app/navigation`

### 13. Remove @ts-ignore / as any on NeoBrModal

- Files: `ui/modal/modal.svelte`, layer components using `RulerRulesManager`
- Fix the actual type issue or add proper type declarations

### 14. Remove Unused TransferrableTrait Width/Height Fields

- File: `src/lib/types/worker-messages.ts`
- Fields declared for "better memory management" but never populated
- Either populate from `imageData` metadata or remove

### 15. Fix Gallery Page Component Size

- File: `src/routes/app/gallery/+page.svelte` is 617 lines — extract sort dropdown, filter UI, and responsive
  layout blocks into sub-components

### 16. Fix About Page Component Size

- File: `src/routes/about/+page.svelte` is ~1500 lines — extract tab content sections into separate components
  or move documentation to markdown

### 17. Move NeedsReupload.svelte to shared/

- File: `src/lib/components/ui/NeedsReupload.svelte`
- It's a display-state component, not a UI primitive — doesn't belong in `ui/`

### 18. Fix GenerationProgress Direct State Mutation

- File: `src/lib/domain/worker.service.ts` line 129
- Mutates `generationState` directly instead of calling `GenerationStateManager.cancelGeneration()`

### 19. Add E2E Testing

- Add Playwright for browser-level tests: gallery navigation, generation flow, project save/load

### 20. Add Accessibility Testing

- Integrate `axe-core` with Playwright E2E tests

### 21. Add Lighthouse CI

- Performance budget enforcement, no unintended regressions on build

---

## Priority Summary

| Priority | Item                                       | Effort     |
| -------- | ------------------------------------------ | ---------- |
| Critical | Fix component test suite                   | Medium     |
| Critical | Set up CI/CD                               | Small      |
| Critical | Clarify product direction (NFT vs builder) | Discussion |
| High     | Split project store                        | Large      |
| High     | Runtime branded types                      | Medium     |
| High     | Consistent store access                    | Small      |
| Medium   | Gallery image persistence                  | Medium     |
| Medium   | Remove dead code                           | Small      |
| Medium   | Pre-commit hooks                           | Small      |
| Medium   | Fix sanitizeString validation              | Small      |
| Low      | Dark mode, goto(), ts-ignore, dead fields  | Trivial    |
| Low      | Component refactoring (gallery, about)     | Medium     |
| Low      | E2E, a11y, Lighthouse CI                   | Large      |
