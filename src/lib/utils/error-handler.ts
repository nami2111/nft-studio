/**
 * Consolidated error handling utility for the NFT Studio application
 * This module provides a unified approach to error handling across the application
 */

import { showError, AppError } from './error-handling';
import type { ErrorOptions, ErrorContext } from './error-handling';
import { logError as logAppError, logWarning } from './error-logger';

export interface ErrorHandlerOptions extends ErrorOptions {
	context?: ErrorContext;
	logError?: boolean;
	silent?: boolean;
	fallbackValue?: unknown;
}

/**
 * Unified error handler that combines logging and user notification
 */
export async function handleError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	const { context, logError = true, silent = false, fallbackValue, ...errorOptions } = options;

	// Create AppError if needed
	const appError =
		error instanceof AppError
			? error
			: new AppError(
					error instanceof Error ? error.message : String(error),
					'UNHANDLED_ERROR',
					context,
					true
				);

	// Log error if requested
	if (logError) {
		if (appError.recoverable) {
			logWarning(appError.message, context);
		} else {
			logAppError(appError, context);
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
		error instanceof AppError
			? error
			: new AppError(
					error instanceof Error ? error.message : String(error),
					'STORAGE_ERROR',
					options.context,
					true
				);

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
		error instanceof AppError
			? error
			: new AppError(
					error instanceof Error ? error.message : String(error),
					'FILE_ERROR',
					options.context,
					true
				);

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
		error instanceof AppError
			? error
			: new AppError(
					error instanceof Error ? error.message : String(error),
					'VALIDATION_ERROR',
					options.context,
					false
				);

	return handleError<T>(validationError, {
		title: 'Validation Error',
		description: 'Invalid input provided. Please check your data.',
		...options
	});
}
