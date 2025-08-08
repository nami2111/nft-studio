---
applyTo: '**'
---
Build/Lint/Test commands
- Build: npm run build
- Lint: npm run lint
- Check/types: npm run check
- Format: npm run format
- Run a single test (Vitest): npm i -D vitest && npx vitest run path/to/test.file.ts -t "Test name"

Code style guidelines
- Imports: external, internal, local; blank line between groups; drop unused imports.
- Formatting: run prettier; rely on project config.
- Types: prefer explicit TS types; avoid any; export small interfaces.
- Naming: kebab-case for files; PascalCase for types; camelCase for vars/functions.
- Errors: use try/catch; throw meaningful messages; do not swallow.
- Tests: add unit tests with Vitest for new logic; clear describes and assertions.
- Docs: use JSDoc/TSDoc for non-trivial logic.

Cursor rules
Cursor rules: none detected

Copilot rules
Copilot instructions: none found
