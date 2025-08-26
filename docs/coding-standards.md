# NFT Studio Coding Standards

## Commenting Guidelines

### Block Comments (JSDoc)

- Use JSDoc style for documenting functions, classes, and interfaces
- Begin with `/**` and end with `*/`
- Use `*` at the beginning of each line
- Include a brief description, parameters, return values, and examples when applicable
- Use `@deprecated` tag for deprecated functions with migration guidance
- Use `@throws` tag for functions that throw exceptions

Example:

````typescript
/**
 * Prepare layers for worker with validation.
 * Validates input layers and traits, ensuring at least one trait per layer and valid image data,
 * and converts to a transferable payload for workers.
 * @param layers - The layers to prepare
 * @returns Promise resolving to transferrable layers
 * @throws {ValidationError} If layer validation fails
 * @example
 * ```typescript
 * const transferrableLayers = await prepareLayersForWorker(layers);
 * ```
 */
export async function prepareLayersForWorker(layers: Layer[]): Promise<TransferrableLayer[]> {
	// Implementation
}
````

### Inline Comments

- Use `//` for inline comments
- Place a single space after `//`
- Start with a capital letter and end with a period
- Use for explaining complex logic, non-obvious code, or business rules
- Keep concise but descriptive
- Avoid redundant comments that just restate what the code does

Example:

```typescript
// Validate that all layers have valid image data before processing
for (const layer of layers) {
	// Implementation
}
```

### Trailing Comments

- Use sparingly
- Place two spaces after the code
- Keep very brief
- Useful for short clarifications or tagging

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
- Always use semicolons to terminate statements
- Use strict equality operators (`===` and `!==`) instead of loose equality (`==` and `!=`)

### Svelte Files

- Separate script, markup, and style sections with blank lines
- Use TypeScript in script tags (`<script lang="ts">`)
- Place component imports at the top of the script section
- Group related imports together
- Use reactive statements (`$:`) for computed values
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`) when appropriate
- Keep markup clean and semantic
- Use proper accessibility attributes (aria-\*, role, etc.)

Example structure:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import Component from '$lib/components/Component.svelte';

	let count = $state(0);

	$effect(() => {
		console.log('Count changed:', count);
	});
</script>

<div class="container">
	<Component {count} />
</div>

<style>
	.container {
		padding: 1rem;
	}
</style>
```

### TypeScript Files

- Place imports at the top of the file
- Group imports in the following order:
  1. External libraries
  2. Svelte imports
  3. Project imports (using $lib aliases)
- Leave a blank line between import groups
- Place interfaces and types before implementation
- Export functions and classes that are used externally
- Use explicit return types for public functions
- Use `type` for object shapes and `interface` for class-like structures

Example:

```typescript
// External libraries
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

// Svelte imports
import type { ComponentProps } from 'svelte';

// Project imports
import type { Layer } from '$lib/types/layer';
import { validateLayer } from '$lib/utils/validation';

export interface LayerManagerProps {
	layers: Layer[];
	onUpdate: (layers: Layer[]) => void;
}

export function createLayerManager(initialLayers: Layer[]): Writable<Layer[]> {
	const { subscribe, set, update } = writable(initialLayers);

	return {
		subscribe,
		addLayer: (layer: Layer) => update((layers) => [...layers, layer]),
		removeLayer: (id: string) => update((layers) => layers.filter((l) => l.id !== id)),
		set
	};
}
```

## Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes, interfaces, and types
- Use UPPER_CASE for constants
- Use descriptive names that convey purpose
- Use verbs for functions (e.g., `validateInput`, `calculateRarity`)
- Use nouns for variables and properties (e.g., `userCount`, `isVisible`)
- Prefix boolean variables with `is`, `has`, `can`, or `should`
- Prefix private class members with `_`
- Use plural names for collections (e.g., `layers`, `traits`)
- Use singular names for single items (e.g., `layer`, `trait`)

## Error Handling

- Always handle asynchronous operations with try/catch blocks
- Use the project's error handling utilities
- Provide meaningful error messages to users
- Log errors with appropriate context for debugging
- Use specific error types rather than generic Error

Example:

```typescript
try {
	const result = await processLayers(layers);
	return result;
} catch (error) {
	if (error instanceof ValidationError) {
		showUserError('Please check your layer configuration');
		logError('Layer validation failed', { error, layers });
	} else {
		showUserError('An unexpected error occurred');
		logError('Layer processing failed', { error, layers });
	}
	throw error;
}
```

## Testing

- Write unit tests for pure functions
- Test edge cases and error conditions
- Use descriptive test names that explain the expected behavior
- Mock external dependencies in tests
- Keep tests focused and isolated

Example:

```typescript
describe('validateLayer', () => {
	it('should return true for a valid layer', () => {
		const layer = createValidLayer();
		expect(validateLayer(layer)).toBe(true);
	});

	it('should return false for a layer with no traits', () => {
		const layer = createLayerWithNoTraits();
		expect(validateLayer(layer)).toBe(false);
	});
});
```
