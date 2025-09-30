/**
 * Consolidated error handling utility for the NFT Studio application
 * This module provides a unified approach to error handling across the application
 */

import { showError, AppError } from './error-handling';
import type { ErrorOptions, ErrorContext } from './error-handling';
import { logError as logAppError, logWarning } from './error-logger';
import {
	ValidationError,
	StorageError,
	FileError,
	WorkerError,
	GenerationError,
	NetworkError,
	ConfigurationError,
	getErrorInfo,
	isRecoverableError
} from './typed-errors';

export interface ErrorHandlerOptions extends ErrorOptions {
	context?: ErrorContext;
	logError?: boolean;
	silent?: boolean;
	fallbackValue?: unknown;
	operation?: string; // Specific operation that failed
}

/**
 * Unified error handler that combines logging and user notification
 */
export async function handleError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const {
		context,
		logError = true,
		silent = false,
		fallbackValue,
		operation,
		...errorOptions
	} = options;

	// Create appropriate AppError based on error type
	let appError: AppError;

	if (error instanceof AppError) {
		appError = error;
	} else if (error instanceof Error) {
		// Map generic errors to appropriate typed errors based on context
		const errorInfo = getErrorInfo(error);
		const enhancedContext = {
			...context,
			operation,
			originalError: errorInfo
		};

		// Create appropriate typed error based on context and message
		if (error.message.includes('validation') || error.message.includes('invalid')) {
			appError = new ValidationError(error.message, enhancedContext);
		} else if (error.message.includes('storage') || error.message.includes('localStorage')) {
			appError = new StorageError(error.message, enhancedContext);
		} else if (error.message.includes('file') || error.message.includes('image')) {
			appError = new FileError(error.message, enhancedContext);
		} else if (error.message.includes('worker') || error.message.includes('generation')) {
			appError = new WorkerError(error.message, enhancedContext);
		} else if (error.message.includes('network') || error.message.includes('fetch')) {
			appError = new NetworkError(error.message, enhancedContext);
		} else {
			appError = new AppError(error.message, 'UNHANDLED_ERROR', enhancedContext, true);
		}
	} else {
		appError = new AppError(String(error), 'UNKNOWN_ERROR', context, true);
	}

	// Log error if requested
	if (logError) {
		if (appError.recoverable) {
			logWarning(appError.message, appError.context);
		} else {
			logAppError(appError, appError.context);
		}
	}

	// Show user notification if not silent
	if (!silent) {
		showError(appError, errorOptions);
	}

	// Return fallback value if provided
	if (fallbackValue !== undefined) {
		return fallbackValue as T;
	}

	// Re-throw error if no fallback
	throw appError;
}

/**
 * Wrapper for async operations with error handling
 */
export async function withErrorHandling<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	try {
		return await operation();
	} catch (error: unknown) {
		const result = await handleError<T>(error, options);
		if (result !== undefined) {
			return result as T;
		}
		throw error;
	}
}

/**
 * Wrapper for sync operations with error handling
 */
export function withErrorHandlingSync<T>(operation: () => T, options: ErrorHandlerOptions = {}): T {
	try {
		return operation();
	} catch (error: unknown) {
		const result = handleError<T>(error, options);
		if (result !== undefined) {
			return result as T;
		}
		throw error;
	}
}

/**
 * Handle storage-related errors specifically
 */
export async function handleStorageError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const storageError =
		error instanceof StorageError
			? error
			: new StorageError(error instanceof Error ? error.message : String(error), {
					...options.context,
					operation: options.operation
				});

	return handleError<T>(storageError, {
		title: 'Storage Error',
		description: 'Failed to access storage. Please check your browser settings.',
		...options
	});
}

/**
 * Handle file-related errors specifically
 */
export async function handleFileError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const fileError =
		error instanceof FileError
			? error
			: new FileError(error instanceof Error ? error.message : String(error), {
					...options.context,
					operation: options.operation
				});

	return handleError<T>(fileError, {
		title: 'File Error',
		description: 'Failed to process file. Please check the file and try again.',
		...options
	});
}

/**
 * Handle validation errors specifically
 */
export async function handleValidationError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const validationError =
		error instanceof ValidationError
			? error
			: new ValidationError(error instanceof Error ? error.message : String(error), {
					...options.context,
					operation: options.operation
				});

	return handleError<T>(validationError, {
		title: 'Validation Error',
		description: 'Invalid input provided. Please check your data.',
		...options
	});
}

/**
 * Handle worker-related errors specifically
 */
export async function handleWorkerError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const workerError =
		error instanceof WorkerError
			? error
			: new WorkerError(error instanceof Error ? error.message : String(error), {
					...options.context,
					operation: options.operation
				});

	return handleError<T>(workerError, {
		title: 'Generation Error',
		description: 'Failed to generate NFTs. Please try again.',
		...options
	});
}

/**
 * Handle generation-related errors specifically
 */
export async function handleGenerationError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const generationError =
		error instanceof GenerationError
			? error
			: new GenerationError(error instanceof Error ? error.message : String(error), {
					...options.context,
					operation: options.operation
				});

	return handleError<T>(generationError, {
		title: 'Generation Error',
		description: 'Failed to generate NFTs. Please check your project configuration.',
		...options
	});
}

/**
 * Handle network-related errors specifically
 */
export async function handleNetworkError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const networkError =
		error instanceof NetworkError
			? error
			: new NetworkError(error instanceof Error ? error.message : String(error), {
					...options.context,
					operation: options.operation
				});

	return handleError<T>(networkError, {
		title: 'Network Error',
		description: 'Failed to connect to the network. Please check your internet connection.',
		...options
	});
}

/**
 * Check if an error is recoverable
 */
export function isErrorRecoverable(error: unknown): boolean {
	return isRecoverableError(error);
}

/**
 * Get detailed error information for debugging
 */
export function getDetailedErrorInfo(error: unknown): ReturnType<typeof getErrorInfo> {
	return getErrorInfo(error);
}

/**
 * Create a typed error from a generic error
 */
export function createTypedError(error: unknown, context?: Record<string, unknown>): AppError {
	if (error instanceof AppError) {
		return error;
	}

	const errorInfo = getErrorInfo(error);
	return new AppError(errorInfo.message, 'CONVERTED_ERROR', context, true);
}
