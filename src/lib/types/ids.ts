/**
 * Branded types for IDs to prevent mixing different types of IDs
 * These types provide compile-time safety by preventing accidental assignment
 * of different ID types to each other.
 */

// Base branded type
export interface Brand<T, B> {
	readonly __brand: B;
	readonly value: T;
}

// Create a branded type
export type Branded<T, B> = T & Brand<T, B>;

// Project ID type
export type ProjectId = Branded<string, 'ProjectId'>;

// Layer ID type
export type LayerId = Branded<string, 'LayerId'>;

// Trait ID type
export type TraitId = Branded<string, 'TraitId'>;

// Worker task ID type
export type TaskId = Branded<string, 'TaskId'>;

// Generation ID type
export type GenerationId = Branded<string, 'GenerationId'>;

// Export ID type
export type ExportId = Branded<string, 'ExportId'>;

// File ID type
export type FileId = Branded<string, 'FileId'>;

// Helper functions to create branded IDs

/**
 * Create a ProjectId from a string
 */
export function createProjectId(id: string): ProjectId {
	return id as ProjectId;
}

/**
 * Create a LayerId from a string
 */
export function createLayerId(id: string): LayerId {
	return id as LayerId;
}

/**
 * Create a TraitId from a string
 */
export function createTraitId(id: string): TraitId {
	return id as TraitId;
}

/**
 * Create a TaskId from a string
 */
export function createTaskId(id: string): TaskId {
	return id as TaskId;
}

/**
 * Create a GenerationId from a string
 */
export function createGenerationId(id: string): GenerationId {
	return id as GenerationId;
}

/**
 * Create an ExportId from a string
 */
export function createExportId(id: string): ExportId {
	return id as ExportId;
}

/**
 * Create a FileId from a string
 */
export function createFileId(id: string): FileId {
	return id as FileId;
}

/**
 * Extract the underlying string value from a branded ID
 */
export function getIdValue<T extends Branded<string, string>>(id: T): string {
	return id as string;
}

/**
 * Type guard to check if a value is a ProjectId
 */
export function isProjectId(value: unknown): value is ProjectId {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a LayerId
 */
export function isLayerId(value: unknown): value is LayerId {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a TraitId
 */
export function isTraitId(value: unknown): value is TraitId {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a TaskId
 */
export function isTaskId(value: unknown): value is TaskId {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Generate a new random ID of the specified type
 */
export function generateId<T extends Branded<string, string>>(): T {
	return crypto.randomUUID() as T;
}

/**
 * Generate a new random ProjectId
 */
export function generateProjectId(): ProjectId {
	return generateId<ProjectId>();
}

/**
 * Generate a new random LayerId
 */
export function generateLayerId(): LayerId {
	return generateId<LayerId>();
}

/**
 * Generate a new random TraitId
 */
export function generateTraitId(): TraitId {
	return generateId<TraitId>();
}

/**
 * Generate a new random TaskId
 */
export function generateTaskId(): TaskId {
	return generateId<TaskId>();
}

/**
 * Generate a new random GenerationId
 */
export function generateGenerationId(): GenerationId {
	return generateId<GenerationId>();
}

/**
 * Generate a new random ExportId
 */
export function generateExportId(): ExportId {
	return generateId<ExportId>();
}

/**
 * Generate a new random FileId
 */
export function generateFileId(): FileId {
	return generateId<FileId>();
}
