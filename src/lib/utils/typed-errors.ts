/**
 * Typed error classes for NFT Studio application
 * Provides specific error types for different error scenarios
 */

import type { ProjectId, LayerId, TraitId, TaskId } from '$lib/types/ids';

// Base error class for all application errors
export abstract class AppError extends Error {
	public readonly code: string;
	public readonly context?: Record<string, unknown>;
	public readonly timestamp: Date;
	public readonly recoverable: boolean;

	constructor(
		message: string,
		code: string,
		context?: Record<string, unknown>,
		recoverable: boolean = false
	) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.context = context;
		this.timestamp = new Date();
		this.recoverable = recoverable;

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Convert error to plain object for serialization
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			context: this.context,
			timestamp: this.timestamp.toISOString(),
			recoverable: this.recoverable,
			stack: this.stack
		};
	}
}

// Validation errors
export class ValidationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 'VALIDATION_ERROR', context, true);
	}
}

export class ProjectValidationError extends ValidationError {
	constructor(message: string, projectId?: ProjectId) {
		super(message, { projectId });
	}
}

export class LayerValidationError extends ValidationError {
	constructor(message: string, layerId?: LayerId) {
		super(message, { layerId });
	}
}

export class TraitValidationError extends ValidationError {
	constructor(message: string, traitId?: TraitId) {
		super(message, { traitId });
	}
}

// Storage errors
export class StorageError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 'STORAGE_ERROR', context, true);
	}
}

export class LocalStorageError extends StorageError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, storageType: 'localStorage' });
	}
}

export class FileStorageError extends StorageError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, storageType: 'file' });
	}
}

// File processing errors
export class FileError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 'FILE_ERROR', context, true);
	}
}

export class FileReadError extends FileError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, operation: 'read' });
	}
}

export class FileWriteError extends FileError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, operation: 'write' });
	}
}

export class ImageProcessingError extends FileError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, operation: 'image_processing' });
	}
}

// Worker errors
export class WorkerError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 'WORKER_ERROR', context, true);
	}
}

export class WorkerInitializationError extends WorkerError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, phase: 'initialization' });
	}
}

export class WorkerExecutionError extends WorkerError {
	constructor(message: string, taskId?: TaskId, context?: Record<string, unknown>) {
		super(message, { ...context, taskId, phase: 'execution' });
	}
}

export class WorkerTimeoutError extends WorkerError {
	constructor(message: string, taskId?: TaskId, context?: Record<string, unknown>) {
		super(message, { ...context, taskId, phase: 'timeout' });
	}
}

// Generation errors
export class GenerationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 'GENERATION_ERROR', context, true);
	}
}

export class GenerationValidationError extends GenerationError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, type: 'validation' });
	}
}

export class GenerationExecutionError extends GenerationError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, { ...context, type: 'execution' });
	}
}

// Network errors
export class NetworkError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 'NETWORK_ERROR', context, true);
	}
}

export class ApiError extends NetworkError {
	constructor(message: string, statusCode?: number, context?: Record<string, unknown>) {
		super(message, { ...context, statusCode });
	}
}

// Configuration errors
export class ConfigurationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 'CONFIGURATION_ERROR', context, false);
	}
}

// Type guards for error checking
export function isValidationError(error: unknown): error is ValidationError {
	return error instanceof ValidationError;
}

export function isStorageError(error: unknown): error is StorageError {
	return error instanceof StorageError;
}

export function isFileError(error: unknown): error is FileError {
	return error instanceof FileError;
}

export function isWorkerError(error: unknown): error is WorkerError {
	return error instanceof WorkerError;
}

export function isGenerationError(error: unknown): error is GenerationError {
	return error instanceof GenerationError;
}

export function isNetworkError(error: unknown): error is NetworkError {
	return error instanceof NetworkError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
	return error instanceof ConfigurationError;
}

/**
 * Helper function to extract error information for logging
 */
export function getErrorInfo(error: unknown): {
	name: string;
	message: string;
	code?: string;
	stack?: string;
	context?: Record<string, unknown>;
	recoverable?: boolean;
} {
	if (error instanceof AppError) {
		return {
			name: error.name,
			message: error.message,
			code: error.code,
			stack: error.stack,
			context: error.context,
			recoverable: error.recoverable
		};
	}

	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack
		};
	}

	return {
		name: 'UnknownError',
		message: String(error)
	};
}

/**
 * Helper function to check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
	if (error instanceof AppError) {
		return error.recoverable;
	}

	// Default to true for unknown errors to allow fallback behavior
	return true;
}
