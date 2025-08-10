# NFT Studio Coding Standards

## Commenting Guidelines

### Block Comments (JSDoc)

- Use JSDoc style for documenting functions, classes, and interfaces
- Begin with `/**` and end with `*/`
- Use `*` at the beginning of each line
- Include a brief description, parameters, and return values when applicable

Example:

```typescript
/**
 * Prepare layers for worker with validation.
 * Validates input layers and traits, ensuring at least one trait per layer and valid image data,
 * and converts to a transferable payload for workers.
 * @param layers - The layers to prepare
 * @returns Promise resolving to transferrable layers
 */
export async function prepareLayersForWorker(layers: Layer[]): Promise<TransferrableLayer[]> {
	// Implementation
}
```

### Inline Comments

- Use `//` for inline comments
- Place a single space after `//`
- Start with a capital letter and end with a period
- Use for explaining complex logic or non-obvious code
- Keep concise but descriptive

Example:

```typescript
// Validate that all layers have valid image data
for (const layer of layers) {
	// Implementation
}
```

### Trailing Comments

- Use sparingly
- Place two spaces after the code
- Keep very brief

Example:

```typescript
const LOCAL_STORE = new LocalStorageStore<Project>(PROJECT_STORAGE_KEY); // migrated to persistence layer
```

## Formatting Standards

### General

- Use tabs for indentation (as per .prettierrc)
- Use single quotes for strings (as per .prettierrc)
- No trailing commas (as per .prettierrc)
- Print width of 100 characters (as per .prettierrc)

### Svelte Files

- Separate script, markup, and style sections with blank lines
- Use TypeScript in script tags (`<script lang="ts">`)
- Place component imports at the top
- Group related imports together

### TypeScript Files

- Place imports at the top of the file
- Group imports in the following order:
  1. External libraries
  2. Svelte imports
  3. Project imports (using $lib aliases)
- Place interfaces and types before implementation
- Export functions and classes that are used externally

## Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes, interfaces, and types
- Use UPPER_CASE for constants
- Use descriptive names that convey purpose
