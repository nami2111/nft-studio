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
	WorkerInitializationError,
	WorkerTimeoutError,
	GenerationExecutionError,
	GenerationValidationError,
	getErrorInfo,
	isRecoverableError
} from './typed-errors';
import { retry, retryWithErrorHandling, RetryConfigs, type RetryConfig } from './retry';

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

/**
 * Enhanced error recovery with exponential backoff retry logic
 */
export async function recoverableOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	const { enableRetry = true, retryConfig = RetryConfigs.default, ...handlerOptions } = options;

	if (!enableRetry) {
		return withErrorHandling(operation, handlerOptions);
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
					...(handlerOptions.context as any)?.additionalData
				}
			} as any, // Type assertion needed due to ErrorContext type mismatch
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

/**
 * Recoverable storage operations with specialized retry logic
 */
export async function recoverableStorageOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	return recoverableOperation(operation, {
		...options,
		retryConfig: {
			...RetryConfigs.default,
			maxAttempts: 5,
			initialDelayMs: 500,
			maxDelayMs: 5000,
			backoffFactor: 2,
			jitter: false, // Storage operations don't need jitter
			retryCondition: (error: unknown) => {
				// Retry on storage-related issues
				if (error instanceof StorageError) {
					return true;
				}
				// Retry on quota exceeded errors
				if (error instanceof Error && error.name === 'QuotaExceededError') {
					return true;
				}
				// Retry on general storage unavailable errors
				if (
					error instanceof Error &&
					(error.message.includes('storage') ||
						error.message.includes('quota') ||
						error.message.includes('unavailable'))
				) {
					return true;
				}
				return false;
			},
			...options.retryConfig
		},
		title: 'Storage Operation Failed',
		description: 'Failed to access storage. Retrying...'
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
		...options,
		retryConfig: {
			...RetryConfigs.file,
			retryCondition: (error: unknown) => {
				// Retry on file-related issues
				if (error instanceof FileError) {
					return true;
				}
				// Retry on file system temporary unavailability
				if (error instanceof Error && error.message.includes('busy')) {
					return true;
				}
				// Retry on file access denied (might be temporary)
				if (
					error instanceof Error &&
					(error.message.includes('access denied') || error.message.includes('permission denied'))
				) {
					return true;
				}
				return false;
			},
			...options.retryConfig
		},
		title: 'File Operation Failed',
		description: 'Failed to process file. Retrying...'
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
		...options,
		retryConfig: {
			...RetryConfigs.server,
			maxAttempts: 3,
			initialDelayMs: 2000,
			maxDelayMs: 10000,
			retryCondition: (error: unknown) => {
				// Retry on worker initialization errors
				if (error instanceof WorkerInitializationError) {
					return true;
				}
				// Retry on worker timeout errors
				if (error instanceof WorkerTimeoutError) {
					return true;
				}
				// Retry on general worker errors that might be temporary
				if (error instanceof WorkerError) {
					return true;
				}
				// Retry on worker not defined errors (happens in test environments)
				if (error instanceof Error && error.message.includes('Worker is not defined')) {
					return false; // Don't retry this, it's an environment issue
				}
				return false;
			},
			...options.retryConfig
		},
		title: 'Worker Operation Failed',
		description: 'Failed to execute worker operation. Retrying...'
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
		...options,
		retryConfig: {
			...RetryConfigs.server,
			maxAttempts: 2, // Generation is expensive, limit retries
			initialDelayMs: 5000,
			maxDelayMs: 15000,
			retryCondition: (error: unknown) => {
				// Retry on generation execution errors
				if (error instanceof GenerationExecutionError) {
					return true;
				}
				// Retry on memory issues that might be temporary
				if (
					error instanceof Error &&
					(error.message.includes('memory') || error.message.includes('out of memory'))
				) {
					return true;
				}
				// Don't retry on validation errors
				if (error instanceof GenerationValidationError) {
					return false;
				}
				return false;
			},
			...options.retryConfig
		},
		title: 'Generation Failed',
		description: 'Failed to generate NFTs. Retrying...'
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
		...options,
		retryConfig: {
			...RetryConfigs.network,
			retryCondition: (error: unknown) => {
				// Use existing network retry conditions
				return RetryConfigs.network.retryCondition?.(error) || false;
			},
			...options.retryConfig
		},
		title: 'Network Operation Failed',
		description: 'Failed to complete network operation. Retrying...'
	});
}
