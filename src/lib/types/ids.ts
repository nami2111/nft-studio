/**
 * Branded types for IDs to prevent mixing different types of IDs.
 *
 * Factories validate UUID v4 format by default — invalid input throws.
 * Use `unsafeCreate*Id(s)` only in tests where readable short IDs matter
 * and validation would be noise. Production code paths must use the
 * validated factories so bad input crashes at the boundary, not deep
 * inside a mutation.
 */

// Base branded type
export interface Brand<T, B> {
	readonly __brand: B;
	readonly value: T;
}

export type Branded<T, B> = T & Brand<T, B>;

export type ProjectId = Branded<string, 'ProjectId'>;
export type LayerId = Branded<string, 'LayerId'>;
export type TraitId = Branded<string, 'TraitId'>;
export type TaskId = Branded<string, 'TaskId'>;
export type GenerationId = Branded<string, 'GenerationId'>;
export type ExportId = Branded<string, 'ExportId'>;
export type FileId = Branded<string, 'FileId'>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a UUID. Returns true for canonical UUID format.
 */
export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_RE.test(value);
}

function assertUuid(id: string, kind: string): void {
	if (!UUID_RE.test(id)) {
		throw new Error(`Invalid ${kind}: expected UUID, got "${id}"`);
	}
}

// Validated factories — production use

export function createProjectId(id: string): ProjectId {
	assertUuid(id, 'ProjectId');
	return id as ProjectId;
}

export function createLayerId(id: string): LayerId {
	assertUuid(id, 'LayerId');
	return id as LayerId;
}

export function createTraitId(id: string): TraitId {
	assertUuid(id, 'TraitId');
	return id as TraitId;
}

export function createTaskId(id: string): TaskId {
	assertUuid(id, 'TaskId');
	return id as TaskId;
}

export function createGenerationId(id: string): GenerationId {
	assertUuid(id, 'GenerationId');
	return id as GenerationId;
}

export function createExportId(id: string): ExportId {
	assertUuid(id, 'ExportId');
	return id as ExportId;
}

export function createFileId(id: string): FileId {
	assertUuid(id, 'FileId');
	return id as FileId;
}

// Safe variants — return null on invalid, for boundary parsing

export function safeCreateProjectId(id: string): ProjectId | null {
	return UUID_RE.test(id) ? (id as ProjectId) : null;
}

export function safeCreateLayerId(id: string): LayerId | null {
	return UUID_RE.test(id) ? (id as LayerId) : null;
}

export function safeCreateTraitId(id: string): TraitId | null {
	return UUID_RE.test(id) ? (id as TraitId) : null;
}

// Unsafe variants — tests only. Skip validation for short readable IDs.

export function unsafeCreateProjectId(id: string): ProjectId {
	return id as ProjectId;
}

export function unsafeCreateLayerId(id: string): LayerId {
	return id as LayerId;
}

export function unsafeCreateTraitId(id: string): TraitId {
	return id as TraitId;
}

export function unsafeCreateTaskId(id: string): TaskId {
	return id as TaskId;
}

// Extract underlying string

export function getIdValue<T extends Branded<string, string>>(id: T): string {
	return id as string;
}

// Type guards — check format, not just non-empty

export function isProjectId(value: unknown): value is ProjectId {
	return isUuid(value);
}

export function isLayerId(value: unknown): value is LayerId {
	return isUuid(value);
}

export function isTraitId(value: unknown): value is TraitId {
	return isUuid(value);
}

export function isTaskId(value: unknown): value is TaskId {
	return isUuid(value);
}

// Generators

export function generateId<T extends Branded<string, string>>(): T {
	return crypto.randomUUID() as T;
}

export function generateProjectId(): ProjectId {
	return generateId<ProjectId>();
}

export function generateLayerId(): LayerId {
	return generateId<LayerId>();
}

export function generateTraitId(): TraitId {
	return generateId<TraitId>();
}

export function generateTaskId(): TaskId {
	return generateId<TaskId>();
}

export function generateGenerationId(): GenerationId {
	return generateId<GenerationId>();
}

export function generateExportId(): ExportId {
	return generateId<ExportId>();
}

export function generateFileId(): FileId {
	return generateId<FileId>();
}
