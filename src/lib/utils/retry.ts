/**
 * Retry mechanisms and utilities for failed operations
 */

import { showError } from './error-handling';
import { logError, logWarning } from './error-logger';
import type { ErrorContext } from './error-logger';

export interface RetryConfig {
	maxAttempts: number;
	initialDelayMs: number;
	maxDelayMs: number;
	backoffFactor: number;
	jitter: boolean;
	retryCondition?: (error: unknown) => boolean;
	onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
	onFinalFailure?: (error: unknown) => void;
}

export interface RetryResult<T> {
	success: boolean;
	data?: T;
	error?: unknown;
	attempts: number;
	totalDurationMs: number;
}

export class RetryOperation<T> {
	private config: RetryConfig;
	private context?: ErrorContext;
	private operation: () => Promise<T>;

	constructor(
		operation: () => Promise<T>,
		config: Partial<RetryConfig> = {},
		context?: ErrorContext
	) {
		this.operation = operation;
		this.context = context;
		this.config = {
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			backoffFactor: 2,
			jitter: true,
			...config
		};
	}

	async execute(): Promise<RetryResult<T>> {
		const startTime = Date.now();
		let lastError: unknown;

		for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
			try {
				const data = await this.operation();

				console.log(`Operation succeeded on attempt ${attempt}`, {
					...this.context,
					additionalData: {
						attempts: attempt,
						durationMs: Date.now() - startTime
					}
				});

				return {
					success: true,
					data,
					attempts: attempt,
					totalDurationMs: Date.now() - startTime
				};
			} catch (error) {
				lastError = error;

				// Check if we should retry based on the retry condition
				if (this.config.retryCondition && !this.config.retryCondition(error)) {
					logWarning(
						`Operation failed and not retrying: ${error instanceof Error ? error.message : String(error)}`,
						{
							...this.context,
							additionalData: {
								attempt,
								reason: 'retry_condition_failed'
							}
						}
					);
					break;
				}

				// If this is the last attempt, break and return failure
				if (attempt === this.config.maxAttempts) {
					break;
				}

				// Calculate delay with exponential backoff
				const delayMs = this.calculateDelay(attempt);

				logWarning(`Operation failed on attempt ${attempt}, retrying in ${delayMs}ms`, {
					...this.context,
					additionalData: {
						attempt,
						nextAttempt: attempt + 1,
						delayMs,
						error: error instanceof Error ? error.message : String(error)
					}
				});

				// Call retry callback if provided
				if (this.config.onRetry) {
					this.config.onRetry(attempt, error, delayMs);
				}

				// Wait before retrying
				await this.sleep(delayMs);
			}
		}

		// Handle final failure
		const finalError =
			lastError instanceof Error ? lastError : new Error('Unknown error after retries');

		logError(finalError, {
			...this.context,
			additionalData: {
				totalAttempts: this.config.maxAttempts,
				totalDurationMs: Date.now() - startTime,
				operation: 'retry_operation'
			}
		});

		if (this.config.onFinalFailure) {
			this.config.onFinalFailure(finalError);
		}

