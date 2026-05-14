/**
 * Consolidated error handling utility
 * This module provides a unified approach to error handling across the application
 */

import type { ErrorContext, ErrorOptions } from './error-handling';
import { showError } from './error-handling';
import { type RetryConfig, RetryConfigs, retryWithErrorHandling } from './retry';
import {
	AppError,
	FileError,
	GenerationError,
	GenerationExecutionError,
	GenerationValidationError,
	getErrorInfo,
	isRecoverableError,
	NetworkError,
	StorageError,
	ValidationError,
	WorkerError,
	WorkerInitializationError,
	WorkerTimeoutError
} from './typed-errors';

export interface ErrorHandlerOptions extends ErrorOptions {
	context?: ErrorContext;
	logError?: boolean;
	silent?: boolean;
	fallbackValue?: unknown;
	operation?: string; // Specific operation that failed
	enableRetry?: boolean; // Enable automatic retry for recoverable errors
	retryConfig?: Partial<RetryConfig>; // Custom retry configuration
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
			appError = new AppError(
				error.message,
				'UNHANDLED_ERROR',
				enhancedContext as Record<string, unknown> | undefined,
				true
			);
		}
	} else {
		appError = new AppError(
			String(error),
			'UNKNOWN_ERROR',
			context as Record<string, unknown> | undefined,
			true
		);
	}

	// Log error if requested
	if (logError) {
		if (appError.recoverable) {
			console.warn(`[WARNING] ${appError.message}`, appError.context);
		} else {
			console.error(`[ERROR] ${appError.message}`, appError.context);
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
export async function withSafeOperation<T>(
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
export function withSafeOperationSync<T>(operation: () => T, options: ErrorHandlerOptions = {}): T {
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
		description: 'Failed to generate items. Please try again.',
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
		description: 'Failed to generate items. Please check your project configuration.',
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

/**
 * Enhanced error recovery with exponential backoff retry logic
 */
export async function recoverableOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	const { enableRetry = true, retryConfig = RetryConfigs.default, ...handlerOptions } = options;

	if (!enableRetry) {
		return withSafeOperation(operation, handlerOptions);
	}

	// Define retry condition based on error recoverability
	const customRetryConfig: Partial<RetryConfig> = {
		...retryConfig,
		retryCondition: (error: unknown) => {
			// Use provided retry condition if available
			if (retryConfig.retryCondition) {
				return retryConfig.retryCondition(error);
			}
			// Default to checking if error is recoverable
			return isRecoverableError(error);
		}
	};

	try {
		return await retryWithErrorHandling(
			operation,
			customRetryConfig,
			{
				operation: handlerOptions.operation,
				additionalData: {
					enableRetry: true,
					...((handlerOptions.context as unknown as Record<string, unknown>)
						?.additionalData as Record<string, unknown>)
				}
			} as unknown as ErrorContext, // Type assertion needed due to ErrorContext type mismatch
			`Operation "${handlerOptions.operation || 'unknown'}" failed after multiple attempts`
		);
	} catch (error) {
		// Final error handling with user notification
		await handleError(error, {
			...handlerOptions,
			title: handlerOptions.title || 'Operation Failed',
			description:
				handlerOptions.description ||
				`The operation failed after multiple attempts. Please try again.`,
			action: {
				label: 'Retry',
				onClick: () => recoverableOperation(operation, options)
			}
		});
		throw error;
	}
}

// Retry condition helpers

function isStorageRetryable(error: unknown): boolean {
	if (error instanceof StorageError) return true;
	if (error instanceof Error && error.name === 'QuotaExceededError') return true;
	if (
		error instanceof Error &&
		(error.message.includes('storage') ||
			error.message.includes('quota') ||
			error.message.includes('unavailable'))
	)
		return true;
	return false;
}

function isFileRetryable(error: unknown): boolean {
	if (error instanceof FileError) return true;
	if (error instanceof Error && error.message.includes('busy')) return true;
	if (
		error instanceof Error &&
		(error.message.includes('access denied') || error.message.includes('permission denied'))
	)
		return true;
	return false;
}

function isWorkerRetryable(error: unknown): boolean {
	if (error instanceof WorkerInitializationError) return true;
	if (error instanceof WorkerTimeoutError) return true;
	if (error instanceof WorkerError) return true;
	if (error instanceof Error && error.message.includes('Worker is not defined')) return false;
	return false;
}

function isGenerationRetryable(error: unknown): boolean {
	if (error instanceof GenerationExecutionError) return true;
	if (
		error instanceof Error &&
		(error.message.includes('memory') || error.message.includes('out of memory'))
	)
		return true;
	if (error instanceof GenerationValidationError) return false;
	return false;
}

// Retry policy presets

const STORAGE_RETRY: ErrorHandlerOptions = {
	title: 'Storage Operation Failed',
	description: 'Failed to access storage. Retrying...',
	retryConfig: {
		...RetryConfigs.default,
		maxAttempts: 5,
		initialDelayMs: 500,
		maxDelayMs: 5000,
		backoffFactor: 2,
		jitter: false,
		retryCondition: isStorageRetryable
	}
};

const FILE_RETRY: ErrorHandlerOptions = {
	title: 'File Operation Failed',
	description: 'Failed to process file. Retrying...',
	retryConfig: {
		...RetryConfigs.file,
		retryCondition: isFileRetryable
	}
};

const WORKER_RETRY: ErrorHandlerOptions = {
	title: 'Worker Operation Failed',
	description: 'Failed to execute worker operation. Retrying...',
	retryConfig: {
		...RetryConfigs.server,
		maxAttempts: 3,
		initialDelayMs: 2000,
		maxDelayMs: 10000,
		retryCondition: isWorkerRetryable
	}
};

const GENERATION_RETRY: ErrorHandlerOptions = {
	title: 'Generation Failed',
	description: 'Failed to generate items. Retrying...',
	retryConfig: {
		...RetryConfigs.server,
		maxAttempts: 2,
		initialDelayMs: 5000,
		maxDelayMs: 15000,
		retryCondition: isGenerationRetryable
	}
};

const NETWORK_RETRY: ErrorHandlerOptions = {
	title: 'Network Operation Failed',
	description: 'Failed to complete network operation. Retrying...',
	retryConfig: {
		...RetryConfigs.network,
		retryCondition: (error: unknown) => RetryConfigs.network.retryCondition?.(error) || false
	}
};

/**
 * Recoverable storage operations with specialized retry logic
 */
export async function recoverableStorageOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	return recoverableOperation(operation, {
		...STORAGE_RETRY,
		...options,
		retryConfig: { ...STORAGE_RETRY.retryConfig, ...options.retryConfig }
	});
}

/**
 * Recoverable file operations with specialized retry logic
 */
export async function recoverableFileOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	return recoverableOperation(operation, {
		...FILE_RETRY,
		...options,
		retryConfig: { ...FILE_RETRY.retryConfig, ...options.retryConfig }
	});
}

/**
 * Recoverable worker operations with specialized retry logic
 */
export async function recoverableWorkerOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	return recoverableOperation(operation, {
		...WORKER_RETRY,
		...options,
		retryConfig: { ...WORKER_RETRY.retryConfig, ...options.retryConfig }
	});
}

/**
 * Recoverable generation operations with specialized retry logic
 */
export async function recoverableGenerationOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	return recoverableOperation(operation, {
		...GENERATION_RETRY,
		...options,
		retryConfig: { ...GENERATION_RETRY.retryConfig, ...options.retryConfig }
	});
}

/**
 * Recoverable network operations with specialized retry logic
 */
export async function recoverableNetworkOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	return recoverableOperation(operation, {
		...NETWORK_RETRY,
		...options,
		retryConfig: { ...NETWORK_RETRY.retryConfig, ...options.retryConfig }
	});
}
