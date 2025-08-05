Project quickref for agents working in this repo. Project PRD in `PRD.md` and SPEC in `SPEC.md`.

Build/lint/typecheck/test

- Dev: pnpm dev (or npm run dev)
- Build: pnpm build (tsc --noEmit && vite build)
- Preview: pnpm preview
- Typecheck: pnpm check (svelte-kit sync && svelte-check --tsconfig ./tsconfig.json)
- Lint: pnpm lint (prettier --check . && eslint .)
- Format: pnpm format
- Single-test: No test runner configured. If tests are added, prefer vitest and expose: pnpm test -t "pattern"

Code style

- Formatting: Prettier with tabs, single quotes, trailingComma none, printWidth 100; use prettier-plugin-svelte and prettier-plugin-tailwindcss. Run pnpm format before commits.
- ESLint: Flat config with @eslint/js recommended, typescript-eslint recommended, eslint-plugin-svelte flat/recommended plus prettier configs; browser and node globals; ignores: build/, .svelte-kit/, dist/, static/.
- Imports: TypeScript ESM ("type": "module"). Group by std libs, external, internal; prefer type-only imports (import type { X } from '...') where applicable. Keep relative paths short; co-locate index.ts barrels (e.g., component ui/\*/index.ts).
- Types: Strict TS (tsconfig present). Prefer explicit types on APIs/exports and store shapes; allow inference for locals.
- Svelte: Components in src/lib/components; one component per file; export props via export let; avoid module-level mutable state; use stores from src/lib/stores.
- Naming: PascalCase for Svelte components; camelCase for vars/functions; SCREAMING_SNAKE_CASE for constants; kebab-case file names except Svelte components.
- CSS/Tailwind: Tailwind v4 with prettier-plugin-tailwindcss; prefer class composition utilities (tailwind-merge, tailwind-variants) when used.
- Error handling: Fail fast on unexpected states; return early; surface user-facing errors with svelte-sonner toasts; avoid console.log in production code.
- Workers: Web workers under src/lib/workers; ensure build-safe imports; keep pure functions and postMessage contracts typed.
- Juno: Postinstall copies @junobuild/core workers into static/workers; do not edit generated files under static/.
- CI: GitHub Actions deploy/publish present; ensure lint and typecheck pass locally before PRs.

Copilot/Cursor rules

- No .cursor/rules or .cursorrules found.
- No .github/copilot-instructions.md found.

Stack

- SvelteKit + TypeScript, Tailwind CSS v4, shadcn-svelte (bits-ui, svelte-headlessui), lucide-svelte, Vite, Juno.build deploy.

Workflow

- Use the MCP server's Sequential Thinking for complex problem solving.
- Use the MCP server's Exa or Brave search to obtain up-to-date information, including the latest or long-term support versions of technologies/stack.
- When selecting and completing a task from TODO.md, mark it as done to better track progress.
- When the main task is complete, prompt the user to commit the changes with a clear and descriptive commit message.
- Don't run server or deploy (`pnpm dev` or `juno dev` or `juno deploy`) let me do that manually.

Knowledge & Stack Documentation

- `/.knowledge/Juno-build-documentation.txt` -> Juno build Documentation.
- `/.knowledge/Svelte-CLI-documentation.txt` -> Svelte CLI Documentation.
- `/.knowledge/Svelte-documentation.txt` -> Svelte Documentation.
- `/.knowledge/SvelteKit-documentation.txt` -> SvelteKit Documentation.
- `/.knowledge/tailwindcss-documentation.txt` -> TailwindCSS Documentation.
