# API Documentation

This document provides comprehensive API documentation for NFT Studio's core modules, including stores, domain services, and utilities.

## Table of Contents

- [Stores API](#stores-api)
- [Domain Services API](#domain-services-api)
- [Worker API](#worker-api)
- [Utility Functions](#utility-functions)
- [Type Definitions](#type-definitions)

## Stores API

### Project Store (`src/lib/stores/runes-store.svelte.ts`)

The project store manages the reactive state of the current NFT project using Svelte 5 runes.

#### Core State

```typescript
/**
 * Reactive project state using Svelte 5 runes.
 * Contains the current project data including layers, traits, and configuration.
 * @type {Project}
 */
export const project = $state<Project>(defaultProject());

/**
 * Reactive loading states for various operations.
 * @type {Record<string, boolean>}
 */
export const loadingStates = $state<Record<string, boolean>>({});

/**
 * Reactive detailed loading states with progress information.
 * @type {Record<string, LoadingState>}
 */
export const detailedLoadingStates = $state<Record<string, LoadingState>>({});
```

#### Project Management Functions

```typescript
/**
 * Updates the project name with validation and XSS protection.
 * @param {string} name - The new project name
 * @throws {Error} If the name is invalid
 */
export function updateProjectName(name: string): void;

/**
 * Updates the project description with XSS protection.
 * @param {string} description - The new project description
 */
export function updateProjectDescription(description: string): void;

/**
 * Updates the project dimensions with validation.
 * @param {number} width - The new width in pixels
 * @param {number} height - The new height in pixels
 * @throws {Error} If the dimensions are invalid
 */
export function updateProjectDimensions(width: number, height: number): void;
```

#### Layer Management Functions

```typescript
/**
 * Adds a new layer to the project with validation.
 * @param {Omit<Layer, 'id' | 'traits'>} layer - The layer to add
 * @throws {Error} If the layer name is invalid
 */
export function addLayer(layer: Omit<Layer, 'id' | 'traits'>): void;

/**
 * Removes a layer from the project by ID.
 * @param {string} layerId - The ID of the layer to remove
 */
export function removeLayer(layerId: string): void;

/**
 * Updates the name of a layer with validation.
 * @param {string} layerId - The ID of the layer to update
 * @param {string} name - The new name for the layer
 * @throws {Error} If the layer name is invalid
 */
export function updateLayerName(layerId: string, name: string): void;

/**
 * Reorders the layers in the project.
 * @param {Layer[]} reorderedLayers - The reordered layers
 */
export function reorderLayers(reorderedLayers: Layer[]): void;
```

#### Trait Management Functions

```typescript
/**
 * Adds a new trait to a layer with image processing and security validation.
 * @param {string} layerId - The ID of the layer to add the trait to
 * @param {Omit<Trait, 'id' | 'imageData'> & { imageData: File }} trait - The trait to add
 * @returns {Promise<void>} Resolves when the trait is added
 * @throws {Error} If the trait name is invalid or image processing fails
 */
export async function addTrait(
	layerId: string,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
): Promise<void>;

/**
 * Removes a trait from a layer by ID.
 * @param {string} layerId - The ID of the layer containing the trait
 * @param {string} traitId - The ID of the trait to remove
 */
export function removeTrait(layerId: string, traitId: string): void;

/**
 * Updates the name of a trait with validation.
 * @param {string} layerId - The ID of the layer containing the trait
 * @param {string} traitId - The ID of the trait to update
 * @param {string} name - The new name for the trait
 * @throws {Error} If the trait name is invalid
 */
export function updateTraitName(layerId: string, traitId: string, name: string): void;

/**
 * Updates the rarity weight of a trait.
 * @param {string} layerId - The ID of the layer containing the trait
 * @param {string} traitId - The ID of the trait to update
 * @param {number} rarityWeight - The new rarity weight (1-5)
 */
export function updateTraitRarity(layerId: string, traitId: string, rarityWeight: number): void;
```

#### Loading State Management

```typescript
/**
 * Interface for detailed loading state information.
 */
export interface LoadingState {
	/** Whether the operation is currently loading */
	isLoading: boolean;
	/** Progress percentage (0-100) */
	progress?: number;
	/** Current status message */
	message?: string;
	/** Timestamp when the operation started */
	startTime?: number;
}

/**
 * Starts a detailed loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 * @param {string} [message] - Optional status message
 */
export function startDetailedLoading(key: string, message?: string): void;

/**
 * Updates the progress of a loading operation.
 * @param {string} key - The key identifying the operation
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} [message] - Optional status message
 */
export function updateLoadingProgress(key: string, progress: number, message?: string): void;

/**
 * Stops a detailed loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 */
export function stopDetailedLoading(key: string): void;
```

#### Import/Export Functions

```typescript
/**
 * Saves the current project to a ZIP file with security sanitization.
 * @returns {Promise<void>} Resolves when the project is saved
 */
export async function saveProjectToZip(): Promise<void>;

/**
 * Loads a project from a ZIP file with security validation.
 * @param {File} file - The ZIP file to load
 * @returns {Promise<boolean>} True if the project was loaded successfully
 */
export async function loadProjectFromZip(file: File): Promise<boolean>;
```

## Domain Services API

### Project Service (`src/lib/domain/project.service.ts`)

The project service provides pure business logic functions for project, layer, and trait operations.

#### Validation Functions

```typescript
/**
 * Validates a project name.
 * @param {string} name - The project name to validate
 * @returns {boolean} True if the project name is valid, false otherwise
 */
export function validateProjectName(name: string): boolean;

/**
 * Validates a layer name.
 * @param {string} name - The layer name to validate
 * @returns {boolean} True if the layer name is valid, false otherwise
 */
export function validateLayerName(name: string): boolean;

/**
 * Validates a trait name.
 * @param {string} name - The trait name to validate
 * @returns {boolean} True if the trait name is valid, false otherwise
 */
export function validateTraitName(name: string): boolean;

/**
 * Validates output dimensions for the project.
 * @param {number} width - The width in pixels
 * @param {number} height - The height in pixels
 * @returns {boolean} True if dimensions are valid, false otherwise
 */
export function validateDimensions(width: number, height: number): boolean;
```

#### Project Operations

```typescript
/**
 * Creates a new default project with generated ID and default values.
 * @returns {Project} A new project instance with default configuration
 */
export function createDefaultProject(): Project;

/**
 * Updates the project name with validation.
 * @param {Project} project - The project to update
 * @param {string} name - The new project name
 * @returns {Project} The project with updated name
 * @throws {Error} If project name is invalid
 */
export function updateProjectName(project: Project, name: string): Project;

/**
 * Updates the project description.
 * @param {Project} project - The project to update
 * @param {string} description - The new project description
 * @returns {Project} The project with updated description
 */
export function updateProjectDescription(project: Project, description: string): Project;

/**
 * Updates the project output dimensions with validation.
 * @param {Project} project - The project to update
 * @param {number} width - The new width in pixels
 * @param {number} height - The new height in pixels
 * @returns {Project} The project with updated dimensions
 * @throws {Error} If dimensions are invalid
 */
export function updateProjectDimensions(project: Project, width: number, height: number): Project;
```

#### Layer Operations

```typescript
/**
 * Adds a new layer to a project with validation.
 * @param {Project} project - The project to add the layer to
 * @param {Omit<Layer, 'id' | 'traits'>} layer - The layer data without ID and traits
 * @returns {Project} The updated project with the new layer
 * @throws {Error} If layer name is invalid
 */
export function addLayerToProject(project: Project, layer: Omit<Layer, 'id' | 'traits'>): Project;

/**
 * Removes a layer from a project by ID.
 * @param {Project} project - The project containing the layer
 * @param {string} layerId - The ID of the layer to remove
 * @returns {Project} The updated project without the specified layer
 */
export function removeLayerFromProject(project: Project, layerId: string): Project;

/**
 * Updates a layer within a project with partial updates.
 * @param {Project} project - The project containing the layer
 * @param {string} layerId - The ID of the layer to update
 * @param {Partial<Layer>} updates - Partial layer data to apply
 * @returns {Project} The updated project with modified layer
 */
export function updateLayerInProject(
	project: Project,
	layerId: string,
	updates: Partial<Layer>
): Project;

/**
 * Reorders layers in a project based on the provided layer array.
 * @param {Project} project - The project with layers to reorder
 * @param {Layer[]} reorderedLayers - The layers in their new order
 * @returns {Project} The project with layers sorted by order property
 */
export function reorderLayersInProject(project: Project, reorderedLayers: Layer[]): Project;
```

#### Trait Operations

```typescript
/**
 * Adds a trait to a layer with image processing and validation.
 * @param {Layer} layer - The layer to add the trait to
 * @param {Omit<Trait, 'id' | 'imageData'> & { imageData: File }} trait - The trait data including image file
 * @returns {Promise<Trait>} The created trait with processed image data
 * @throws {Error} If trait name is invalid or image processing fails
 */
export async function addTraitToLayer(
	layer: Layer,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
): Promise<Trait>;

/**
 * Removes a trait from a layer by ID.
 * @param {Layer} layer - The layer containing the trait
 * @param {string} traitId - The ID of the trait to remove
 * @returns {Layer} The updated layer without the specified trait
 */
export function removeTraitFromLayer(layer: Layer, traitId: string): Layer;

/**
 * Updates a trait within a layer with partial updates.
 * @param {Layer} layer - The layer containing the trait
 * @param {string} traitId - The ID of the trait to update
 * @param {Partial<Trait>} updates - Partial trait data to apply
 * @returns {Layer} The updated layer with modified trait
 */
export function updateTraitInLayer(layer: Layer, traitId: string, updates: Partial<Trait>): Layer;
```

#### Utility Functions

```typescript
/**
 * Checks if any layers contain traits with missing image data.
 * @param {Layer[]} layers - The layers to check
 * @returns {boolean} True if any trait has missing image data, false otherwise
 */
export function hasMissingImageData(layers: Layer[]): boolean;

/**
 * Gets a list of traits with missing image data across all layers.
 * @param {Layer[]} layers - The layers to check
 * @returns {Array<{ layerName: string; traitName: string }>} Array of missing image information
 */
export function getLayersWithMissingImages(
	layers: Layer[]
): Array<{ layerName: string; traitName: string }>;
```

## Worker API

### Generation Worker (`src/lib/workers/generation.worker.ts`)

The generation worker handles intensive image processing and NFT generation operations in background threads.

#### Core Functions

```typescript
/**
 * Generates the complete NFT collection with optimized chunked processing.
 * Uses adaptive chunk sizing, Canvas API optimization for all collections,
 * and memory-efficient processing with real-time monitoring.
 * @param {TransferrableLayer[]} layers - The layers with traits to generate from
 * @param {number} collectionSize - Total number of NFTs to generate (1-10,000)
 * @param {Object} outputSize - Output dimensions for generated images
 * @param {string} projectName - Name of the project for metadata
 * @param {string} projectDescription - Description for metadata
 * @param {string} [taskId] - Optional task ID for tracking
 * @returns {Promise<void>} Resolves when generation completes
 * @throws {Error} If validation fails or generation encounters critical errors
 */
async function generateCollection(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	taskId?: string
): Promise<void>;

/**
 * Calculates optimal chunk size for processing based on device capabilities.
 * Uses memory-based and core-based calculations with adaptive bounds.
 * Automatically adjusts based on real-time memory usage during Canvas generation.
 * @param {Object} deviceCapabilities - Device capabilities
 * @param {number} collectionSize - Total number of NFTs to generate
 * @returns {number} Optimal chunk size for processing (10-200 items)
 */
function calculateOptimalChunkSize(
	deviceCapabilities: ReturnType<typeof getDeviceCapabilities>,
	collectionSize: number
): number;

/**
 * Detects device capabilities to optimize performance and resource usage.
 * Uses browser APIs to determine available CPU cores, memory, and device type.
 * @returns {Object} Device capabilities object
 */
function getDeviceCapabilities(): {
	coreCount: number;
	memoryGB: number;
	isMobile: boolean;
};
```

#### Message Types

The worker communicates with the main thread using structured messages:

```typescript
// Progress updates
interface ProgressMessage {
	type: 'progress';
	taskId?: string;
	payload: {
		generatedCount: number;
		totalCount: number;
		statusText: string;
		memoryUsage?: MemoryUsage;
	};
}

// Completion messages
interface CompleteMessage {
	type: 'complete';
	taskId?: string;
	payload: {
		images: Array<{ name: string; imageData: ArrayBuffer }>;
		metadata: Array<{ name: string; data: object }>;
	};
}

// Error messages
interface ErrorMessage {
	type: 'error';
	taskId?: string;
	payload: {
		message: string;
	};
}
```

## Utility Functions

### Error Handling (`src/lib/utils/error-handler.ts`)

```typescript
/**
 * Handles validation errors with user-friendly messages.
 * @param {Error} error - The validation error
 * @param {Object} options - Error handling options
 * @param {Object} options.context - Context information for logging
 * @returns {T} The fallback value or throws the error
 */
export function handleValidationError<T>(error: Error, options: { context: object }): T;

/**
 * Handles file-related errors with user-friendly messages.
 * @param {unknown} error - The file error
 * @param {Object} options - Error handling options
 * @param {Object} options.context - Context information for logging
 * @param {string} options.title - Error title for user display
 * @param {string} options.description - Error description for user display
 */
export function handleFileError(
	error: unknown,
	options: { context: object; title: string; description: string }
): void;
```

### Validation (`src/lib/utils/validation.ts`)

```typescript
/**
 * Validates project name with length and character restrictions.
 * @param {string} name - The project name to validate
 * @returns {string | null} Sanitized name if valid, null otherwise
 */
export function isValidProjectName(name: string): string | null;

/**
 * Validates layer name with length and character restrictions.
 * @param {string} name - The layer name to validate
 * @returns {string | null} Sanitized name if valid, null otherwise
 */
export function isValidLayerName(name: string): string | null;

/**
 * Validates trait name with length and character restrictions.
 * @param {string} name - The trait name to validate
 * @returns {string | null} Sanitized name if valid, null otherwise
 */
export function isValidTraitName(name: string): string | null;

/**
 * Validates image file for security and format compliance.
 * @param {File} file - The image file to validate
 * @returns {Promise<boolean>} True if the file is valid and secure
 */
export async function validateImageSecurity(file: File): Promise<boolean>;
```

## Type Definitions

### Core Types

```typescript
/**
 * Project configuration and data.
 */
interface Project {
	id: string;
	name: string;
	description: string;
	outputSize: { width: number; height: number };
	layers: Layer[];
	_needsProperLoad?: boolean;
}

/**
 * Layer containing traits and rendering order.
 */
interface Layer {
	id: string;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: Trait[];
}

/**
 * Individual trait with image data and rarity configuration.
 */
interface Trait {
	id: string;
	name: string;
	imageData: ArrayBuffer;
	imageUrl: string;
	width: number;
	height: number;
	rarityWeight: number;
}
```

### Worker Message Types

```typescript
/**
 * Transferrable layer data for worker communication.
 */
interface TransferrableLayer {
  id:
```