		return {
			success: false,
			error: finalError,
			attempts: this.config.maxAttempts,
			totalDurationMs: Date.now() - startTime
		};
	}

	private calculateDelay(attempt: number): number {
		let delayMs = this.config.initialDelayMs * Math.pow(this.config.backoffFactor, attempt - 1);
		delayMs = Math.min(delayMs, this.config.maxDelayMs);

		// Add jitter to prevent thundering herd
		if (this.config.jitter) {
			delayMs = delayMs * (0.8 + Math.random() * 0.4); // ±20% jitter
		}

		return Math.floor(delayMs);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Common retry conditions for different types of operations
 */
export const RetryConditions = {
	// Retry on network errors
	isNetworkError: (error: unknown): boolean => {
		if (error instanceof Error) {
			return (
				error.name === 'NetworkError' ||
				(error.name === 'TypeError' && error.message.includes('fetch')) ||
				error.message.includes('network') ||
				error.message.includes('ECONNREFUSED') ||
				error.message.includes('ETIMEDOUT')
			);
		}
		return false;
	},

	// Retry on server errors (5xx status codes)
	isServerError: (error: unknown): boolean => {
		if (error && typeof error === 'object' && 'status' in error) {
			const status = (error as { status?: number }).status;
			return typeof status === 'number' && status >= 500 && status < 600;
		}
		return false;
	},

	// Retry on rate limiting errors (429 status code)
	isRateLimitError: (error: unknown): boolean => {
		if (error && typeof error === 'object' && 'status' in error) {
			const status = (error as { status?: number }).status;
			return typeof status === 'number' && status === 429;
		}
		return false;
	},

	// Retry on timeout errors
	isTimeoutError: (error: unknown): boolean => {
		if (error instanceof Error) {
			return (
				error.name === 'TimeoutError' ||
				error.message.includes('timeout') ||
				error.message.includes('TIMEDOUT')
			);
		}
		return false;
	},

	// Retry on resource temporarily unavailable
	isResourceUnavailable: (error: unknown): boolean => {
		if (error instanceof Error) {
			return (
				error.message.includes('unavailable') ||
				error.message.includes('busy') ||
				error.message.includes('overloaded')
			);
		}
		return false;
	},

	// Generic retry condition for common recoverable errors
	isRecoverable: (error: unknown): boolean => {
		return (
			RetryConditions.isNetworkError(error) ||
			RetryConditions.isServerError(error) ||
			RetryConditions.isRateLimitError(error) ||
			RetryConditions.isTimeoutError(error) ||
			RetryConditions.isResourceUnavailable(error)
		);
	}
};

/**
 * Predefined retry configurations for different scenarios
 */
export const RetryConfigs = {
	// Quick retries for network operations
	network: {
		maxAttempts: 3,
		initialDelayMs: 1000,
		maxDelayMs: 10000,
		backoffFactor: 2,
		jitter: true,
		retryCondition: RetryConditions.isNetworkError
	},

	// Longer retries for server operations
	server: {
		maxAttempts: 5,
		initialDelayMs: 2000,
		maxDelayMs: 30000,
		backoffFactor: 2,
		jitter: true,
		retryCondition: RetryConditions.isServerError
	},

	// Aggressive retries for rate limiting
	rateLimit: {
		maxAttempts: 10,
		initialDelayMs: 1000,
		maxDelayMs: 60000,
		backoffFactor: 1.5,
		jitter: true,
		retryCondition: RetryConditions.isRateLimitError
	},

	// Conservative retries for file operations
	file: {
		maxAttempts: 3,
		initialDelayMs: 500,
		maxDelayMs: 5000,
		backoffFactor: 2,
		jitter: false,
		retryCondition: RetryConditions.isResourceUnavailable
	},

	// Default configuration
	default: {
		maxAttempts: 3,
		initialDelayMs: 1000,
		maxDelayMs: 10000,
		backoffFactor: 2,
		jitter: true,
		retryCondition: RetryConditions.isRecoverable
	}
};

/**
 * Retry utility functions
 */
export async function retry<T>(
	operation: () => Promise<T>,
	config?: Partial<RetryConfig>,
	context?: ErrorContext
): Promise<RetryResult<T>> {
	const retryOp = new RetryOperation(operation, config, context);
	return await retryOp.execute();
}

/**
 * Retry with automatic fallback to user-friendly error
 */
export async function retryWithErrorHandling<T>(
	operation: () => Promise<T>,
	config?: Partial<RetryConfig>,
	context?: ErrorContext,
	errorMessage: string = 'Operation failed after multiple attempts'
): Promise<T> {
	const result = await retry(operation, config, {
		...context,
		additionalData: {
			...context?.additionalData,
			operation: 'retry_with_error_handling'
		}
	});

	if (!result.success) {
		const error = result.error instanceof Error ? result.error : new Error(errorMessage);
		showError(error, {
			description: `Failed after ${result.attempts} attempts`,
			action: {
				label: 'Retry',
				onClick: () => retryWithErrorHandling(operation, config, context, errorMessage)
			}
		});
		throw error;
	}

	return result.data!;
}

/**
 * Create a wrapped function with automatic retry
 */
export function withRetry<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
	fn: T,
	config?: Partial<RetryConfig>,
	context?: ErrorContext
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
	return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
		const operation = () => fn(...args);
		const result = await retry(operation, config, {
			...context,
			additionalData: {
				...context?.additionalData,
				function: fn.name || 'anonymous'
			}
		});

		if (!result.success) {
			throw result.error;
		}

		return result.data!;
	};
}

/**
 * Debounced retry function for rapid successive calls
 */
export function createDebouncedRetry<T>(
	operation: () => Promise<T>,
	config?: Partial<RetryConfig>,
	debounceMs: number = 1000,
	context?: ErrorContext
) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let pendingPromise: Promise<T> | null = null;

	return (): Promise<T> => {
		return new Promise((resolve, reject) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			timeoutId = setTimeout(async () => {
				try {
					if (!pendingPromise) {
						pendingPromise = new RetryOperation(operation, config, {
							...context,
							additionalData: {
								...context?.additionalData,
								operation: 'debounced_retry'
							}
						})
							.execute()
							.then((result) => {
								if (result.success) {
									return result.data!;
								} else {
									throw result.error;
								}
							});
					}

					const result = await pendingPromise;
					resolve(result);
					pendingPromise = null;
				} catch (error) {
					reject(error);
					pendingPromise = null;
				}
			}, debounceMs);
		});
	};
}
