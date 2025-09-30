/**
 * Validation utilities for NFT Studio using Zod schemas
 * Provides comprehensive validation for project data, layers, traits, and files
 */

import { z } from 'zod';
import type { Project, Layer, Trait, ProjectDimensions } from '$lib/types/project';
import type { ProjectId, LayerId, TraitId } from '$lib/types/ids';

// Validation result interface
export interface ValidationResult {
	success: boolean;
	error?: string;
	data?: unknown;
}

// Common schemas
export const IdSchema = z.string().min(1).max(100);
export const NameSchema = z
	.string()
	.min(1)
	.max(100)
	.regex(/^[a-zA-Z0-9\s\-_]+$/);
export const DescriptionSchema = z.string().max(500).optional();
export const RarityWeightSchema = z.number().int().min(1).max(5);

// Project schemas
export const ProjectDimensionsSchema = z.object({
	width: z.number().int().min(1).max(10000),
	height: z.number().int().min(1).max(10000)
});

export const TraitSchema = z.object({
	id: IdSchema,
	name: NameSchema,
	imageData: z.instanceof(ArrayBuffer),
	imageUrl: z.string().optional(),
	rarityWeight: RarityWeightSchema.optional()
});

export const LayerSchema = z.object({
	id: IdSchema,
	name: NameSchema,
	order: z.number().int().min(0),
	isOptional: z.boolean().optional(),
	traits: z.array(TraitSchema).min(1)
});

export const ProjectSchema = z.object({
	id: IdSchema,
	name: NameSchema,
	description: DescriptionSchema,
	outputSize: ProjectDimensionsSchema,
	layers: z.array(LayerSchema).min(1)
});

// Import/export schemas (more lenient for compatibility)
export const ImportedTraitSchema = z.object({
	id: IdSchema,
	name: NameSchema,
	rarityWeight: RarityWeightSchema.optional(),
	// imageData may be missing in imports/exports
	imageData: z.instanceof(ArrayBuffer).optional(),
	imageUrl: z.string().optional()
});

export const ImportedLayerSchema = z.object({
	id: IdSchema,
	name: NameSchema,
	order: z.number().int().min(0).optional(),
	isOptional: z.boolean().optional(),
	traits: z.array(ImportedTraitSchema)
});

export const ImportedProjectSchema = z.object({
	id: IdSchema,
	name: NameSchema,
	description: DescriptionSchema.optional(),
	outputSize: ProjectDimensionsSchema.optional(),
	layers: z.array(ImportedLayerSchema)
});

// File validation schemas
export const FileSizeSchema = z
	.number()
	.int()
	.min(1)
	.max(10 * 1024 * 1024); // 10MB max
export const FileTypeSchema = z.enum(['image/png', 'image/jpeg', 'image/jpg']);
export const FilenameSchema = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[a-zA-Z0-9\s\-_.]+$/);

// Helper function for string sanitization
export function sanitizeString(input: string): string {
	return input
		.trim()
		.replace(/\0/g, '') // Remove null bytes
		.replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
		.slice(0, 100); // Limit length
}

// Validation functions that return ValidationResult objects

