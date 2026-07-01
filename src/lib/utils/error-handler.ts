/**
 * Unified error handling.
 *
 * Single entry point for retry + error reporting:
 *   - `withRetry(op, category, options)` — recoverable async operations
 *   - `handleTypedError(error, category, options)` — turn unknowns into typed errors with user-facing messaging
 *   - `handleError` / `handleStorageError` — thin category shims over `handleTypedError`
 */

import type { ErrorContext, ErrorOptions } from './error-handling';
import { showError } from './error-handling';
import { type RetryConfig, RetryConfigs, retryWithErrorHandling } from './retry';
import { AppError, ErrorCodes, getErrorInfo, isRecoverableError } from './typed-errors';

export type ErrorCategory =
	| 'storage'
	| 'file'
	| 'validation'
	| 'worker'
	| 'generation'
	| 'network'
	| 'generic';

export interface ErrorHandlerOptions extends ErrorOptions {
	context?: ErrorContext;
	logError?: boolean;
	silent?: boolean;
	fallbackValue?: unknown;
	operation?: string;
	enableRetry?: boolean;
	retryConfig?: Partial<RetryConfig>;
}

interface CategorySpec {
	title: string;
	description: string;
	code: string;
	recoverable: boolean;
	retryConfig: Partial<RetryConfig>;
	isRetryable: (error: unknown) => boolean;
}

// Retry condition helpers

function isStorageRetryable(error: unknown): boolean {
	if (error instanceof AppError && error.code === ErrorCodes.STORAGE_ERROR) return true;
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
	if (error instanceof AppError && error.code === ErrorCodes.FILE_ERROR) return true;
	if (error instanceof Error && error.message.includes('busy')) return true;
	if (
		error instanceof Error &&
		(error.message.includes('access denied') || error.message.includes('permission denied'))
	)
		return true;
	return false;
}

function isWorkerRetryable(error: unknown): boolean {
	if (error instanceof AppError && error.code === ErrorCodes.WORKER_ERROR) return true;
	if (error instanceof Error && error.message.includes('Worker is not defined')) return false;
	return false;
}

function isGenerationRetryable(error: unknown): boolean {
	if (error instanceof AppError && error.code === ErrorCodes.GENERATION_ERROR) {
		const type = error.context?.type;
		if (type === 'validation') return false;
		if (type === 'execution') return true;
	}
	if (
		error instanceof Error &&
		(error.message.includes('memory') || error.message.includes('out of memory'))
	)
		return true;
	return false;
}

const CATEGORIES: Record<ErrorCategory, CategorySpec> = {
	storage: {
		title: 'Storage Operation Failed',
		description: 'Failed to access storage. Please check your browser settings.',
		code: ErrorCodes.STORAGE_ERROR,
		recoverable: true,
		retryConfig: {
			...RetryConfigs.default,
			maxAttempts: 5,
			initialDelayMs: 500,
			maxDelayMs: 5000,
			backoffFactor: 2,
			jitter: false,
			retryCondition: isStorageRetryable
		},
		isRetryable: isStorageRetryable
	},
	file: {
		title: 'File Operation Failed',
		description: 'Failed to process file. Please check the file and try again.',
		code: ErrorCodes.FILE_ERROR,
		recoverable: true,
		retryConfig: { ...RetryConfigs.file, retryCondition: isFileRetryable },
		isRetryable: isFileRetryable
	},
	validation: {
		title: 'Validation Error',
		description: 'Invalid input provided. Please check your data.',
		code: ErrorCodes.VALIDATION_ERROR,
		recoverable: true,
		retryConfig: { ...RetryConfigs.default, maxAttempts: 1 },
		isRetryable: () => false
	},
	worker: {
		title: 'Worker Operation Failed',
		description: 'Failed to execute worker operation. Please try again.',
		code: ErrorCodes.WORKER_ERROR,
		recoverable: true,
		retryConfig: {
			...RetryConfigs.server,
			maxAttempts: 3,
			initialDelayMs: 2000,
			maxDelayMs: 10000,
			retryCondition: isWorkerRetryable
		},
		isRetryable: isWorkerRetryable
	},
	generation: {
		title: 'Generation Failed',
		description: 'Failed to generate items. Please check your project configuration.',
		code: ErrorCodes.GENERATION_ERROR,
		recoverable: true,
		retryConfig: {
			...RetryConfigs.server,
			maxAttempts: 2,
			initialDelayMs: 5000,
			maxDelayMs: 15000,
			retryCondition: isGenerationRetryable
		},
		isRetryable: isGenerationRetryable
	},
	network: {
		title: 'Network Operation Failed',
		description: 'Failed to connect to the network. Please check your internet connection.',
		code: ErrorCodes.NETWORK_ERROR,
		recoverable: true,
		retryConfig: {
			...RetryConfigs.network,
			retryCondition: (error: unknown) => RetryConfigs.network.retryCondition?.(error) ?? false
		},
		isRetryable: (error: unknown) => RetryConfigs.network.retryCondition?.(error) ?? false
	},
	generic: {
		title: 'Operation Failed',
		description: 'An unexpected error occurred. Please try again.',
		code: ErrorCodes.UNHANDLED_ERROR,
		recoverable: true,
		retryConfig: { ...RetryConfigs.default },
		isRetryable: isRecoverableError
	}
};

