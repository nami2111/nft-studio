# NFT Studio Codebase Improvement Suggestions

## 1. Testing

[DONE] Unit tests for validation utils implemented. Test runner updated with watch and coverage. Component, integration, and E2E tests pending.

## 2. Performance Optimizations

- **Worker Enhancements**: The generation worker is well-optimized with chunking and ImageBitmap. Add support for WebAssembly (e.g., via Rust/WASM for faster image compositing) for large collections (>10k). Implement progressive rendering previews.
- **Image Handling**: Pre-compress uploads with Canvas API to reduce ArrayBuffer sizes. Use Web Workers for image resizing during upload to avoid UI blocking.
- **Lazy Loading**: In LayerManager and VirtualTraitList, use IntersectionObserver for lazy-loading trait previews. Optimize re-renders in stores with fine-grained runes updates.
- **Bundle Analysis**: Integrate rollup-plugin-visualizer more actively; run it in CI to monitor bundle size growth.

## 3. Security Improvements

- **Image Validation**: Add server-side-like validation in browser: check file types strictly (only PNG/JPG), limit file sizes (e.g., <10MB per trait), and scan for malicious content using Canvas taint checks before processing.
- **CSP Refinements**: Current CSP in hooks/server.ts is solid; add 'worker-src 'self'' explicitly. For Juno integration, whitelist necessary domains if used.
- **Data Sanitization**: In persistence, escape/sanitize all user inputs (project names, etc.) to prevent XSS in metadata exports. Validate ZIP imports more rigorously (e.g., traverse only expected structure).
- **Secrets Management**: Ensure no hardcoded keys; use environment variables for any future API integrations.

## 4. Documentation and Developer Experience

- **Expand Docs**: Update docs/ with user guides (e.g., how to add traits, generate collections) and API docs for stores/domain. Use JSDoc consistently for all public functions.
- **Code Comments**: Minimal comments align with guidelines, but add more for complex worker logic (e.g., chunking algorithm). Create a CONTRIBUTING.md with setup instructions.
- **Changelog**: Add CHANGELOG.md tracking versions from 0.2.1.
- **Onboarding**: Enhance docs/onboarding.md with screenshots of the UI flow.

## 5. Code Quality and Best Practices

- **Refactoring**: Domain validation is duplicated between utils/validation.ts and domain/project.service.ts; consolidate into a single validation module. Use Zod for schema validation of Project/Layer/Trait types.
- **Type Safety**: Add more discriminated unions for worker messages. Use branded types for IDs (e.g., ProjectId) to prevent mixing.
- **Error Handling**: Utils/error-handler.ts is good; propagate more typed errors (e.g., ValidationError, StorageError) and add global ErrorBoundary coverage.
- **Accessibility**: Ensure all UI components (buttons, modals) have proper ARIA labels, keyboard navigation, and screen reader support. Test with axe-core.
- **Svelte 5 Migration**: Fully leverage runes; deprecate legacy stores (projectStore, etc.) in favor of runes exports.
- **Build Optimizations**: Add vite-plugin-pwa for offline support (cache static assets). Use adapter-static for full static export.

## 6. Feature Enhancements

- **Export Options**: Beyond ZIP, add direct JSON export for metadata, batch PNG export, or integration with IPFS/Pinata for decentralized storage.
- **UI/UX**: Add drag-and-drop for trait reordering within layers. Implement undo/redo stack for project changes using a history store.
- **Advanced Generation**: Support rarity previews (simulate distributions), background removal for traits, or AI-assisted trait suggestions if integrating ML.
- **Analytics**: Add optional telemetry for generation times/memory usage to improve worker heuristics.

## Priority Roadmap

- High: Add tests, consolidate validation.
- Medium: Performance tweaks, accessibility audit.
- Low: Advanced features, full docs expansion.

These suggestions aim to make the app more robust, performant, and maintainable while preserving its lightweight nature.
