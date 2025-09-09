# In-Code Documentation Guidelines

## Overview

Proper documentation is essential for maintaining a codebase that can be easily understood and contributed to. This guide outlines the standards for documenting code within the NFT Studio project.

## Documentation Types

### JSDoc/TSDoc Comments

All public functions, classes, interfaces, and modules must be documented with JSDoc/TSDoc comments. This includes:

- **Functions**: Document parameters, return values, and exceptions
- **Classes**: Document purpose, properties, and methods
- **Interfaces**: Document all properties and their types
- **Modules**: Document the purpose and main exports

Example:

````typescript
/**
 * Calculates the rarity distribution for traits across layers.
 * Uses the configured rarity weights to determine how often each trait should appear.
 *
 * @param layers - The layers with their traits and rarity weights
 * @param count - The total number of NFTs to generate
 * @returns A map of layer IDs to trait distributions
 * @throws {ValidationError} If layer configuration is invalid
 *
 * @example
 * ```typescript
 * const distribution = calculateRarityDistribution(layers, 1000);
 * ```
 */
export function calculateRarityDistribution(layers: Layer[], count: number): TraitDistribution {
	// Implementation
}
````

### Module Documentation

Each module (file) should have a brief description at the top explaining its purpose:

```typescript
/**
 * Layer management utilities.
 * Provides functions for creating, validating, and manipulating layers and their traits.
 */

// Module implementation
```

### Complex Algorithm Documentation

Complex algorithms should be documented with inline comments explaining the logic:

```typescript
// Use Fisher-Yates shuffle algorithm to randomize trait selection
// This ensures even distribution while respecting rarity weights
for (let i = traits.length - 1; i > 0; i--) {
	const j = Math.floor(Math.random() * (i + 1));
	[traits[i], traits[j]] = [traits[j], traits[i]];
}
```

## Documentation Content

### What to Document

1. **Public APIs**: All exported functions, classes, and interfaces
2. **Complex Logic**: Business rules, algorithms, and non-obvious implementations
3. **Configuration Options**: Environment variables, settings, and parameters
4. **Data Structures**: Purpose and usage of complex objects
5. **Side Effects**: Functions that modify state or have external dependencies
6. **Utility Usage**: Integration with project utilities like error-handler.ts for error management and logger.ts for logging

### What Not to Document

1. **Self-Explanatory Code**: `const userName = 'John';` doesn't need a comment
2. **Redundant Information**: Avoid comments that just restate what the code does
3. **Outdated Comments**: Keep documentation in sync with code changes

## Examples and Usage

Include practical examples for complex functions:

````typescript
/**
 * Generates NFT metadata based on layer configurations.
 *
 * @example
 * ```typescript
 * const metadata = await generateMetadata({
 *   name: 'My NFT Collection',
 *   layers: [backgroundLayer, characterLayer],
 *   count: 100
 * });
 *
 * // Result:
 * // {
 * //   "1": {
 * //     "name": "My NFT Collection #1",
 * //     "attributes": [
 * //       {"trait_type": "Background", "value": "Blue"},
 * //       {"trait_type": "Character", "value": "Robot"}
 * //     ]
 * //   }
 * // }
 * ```
 */
````

## Maintenance

- Update documentation when modifying code
- Review documentation during code reviews
- Remove outdated comments when refactoring
- Use tools like `pnpm standardize-comments` to maintain consistency