function detectCategory(error: unknown): ErrorCategory {
	if (error instanceof AppError) {
		switch (error.code) {
			case ErrorCodes.STORAGE_ERROR:
				return 'storage';
			case ErrorCodes.FILE_ERROR:
				return 'file';
			case ErrorCodes.VALIDATION_ERROR:
				return 'validation';
			case ErrorCodes.WORKER_ERROR:
				return 'worker';
			case ErrorCodes.GENERATION_ERROR:
				return 'generation';
			case ErrorCodes.NETWORK_ERROR:
				return 'network';
		}
	}

	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		if (msg.includes('validation') || msg.includes('invalid')) return 'validation';
		if (msg.includes('storage') || msg.includes('localstorage')) return 'storage';
		if (msg.includes('file') || msg.includes('image')) return 'file';
		if (msg.includes('worker') || msg.includes('generation')) return 'worker';
		if (msg.includes('network') || msg.includes('fetch')) return 'network';
	}

	return 'generic';
}

function toAppError(
	error: unknown,
	category: ErrorCategory,
	context?: ErrorContext,
	operation?: string
): AppError {
	if (error instanceof AppError) return error;

	const enhancedContext = {
		...context,
		operation,
		originalError: error instanceof Error ? getErrorInfo(error) : undefined
	};

	const message = error instanceof Error ? error.message : String(error);
	const spec = CATEGORIES[category];

	return new AppError(
		message,
		spec.code,
		enhancedContext as Record<string, unknown>,
		spec.recoverable
	);
}

/**
 * Convert any error into a typed AppError, log it, and optionally show a user notification.
 * Returns fallback if provided, otherwise rethrows the typed error.
 */
export async function handleTypedError<T>(
	error: unknown,
	category: ErrorCategory = 'generic',
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

	const resolvedCategory = category === 'generic' ? detectCategory(error) : category;
	const appError = toAppError(error, resolvedCategory, context, operation);
	const spec = CATEGORIES[resolvedCategory];

	if (logError) {
		const log = appError.recoverable ? console.warn : console.error;
		log(`[${appError.recoverable ? 'WARNING' : 'ERROR'}] ${appError.message}`, appError.context);
	}

	if (!silent) {
		showError(appError, {
			title: errorOptions.title ?? spec.title,
			description: errorOptions.description ?? spec.description,
			...errorOptions
		});
	}

	if (fallbackValue !== undefined) return fallbackValue as T;
	throw appError;
}

/**
 * Run an async operation. On failure, convert to typed error and report.
 * If a fallback is provided in options, returns it; otherwise rethrows.
 */
export async function withSafeOperation<T>(
	operation: () => Promise<T>,
	options: ErrorHandlerOptions = {}
): Promise<T> {
	try {
		return await operation();
	} catch (error: unknown) {
		const result = await handleTypedError<T>(error, 'generic', options);
		if (result !== undefined) return result as T;
		throw error;
	}
}

export function withSafeOperationSync<T>(operation: () => T, options: ErrorHandlerOptions = {}): T {
	try {
		return operation();
	} catch (error: unknown) {
		const result = handleTypedError<T>(error, 'generic', options);
		if (result !== undefined) return result as T;
		throw error;
	}
}

/**
 * Retry an operation using the strategy registered for `category`.
 * On terminal failure, reports a typed error with user-facing messaging.
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	category: ErrorCategory = 'generic',
	options: ErrorHandlerOptions = {}
): Promise<T> {
	const spec = CATEGORIES[category];
	const { enableRetry = true, retryConfig, ...handlerOptions } = options;

	if (!enableRetry) {
		return withSafeOperation(operation, handlerOptions);
	}

	const mergedConfig: Partial<RetryConfig> = {
		...spec.retryConfig,
		...retryConfig,
		retryCondition: retryConfig?.retryCondition ?? spec.isRetryable
	};

	try {
		return await retryWithErrorHandling(
			operation,
			mergedConfig,
			{
				operation: handlerOptions.operation,
				additionalData: {
					enableRetry: true,
					category,
					...((handlerOptions.context as unknown as Record<string, unknown>)
						?.additionalData as Record<string, unknown>)
				}
			} as unknown as ErrorContext,
			`Operation "${handlerOptions.operation || 'unknown'}" failed after multiple attempts`
		);
	} catch (error) {
		await handleTypedError(error, category, {
			...handlerOptions,
			title: handlerOptions.title ?? spec.title,
			description: handlerOptions.description ?? spec.description,
			action: {
				label: 'Retry',
				onClick: () => withRetry(operation, category, options)
			}
		});
		throw error;
	}
}

// Generic helpers

export function isErrorRecoverable(error: unknown): boolean {
	return isRecoverableError(error);
}

export function getDetailedErrorInfo(error: unknown): ReturnType<typeof getErrorInfo> {
	return getErrorInfo(error);
}

export function createTypedError(error: unknown, context?: Record<string, unknown>): AppError {
	if (error instanceof AppError) return error;
	const errorInfo = getErrorInfo(error);
	return new AppError(errorInfo.message, ErrorCodes.CONVERTED_ERROR, context, true);
}

// ============================================================================
// Deprecated compat shims — kept for back-compat; only the two with live
// callers survive. The other 11 zero-caller wrappers were removed.
// ============================================================================

/** @deprecated Use {@link handleTypedError} */
export async function handleError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	return handleTypedError<T>(error, 'generic', options);
}

/** @deprecated Use {@link handleTypedError} with category 'storage' */
export async function handleStorageError<T>(
	error: unknown,
	options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
	return handleTypedError<T>(error, 'storage', options);
}