export function validateProjectName(name: string): ValidationResult {
	try {
		const result = NameSchema.safeParse(sanitizeString(name));
		return {
			success: result.success,
			error: result.success
				? undefined
				: 'Project name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, and underscores',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateLayerName(name: string): ValidationResult {
	try {
		const result = NameSchema.safeParse(sanitizeString(name));
		return {
			success: result.success,
			error: result.success
				? undefined
				: 'Layer name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, and underscores',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateTraitName(name: string): ValidationResult {
	try {
		const result = NameSchema.safeParse(sanitizeString(name));
		return {
			success: result.success,
			error: result.success
				? undefined
				: 'Trait name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, and underscores',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateDimensions(width: number, height: number): ValidationResult {
	try {
		const result = ProjectDimensionsSchema.safeParse({ width, height });
		return {
			success: result.success,
			error: result.success
				? undefined
				: 'Dimensions must be positive integers between 1 and 10000',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateFilename(filename: string): ValidationResult {
	try {
		const result = FilenameSchema.safeParse(filename);
		return {
			success: result.success,
			error: result.success
				? undefined
				: 'Filename must be 1-255 characters and contain only letters, numbers, spaces, hyphens, underscores, and periods',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateFileSize(
	size: number,
	maxSize: number = 10 * 1024 * 1024
): ValidationResult {
	try {
		const result = z.number().int().min(1).max(maxSize).safeParse(size);
		return {
			success: result.success,
			error: result.success
				? undefined
				: `File size must be between 1 byte and ${maxSize / (1024 * 1024)}MB`,
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateFileType(
	type: string,
	allowedTypes: string[] = ['image/png', 'image/jpeg', 'image/jpg']
): ValidationResult {
	try {
		const result = z.enum(allowedTypes as [string, ...string[]]).safeParse(type);
		return {
			success: result.success,
			error: result.success ? undefined : `File type must be one of: ${allowedTypes.join(', ')}`,
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateRarityWeight(weight: number): ValidationResult {
	try {
		const result = RarityWeightSchema.safeParse(weight);
		return {
			success: result.success,
			error: result.success ? undefined : 'Rarity weight must be an integer between 1 and 5',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateProject(project: unknown): ValidationResult {
	try {
		const result = ProjectSchema.safeParse(project);
		return {
			success: result.success,
			error: result.success ? undefined : 'Invalid project structure',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateLayer(layer: unknown): ValidationResult {
	try {
		const result = LayerSchema.safeParse(layer);
		return {
			success: result.success,
			error: result.success ? undefined : 'Invalid layer structure',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateTrait(trait: unknown): ValidationResult {
	try {
		const result = TraitSchema.safeParse(trait);
		return {
			success: result.success,
			error: result.success ? undefined : 'Invalid trait structure',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

export function validateImportedProject(project: unknown): ValidationResult {
	try {
		const result = ImportedProjectSchema.safeParse(project);
		return {
			success: result.success,
			error: result.success ? undefined : 'Invalid imported project structure',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}

// Factory functions for creating validated entities

export function createValidatedProject(overrides: Partial<Project> = {}): Project {
	const defaultProject: Project = {
		id: crypto.randomUUID() as ProjectId,
		name: 'My NFT Collection',
		description: 'A collection of unique NFTs',
		outputSize: { width: 0, height: 0 },
		layers: []
	};

	const project = { ...defaultProject, ...overrides };
	const validation = validateProject(project);

	if (!validation.success) {
		throw new Error(`Invalid project: ${validation.error}`);
	}

	return project;
}

export function createValidatedLayer(overrides: Partial<Layer> = {}): Layer {
	const defaultLayer: Layer = {
		id: crypto.randomUUID() as LayerId,
		name: 'New Layer',
		order: 0,
		traits: []
	};

	const layer = { ...defaultLayer, ...overrides };
	const validation = validateLayer(layer);

	if (!validation.success) {
		throw new Error(`Invalid layer: ${validation.error}`);
	}

	return layer;
}

export function createValidatedTrait(overrides: Partial<Trait> = {}): Trait {
	const defaultTrait: Trait = {
		id: crypto.randomUUID() as TraitId,
		name: 'New Trait',
		imageData: new ArrayBuffer(0),
		rarityWeight: 1
	};

	const trait = { ...defaultTrait, ...overrides };
	const validation = validateTrait(trait);

	if (!validation.success) {
		throw new Error(`Invalid trait: ${validation.error}`);
	}

	return trait;
}

// Safe validation wrapper that never throws

export function safeValidate<T>(
	schema: z.ZodSchema<T>,
	data: unknown
): ValidationResult & { data?: T } {
	try {
		const result = schema.safeParse(data);
		return {
			success: result.success,
			error: result.success ? undefined : 'Validation failed',
			data: result.success ? result.data : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown validation error'
		};
	}
}
