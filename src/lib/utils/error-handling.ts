/**
 * Centralized error handling utilities for the NFT Studio application
 */

import { toast } from 'svelte-sonner';

export interface ErrorOptions {
	title?: string;
	description?: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	duration?: number;
	dismissable?: boolean;
}

export interface ErrorContext {
	component?: string;
	action?: string;
	timestamp?: Date;
	userAction?: string;
}

export class AppError extends Error {
	public readonly code: string;
	public readonly context?: ErrorContext;
	public readonly recoverable: boolean;

	constructor(
		message: string,
		code: string = 'APP_ERROR',
		context?: ErrorContext,
		recoverable: boolean = true
	) {
		super(message);
		this.name = 'AppError';
		this.code = code;
		this.context = context;
		this.recoverable = recoverable;
	}
}

export class ValidationError extends AppError {
	constructor(message: string, context?: ErrorContext) {
		super(message, 'VALIDATION_ERROR', context, false);
		this.name = 'ValidationError';
	}
}

export class NetworkError extends AppError {
	constructor(message: string, context?: ErrorContext) {
		super(message, 'NETWORK_ERROR', context, true);
		this.name = 'NetworkError';
	}
}

export class WorkerError extends AppError {
	constructor(message: string, context?: ErrorContext) {
		super(message, 'WORKER_ERROR', context, true);
		this.name = 'WorkerError';
	}
}

export class StorageError extends AppError {
	constructor(message: string, context?: ErrorContext) {
		super(message, 'STORAGE_ERROR', context, true);
		this.name = 'StorageError';
	}
}

export class FileSystemError extends AppError {
	constructor(message: string, context?: ErrorContext) {
		super(message, 'FILE_SYSTEM_ERROR', context, true);
		this.name = 'FileSystemError';
	}
}

/**
 * Show user-friendly error message with toast notification
 */
export function showError(error: unknown, options: ErrorOptions = {}): void {
	let errorMessage = 'An unexpected error occurred';
	let errorTitle = 'Error';
	let errorContext: ErrorContext | undefined;

	if (error instanceof AppError) {
		errorMessage = error.message;
		errorTitle = error.name;
		errorContext = error.context;
	} else if (error instanceof Error) {
		errorMessage = error.message;
		errorTitle = 'Error';
	} else if (typeof error === 'string') {
		errorMessage = error;
		errorTitle = 'Error';
	} else {
		errorMessage = 'An unexpected error occurred';
		errorTitle = 'Unknown Error';
	}

	// Add context to description if available
	let description = options.description;
	if (errorContext) {
		const contextParts = [];
		if (errorContext.component) contextParts.push(`Component: ${errorContext.component}`);
		if (errorContext.action) contextParts.push(`Action: ${errorContext.action}`);
		if (errorContext.userAction) contextParts.push(`User Action: ${errorContext.userAction}`);

		if (contextParts.length > 0) {
			description = description
				? `${description}\n\nContext: ${contextParts.join(', ')}`
				: contextParts.join(', ');
		}
	}

	// Show toast notification
	toast.error(errorMessage, {
		description: description || undefined,
		duration: options.duration || 5000,
		action: options.action,
		dismissable: options.dismissable !== false
	});

	// Log the full error for debugging
	console.error(`[${errorTitle}] ${errorMessage}`, error, errorContext);
}

/**
 * Show success message with toast notification
 */
export function showSuccess(message: string, options: Omit<ErrorOptions, 'title'> = {}): void {
	toast.success(message, {
		description: options.description,
		duration: options.duration || 3000,
		action: options.action,
		dismissable: options.dismissable !== false
	});
}

/**
 * Show info message with toast notification
 */
export function showInfo(message: string, options: Omit<ErrorOptions, 'title'> = {}): void {
	toast.info(message, {
		description: options.description,
		duration: options.duration || 4000,
		action: options.action,
		dismissable: options.dismissable !== false
	});
}

/**
 * Show warning message with toast notification
 */
export function showWarning(message: string, options: Omit<ErrorOptions, 'title'> = {}): void {
	toast.warning(message, {
		description: options.description,
		duration: options.duration || 4000,
		action: options.action,
		dismissable: options.dismissable !== false
	});
}

/**
 * Handle async errors with proper error boundary support
 */
export async function withErrorHandling<T>(
	fn: () => Promise<T>,
	context?: ErrorContext,
	options?: ErrorOptions & { fallback?: () => T }
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		const appError =
			error instanceof AppError
				? error
				: new AppError(
						error instanceof Error ? error.message : 'Unknown error',
						'ASYNC_ERROR',
						context,
						true
					);

		showError(appError, options);

		if (options?.fallback) {
			return options.fallback();
		}

		throw appError;
	}
}

/**
 * Wrap a function with automatic error handling
 */
export function wrapWithErrorHandling<T extends (...args: unknown[]) => unknown>(
	fn: T,
	context?: ErrorContext,
	options?: ErrorOptions & { fallback?: (...args: Parameters<T>) => ReturnType<T> }
): T {
	return ((...args: Parameters<T>) => {
		try {
			const result = fn(...args);

			if (result instanceof Promise) {
				return result.catch((error) => {
					const appError =
						error instanceof AppError
							? error
							: new AppError(
									error instanceof Error ? error.message : 'Unknown error',
									'ASYNC_ERROR',
									context,
									true
								);

					showError(appError, options);

					if (options?.fallback) {
						return options.fallback(...args);
					}

					throw appError;
				});
			}

			return result;
		} catch (error) {
			const appError =
				error instanceof AppError
					? error
					: new AppError(
							error instanceof Error ? error.message : 'Unknown error',
							'SYNC_ERROR',
							context,
							true
						);

			showError(appError, options);

			if (options?.fallback) {
				return options.fallback(...args);
			}

			throw appError;
		}
	}) as T;
}

/**
 * Create a retry utility for failed operations
 */
export function createRetry<T>(
	fn: () => Promise<T>,
	maxRetries: number = 3,
	delayMs: number = 1000,
	backoffFactor: number = 2,
	context?: ErrorContext
): () => Promise<T> {
	return async (): Promise<T> => {
		let lastError: Error | unknown;
		let currentDelay = delayMs;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await fn();
			} catch (error) {
				lastError = error;

				if (attempt === maxRetries) {
					break;
				}

				console.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms:`, error);

				// Show warning for retry attempts
				showWarning(`Operation failed, retrying (${attempt}/${maxRetries})...`, {
					description: `Retry in ${currentDelay / 1000} seconds`,
					duration: currentDelay - 100 // Show for slightly less than the delay
				});

				await new Promise((resolve) => setTimeout(resolve, currentDelay));
				currentDelay *= backoffFactor;
			}
		}

		const finalError =
			lastError instanceof Error ? lastError : new Error('Unknown error after retries');
		throw new AppError(
			`Operation failed after ${maxRetries} attempts: ${finalError.message}`,
			'RETRY_ERROR',
			context,
			true
		);
	};
}
