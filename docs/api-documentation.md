# API Documentation

This document provides comprehensive API documentation for GNStudio's core modules, including stores, domain services, and utilities.

## Table of Contents

- [Stores API](#stores-api)
- [Domain Services API](#domain-services-api)
- [Worker API](#worker-api)
- [Error Handling](#error-handling)
- [Performance & Retry Utilities](#performance--retry-utilities)
- [Validation](#validation)
- [Type Definitions](#type-definitions)

## Stores API

### Project Store (`src/lib/stores/project.store.svelte.ts`)

The project store manages the reactive state of the current project using Svelte 5 runes.

#### Core State

```typescript
/** Reactive project state using Svelte 5 $state rune. */
export const project = $state<Project>(validationService.createDefaultProject());

/** Store facade exposing state and action methods. */
export const projectStore = { ... };
```

#### Project Management

```typescript
export function updateProject(updates: Partial<Project>): void;
export function updateProjectName(name: string): void;
export function updateProjectDescription(description: string): void;
export function updateProjectMetadataStandard(standard: MetadataStandard): void;
export function isProjectValid(): boolean;
export function totalTraitCount(): number;
export function projectNeedsZipLoad(): boolean;
```

#### Layer Management

```typescript
export function updateLayer(layerId: LayerId, updates: Partial<Layer>): void;
export function updateLayersBatch(batch: Array<{ id: LayerId; updates: Partial<Layer> }>): void;
```

#### Trait Management

```typescript
export function updateTrait(layerId: LayerId, traitId: TraitId, updates: Partial<Trait>): void;
export function updateTraitsBatch(
	batch: Array<{ layerId: LayerId; traitId: TraitId; updates: Partial<Trait> }>
): void;
export function addTraitsBatch(layerId: LayerId, traits: Trait[]): void;
export function flushBatch(): void;
```

## Domain Services API

### Project Service (`src/lib/domain/project.service.ts`)

Pure business logic functions for project, layer, and trait operations. All functions return new instances (immutable).

#### Factory & Queries

```typescript
/** Creates a default project with generated ID and default 1000×1000 dimensions. */
export function createProject(): Project;

/** Calculates total possible unique combinations across all layers. */
export function calculateTotalCombinations(project: Project): number;

/** Validates project structure (all layers have traits, no duplicate names). */
export function validateProjectStructure(project: Project): boolean;
```

#### Project Operations

```typescript
export function updateProjectName(project: Project, name: string): Project;
export function updateProjectDescription(project: Project, description: string): Project;
export function updateProjectDimensions(project: Project, width: number, height: number): Project;
```

#### Layer Operations

```typescript
export function addLayer(project: Project, name?: string): Project;
export function removeLayer(project: Project, layerId: string): Project;
export function updateLayerName(project: Project, layerId: string, name: string): Project;
export function reorderLayers(project: Project, layerIds: string[]): Project;
```

#### Trait Operations

```typescript
export async function addTrait(project: Project, layerId: string, file: File): Promise<Project>;
export function removeTrait(project: Project, layerId: string, traitId: string): Project;
export function updateTraitName(
	project: Project,
	layerId: string,
	traitId: string,
	name: string
): Project;
export function updateTraitRarity(
	project: Project,
	layerId: string,
	traitId: string,
	rarityWeight: number
): Project;
```

### Rarity Calculator (`src/lib/domain/rarity-calculator.ts`)

Advanced rarity calculation with multiple scoring methods and tier systems.

#### Core Types

```typescript
export enum RarityMethod {
	TRAIT_RARITY = 'trait_rarity',
	AVERAGE_TRAIT_RARITY = 'average_trait_rarity',
	WEIGHTED_TRAIT_RARITY = 'weighted_trait_rarity',
	STANDARD_DEVIATION = 'standard_deviation',
	ENHANCED_WEIGHTED = 'enhanced_weighted',
	EMERGENT_RARITY = 'emergent_rarity'
}

export interface TraitRarity {
	layer: string;
	trait: string;
	count: number;
	percentage: number;
	rarityScore: number;
}

export interface ItemRarityResult {
	item: GalleryItem;
	rarityScore: number;
	rarityRank?: number;
	traitRarities: TraitRarity[] | EnhancedTraitRarity[];
}
```

#### Core Functions

```typescript
/** Calculate trait rarities across a collection. Returns Map<layer:trait, TraitRarity>. */
export function calculateTraitRarities(collection: GalleryCollection): Map<string, TraitRarity>;

/** Calculate enhanced trait rarities with custom weights and tiers. */
export function calculateEnhancedTraitRarities(
	collection: GalleryCollection,
	layerImportance?: LayerImportance[],
	customWeights?: Map<string, number>,
	tiers?: RarityTier[]
): Map<string, EnhancedTraitRarity>;

/** Calculate rarity scores for all items in a collection using the specified method. */
export function calculateItemRarities(
	collection: GalleryCollection,
	method?: RarityMethod
): { traitRarities; itemRarities; rarestItem?; mostCommonItem? };

/** Update a collection with rarity scores and ranks, returning a new collection. */
export function updateCollectionWithRarity(
	collection: GalleryCollection,
	method?: RarityMethod
): GalleryCollection;

/** Find items that contain all specified required traits. */
export function findItemsWithTraits(
	collection: GalleryCollection,
	requiredTraits: Array<{ layer: string; trait: string }>
): GalleryItem[];

/** Jaccard similarity between two items (0 = no overlap, 1 = identical). */
export function calculateItemSimilarity(item1: GalleryItem, item2: GalleryItem): number;

/** Get top 20 rarest traits sorted by rarity score. */
export function getTraitStatistics(collection: GalleryCollection): Array<{
	layer: string;
	trait: string;
	count: number;
	percentage: number;
	rarityScore: number;
}>;
```

## Worker API

### Generation Worker Client (`src/lib/workers/generation.worker.client.ts`)

Orchestrates the full generation pipeline: CSP solving → trait batching → worker pool dispatch.

```typescript
/**
 * Start generation of a complete collection.
 * 1. Pre-solves all unique trait combinations via CSPSolver.
 * 2. Delegates batch rendering to TraitBatchScheduler → worker pool.
 */
export async function startGeneration(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	metadataStandard?: MetadataStandard,
	strictPairConfig?: StrictPairConfig,
	extraData?: Record<string, unknown>,
	onMessage?: (
		data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	) => void
): Promise<void>;

/** Cancel generation and terminate all active workers. */
export function cancelGeneration(): void;
```

### CSP Solver (`src/lib/workers/csp-solver.ts`)

Constraint Satisfaction Problem solver ensuring unique, valid trait combinations per item.

```typescript
export class CSPSolver {
	constructor(
		layers: TransferrableLayer[],
		usedCombinations: Map<string, Set<bigint>>,
		strictPairConfig?: SolverContext['strictPairConfig']
	);

	/** Solve for one unique, constraint-satisfying trait combination. Returns null if exhausted. */
	solve(): Map<string, TransferrableTrait> | null;

	/** Mark the last solution as used to prevent duplicates in subsequent calls. */
	markCombinationAsUsed(): void;

	/** Get performance stats (constraintChecks, backtracks, ac3Iterations, etc.). */
	getPerformanceStats(): Record<string, number>;

	/** Clear internal caches between generations. */
	clearCaches(): void;
}
```

### Trait Batch Scheduler (`src/lib/workers/trait-batch-scheduler.ts`)

Dispatches pre-solved trait solutions to the worker pool for image rendering.

```typescript
export interface BatchConfig {
	layers: TransferrableLayer[];
	collectionSize: number;
	outputSize: { width: number; height: number };
	projectName: string;
	projectDescription: string;
	metadataStandard?: MetadataStandard;
	extraData?: Record<string, unknown>;
	onMessage?: (data: CompleteMessage | ...) => void;
}

export class TraitBatchScheduler {
	constructor(config: BatchConfig);

	/** Chunk solutions into batches and dispatch to the worker pool. Resolves when all batches complete. */
	async scheduleBatches(solutions: Solution[], batchSize?: number): Promise<void>;
}
```

### Worker Pool (`src/lib/workers/worker.pool.ts`)

Multi-worker pool with dynamic scaling, health checks, and work-stealing scheduling.

```typescript
export async function initializeWorkerPool(config?: WorkerPoolConfig): Promise<void>;
export async function warmUpWorkers(config?: WorkerPoolConfig): Promise<void>;
export function postMessageToPool<T>(message: GenerationWorkerMessage): Promise<T>;
export function terminateWorkerPool(): void;
export function getWorkerPoolStatus(): WorkerPoolStatus | null;
export function cleanupOldTasks(thresholdMs?: number): void;
export function setMessageCallback(callback: (data: WorkerMessage) => void): void;
export function getOptimalWorkerCount(collectionSize: number): number;
```

## Error Handling

### Typed Error Hierarchy (`src/lib/utils/typed-errors.ts`)

Single-source-of-truth error hierarchy with type guards and serialization support.

```typescript
/** Base error with code, context, timestamp, and recoverable flag. */
export class AppError extends Error {
	readonly code: string;
	readonly context?: Record<string, unknown>;
	readonly timestamp: Date;
	readonly recoverable: boolean;
	toJSON(): Record<string, unknown>;
}

// Validation branch
export class ValidationError extends AppError {
	/* code: 'VALIDATION_ERROR', recoverable: true */
}
export class ProjectValidationError extends ValidationError {
	/* + projectId */
}
export class LayerValidationError extends ValidationError {
	/* + layerId */
}
export class TraitValidationError extends ValidationError {
	/* + traitId */
}

// Storage branch
export class StorageError extends AppError {
	/* code: 'STORAGE_ERROR' */
}
export class LocalStorageError extends StorageError {
	/* tags storageType: 'localStorage' */
}
export class FileStorageError extends StorageError {
	/* tags storageType: 'file' */
}

// File/IO branch
export class FileError extends AppError {
	/* code: 'FILE_ERROR' */
}
export class FileReadError extends FileError {
	/* tags operation: 'read' */
}
export class FileWriteError extends FileError {
	/* tags operation: 'write' */
}
export class ImageProcessingError extends FileError {
	/* tags operation: 'image_processing' */
}

// Worker branch
export class WorkerError extends AppError {
	/* code: 'WORKER_ERROR' */
}
export class WorkerInitializationError extends WorkerError {
	/* tags phase: 'initialization' */
}
export class WorkerExecutionError extends WorkerError {
	/* + taskId, phase: 'execution' */
}
export class WorkerTimeoutError extends WorkerError {
	/* + taskId, phase: 'timeout' */
}

// Generation branch
export class GenerationError extends AppError {
	/* code: 'GENERATION_ERROR' */
}
export class GenerationValidationError extends GenerationError {
	/* tags type: 'validation' */
}
export class GenerationExecutionError extends GenerationError {
	/* tags type: 'execution' */
}

// Network branch
export class NetworkError extends AppError {
	/* code: 'NETWORK_ERROR' */
}
export class ApiError extends NetworkError {
	/* + statusCode */
}

// Configuration branch
export class ConfigurationError extends AppError {
	/* code: 'CONFIGURATION_ERROR', recoverable: false */
}
```

#### Type Guards & Helpers

```typescript
export function isValidationError(error: unknown): error is ValidationError;
export function isStorageError(error: unknown): error is StorageError;
export function isFileError(error: unknown): error is FileError;
export function isWorkerError(error: unknown): error is WorkerError;
export function isGenerationError(error: unknown): error is GenerationError;
export function isNetworkError(error: unknown): error is NetworkError;
export function isConfigurationError(error: unknown): error is ConfigurationError;

/** Extract structured info from any error (AppError, plain Error, or unknown). */
export function getErrorInfo(error: unknown): {
	name: string;
	message: string;
	code?: string;
	stack?: string;
	context?: Record<string, unknown>;
	recoverable?: boolean;
};

/** Check if an error is recoverable (AppError.recoverable, or true as safe default). */
export function isRecoverableError(error: unknown): boolean;
```

### Error Handler (`src/lib/utils/error-handler.ts`)

Centralized error processing with typed handlers for each error category.

```typescript
export async function handleError<T>(
	operation: () => Promise<T>,
	options?: ErrorHandlerOptions
): Promise<T>;

/** Wrap an async function in safe error handling (renamed from withErrorHandling). */
export async function withSafeOperation<T>(
	operation: () => Promise<T>,
	context?: Record<string, unknown>,
	fallbackMessage?: string
): Promise<T>;

/** Synchronous variant of withSafeOperation. */
export function withSafeOperationSync<T>(operation: () => T, ...): T;

// Category-specific handlers (automatically use the correct typed error)
export async function handleStorageError<T>(operation: () => Promise<T>, ...): Promise<T>;
export async function handleFileError<T>(operation: () => Promise<T>, ...): Promise<T>;
export async function handleValidationError<T>(operation: () => Promise<T>, ...): Promise<T>;
export async function handleWorkerError<T>(operation: () => Promise<T>, ...): Promise<T>;
export async function handleGenerationError<T>(operation: () => Promise<T>, ...): Promise<T>;
export async function handleNetworkError<T>(operation: () => Promise<T>, ...): Promise<T>;

// Recovery wrappers (auto-retry + error handling)
export async function recoverableOperation<T>(operation: () => Promise<T>, ...): Promise<T>;
export async function recoverableStorageOperation<T>(...): Promise<T>;
export async function recoverableFileOperation<T>(...): Promise<T>;
export async function recoverableWorkerOperation<T>(...): Promise<T>;
export async function recoverableGenerationOperation<T>(...): Promise<T>;
export async function recoverableNetworkOperation<T>(...): Promise<T>;

/** Check if an error is recoverable and has a suggested retry action. */
export function isErrorRecoverable(error: unknown): boolean;

/** Get detailed error info for logging/debugging. */
export function getDetailedErrorInfo(error: unknown, context?: ErrorContext): DetailedErrorInfo;

/** Create a typed error from a code string (e.g. 'VALIDATION_ERROR' → ValidationError). */
export function createTypedError(message: string, code?: string, context?: Record<string, unknown>): AppError;
```

### Error Handling (Toast) (`src/lib/utils/error-handling.ts`)

Toast-based user-facing error display with retry support.

```typescript
/** Show an error toast with optional retry action. */
export function showError(error: unknown, options?: ErrorOptions): void;
export function showSuccess(message: string, options?: ErrorOptions): void;
export function showInfo(message: string, options?: ErrorOptions): void;
export function showWarning(message: string, options?: ErrorOptions): void;

/** Wrap an async function with toast-based error handling (renamed from withErrorHandling). */
export async function withToastErrorHandling<T>(
	operation: () => Promise<T>,
	context?: ErrorContext,
	fallbackMessage?: string
): Promise<T>;

/** Create a wrapped function with automatic toast error handling. */
export function wrapWithToastErrorHandling<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	context?: ErrorContext,
	fallbackMessage?: string
): T;

/** Create a retry wrapper with toast notifications on failure. */
export function createRetry<T>(
	operation: () => Promise<T>,
	config?: Partial<RetryConfig>
): () => Promise<T>;
```

## Performance & Retry Utilities

### Performance Monitor (`src/lib/utils/performance-monitor.ts`)

Unified performance monitoring with timers, cache metrics, database queries, alerts, and batch tracking.

```typescript
export class PerformanceMonitor {
	// Lifecycle
	setEnabled(enabled: boolean): void;
	isEnabled(): boolean;
	clear(): void;
	clearOperation(operation: string): void;
	resetAllMetrics(): void;

	// Timers
	startTimer(operation: string, id?: string): string;
	stopTimer(timerId: string, metadata?: Record<string, unknown>): number;

	// Metrics
	recordMetric(operation: string, duration: number, metadata?: Record<string, unknown>): void;
	getStats(operation: string): PerformanceStats | null;
	getAllStats(): Record<string, PerformanceStats>;
	getAverageTime(operation: string): number;
	getLastDuration(operation: string): number;
	getMetricsInRange(startTime: number, endTime: number): Record<string, PerformanceStats>;
	generateReport(): PerformanceReport; // includes summary: totalOperations, slowestOperation, etc.
	logSummary(): void;

	// Cache Monitoring
	recordCacheHit(cacheName: string): void;
	recordCacheMiss(cacheName: string): void;
	recordCacheEviction(cacheName: string, memoryFreed: number): void;
	updateCacheMemoryUsage(cacheName: string, memoryUsage: number): void;
	getCacheHitRate(cacheName: string): number;

	// Database Monitoring
	recordDatabaseQuery(operation: string, duration: number): void;
	getDatabaseMetrics(): { queryCount: number; averageQueryTime: number };

	// Memory Monitoring
	captureMemoryMetrics(): void;
	getAverageMemoryUsage(minutes?: number): number;

	// Alerts
	createAlert(data: { metric: string; value: number; threshold: number; severity: string; message: string }): void;
	getAlerts(minutes?: number): Array<...>;

	// Batch Progress Tracking
	startBatch(totalCount: number): void;
	recordBatchItem(timePerItem: number): void;
	finishBatch(): void;
}

/** Global singleton instance, used by production code. */
export const performanceMonitor = new PerformanceMonitor();

/** ES decorator for automatically timing method execution. */
export function timed(operationName?: string, metadata?: Record<string, unknown>): MethodDecorator;

/** Wrap a function with automatic startTimer/stopTimer tracking. */
export function withTiming<T>(fn: T, operationName: string, metadata?: Record<string, unknown>): T;

/** Measure a single async/sync operation with timing. */
export async function measureOperation<T>(operation: () => Promise<T> | T, operationName: string, metadata?: Record<string, unknown>): Promise<T>;
```

### Retry Utilities (`src/lib/utils/retry.ts`)

Configurable retry with exponential backoff, jitter, conditions, and presets.

```typescript
export class RetryOperation<T> {
	constructor(operation: () => Promise<T>, config?: Partial<RetryConfig>, context?: ErrorContext);
	async execute(): Promise<RetryResult<T>>;
}

/** Convenience function: create + execute in one call. */
export async function retry<T>(
	operation: () => Promise<T>,
	config?: Partial<RetryConfig>,
	context?: ErrorContext
): Promise<RetryResult<T>>;

/** Wrap any async function with automatic retry. */
export function withRetry<T>(fn: T, config?: Partial<RetryConfig>, context?: ErrorContext): T;

/** Retry condition predicates. */
export const RetryConditions = {
	isNetworkError, // Error name 'NetworkError'/'TypeError', message 'network'/'ECONNREFUSED'/'ETIMEDOUT'
	isServerError, // status >= 500
	isRateLimitError, // status === 429
	isTimeoutError, // name 'TimeoutError' or message 'timeout'/'TIMEDOUT'
	isResourceUnavailable, // message 'unavailable'/'busy'/'overloaded'
	isRecoverable // OR of all above
};

/** Pre-configured retry configs. */
export const RetryConfigs = {
	network: {
		maxAttempts: 3,
		initialDelayMs: 1000,
		backoffFactor: 2,
		jitter: true
	},
	server: {
		maxAttempts: 5,
		initialDelayMs: 2000,
		backoffFactor: 2,
		jitter: true
	},
	rateLimit: {
		maxAttempts: 10,
		initialDelayMs: 1000,
		backoffFactor: 1.5,
		jitter: true
	},
	file: {
		maxAttempts: 3,
		initialDelayMs: 500,
		backoffFactor: 2,
		jitter: false
	},
	default: {
		maxAttempts: 3,
		initialDelayMs: 1000,
		backoffFactor: 2,
		jitter: true
	}
};
```

## Validation

### Validation Module (`src/lib/domain/validation.ts`)

Zod-based validation with branded types, XSS protection, and comprehensive schemas.

```typescript
export interface ValidationResult {
	success: boolean;
	error?: string;
	data?: unknown;
}
```

#### String Sanitization

```typescript
/** Trim, strip null bytes & control characters, optionally strip HTML tags. Capped at 100 chars. */
export function sanitizeString(input: string, stripHtml?: boolean): string;
```

#### Name & Dimension Validators

```typescript
export function validateProjectName(name: string): ValidationResult;
export function validateLayerName(name: string): ValidationResult;
export function validateTraitName(name: string): ValidationResult;
export function validateDimensions(width: number, height: number): ValidationResult;
export function validateRarityWeight(weight: number): ValidationResult;
```

#### File Validators

```typescript
export function validateFilename(filename: string): ValidationResult;
export function validateFileSize(sizeInBytes: number): ValidationResult;
export function validateFileType(type: string): ValidationResult;
```

#### Structural Validators

```typescript
export function validateProject(project: unknown): ValidationResult;
export function validateLayer(layer: unknown): ValidationResult;
export function validateTrait(trait: unknown): ValidationResult;
export function validateImportedProject(project: unknown): ValidationResult;
export function validateRulerRule(rule: unknown): ValidationResult;
```

#### Trait Compatibility

```typescript
/** Check if two traits are compatible based on ruler rules. */
export function validateTraitCompatibility(
	traitA: Trait,
	layerIdA: string,
	traitB: Trait,
	layerIdB: string,
	layers: Layer[]
): { compatible: boolean; reason?: string };

/** Get all traits from targetLayer that are compatible with the given trait. */
export function getCompatibleTraits(
	trait: Trait,
	layerId: string,
	targetLayerId: string,
	layers: Layer[]
): Trait[];
```

#### Zod Schemas (for use with `safeValidate`)

```typescript
export const ProjectSchema, LayerSchema, TraitSchema;
export const ImportedProjectSchema, ImportedLayerSchema, ImportedTraitSchema;
export const NameSchema, DescriptionSchema, RarityWeightSchema;
export const ProjectDimensionsSchema, RulerRuleSchema, TraitTypeSchema;
export const FileSizeSchema, FileTypeSchema, FilenameSchema;
```

#### Factory & Safe Validation

```typescript
export function createValidatedProject(overrides?: Partial<Project>): Project;
export function createValidatedLayer(overrides?: Partial<Layer>): Layer;
export function createValidatedTrait(overrides?: Partial<Trait>): Trait;

/** Validate with zod schema, returning ValidationResult with typed data. */
export function safeValidate<T>(
	schema: z.ZodSchema<T>,
	data: unknown
): ValidationResult & { data?: T };
```

## Type Definitions

### Core Types (`src/lib/types/`)

| File                 | Contents                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `project.ts`         | Project, Layer, Trait interfaces                                                                |
| `layer.ts`           | Layer-specific types, TraitType enum, RulerRule                                                 |
| `ids.ts`             | Branded ID types (ProjectId, LayerId, TraitId, TaskId)                                          |
| `worker-messages.ts` | Worker message types (ProgressMessage, CompleteMessage, ErrorMessage, TransferrableLayer/Trait) |
| `gallery.ts`         | GalleryItem, GalleryCollection, GalleryFilterOptions                                            |

### Key Interfaces

```typescript
interface Project {
	id: ProjectId;
	name: string;
	description: string;
	outputSize: { width: number; height: number };
	layers: Layer[];
}

interface Layer {
	id: LayerId;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: Trait[];
}

interface Trait {
	id: TraitId;
	name: string;
	imageData: ArrayBuffer;
	rarityWeight: number;
	type?: TraitType;
	rulerRules?: RulerRule[];
}
```

### Worker Message Types

```typescript
interface ProgressMessage {
	type: 'progress';
	payload: { generatedCount: number; totalCount: number; statusText: string };
}

interface CompleteMessage {
	type: 'complete';
	payload: {
		images: Array<{ name: string; blob: Blob }>;
		metadata: Array<{ name: string; data: object }>;
		generatedCount: number;
		totalCount: number;
	};
}

interface ErrorMessage {
	type: 'error';
	payload: { message: string };
}

interface BatchMessage {
	type: 'batch';
	payload: {
		solutions: Solution[];
		layers: TransferrableLayer[];
		collectionSize: number;
		outputSize: { width: number; height: number };
		projectName: string;
		projectDescription: string;
	};
}
```
