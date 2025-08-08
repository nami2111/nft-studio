# NFT Studio Memory Bank — Tech

Technologies used
- Frontend: SvelteKit, TypeScript
- Persistence: IndexedDB
- Background tasks: Web Workers
- Data modeling: TypeScript interfaces for core domain objects
- Deploy to ICP Blockchain with Juno.build

Development setup
- Clone repository
- Install: pnpm install
- Run development server: pnpm dev
- Run Build: pnpm build
- Tests: pnpm test
- Linting: pnpm lint
- Formatting: pnpm format
- Type checking: pnpm check


Key dependencies and tooling
- SvelteKit
- TypeScript
- IndexedDB (browser storage)
- Web Workers
- Vitest
- Tailwind CSS

Environment and configuration
- Memory Bank runs in the browser; no server dependencies required
- No special environment variables needed for core functionality

Contribution notes
- Update memory-bank docs in .kilocode/rules/memory-bank
- Follow memory bank architecture and tech guidelines when extending