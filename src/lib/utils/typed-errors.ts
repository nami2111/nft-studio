/**
 * Typed error class for all application errors.
 *
 * Uses a discriminant `code` field instead of a class hierarchy — callers
 * check `error.code === 'STORAGE_ERROR'` rather than `instanceof StorageError`.
 */

/**
 * Base error class for all application errors.
 *
 * @property code     - Machine-readable error code (e.g. 'STORAGE_ERROR', 'FILE_ERROR').
 * @property context   - Optional structured context for debugging / logging.
 * @property timestamp - When the error was created.
 * @property recoverable - Whether the operation can reasonably be retried.
 */
export class AppError extends Error {
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
	}

	/**
	 * Convert error to plain object for serialization.
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

/**
 * Common error codes used across the application.
 */
export const ErrorCodes = {
	STORAGE_ERROR: 'STORAGE_ERROR',
	FILE_ERROR: 'FILE_ERROR',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	WORKER_ERROR: 'WORKER_ERROR',
	GENERATION_ERROR: 'GENERATION_ERROR',
	NETWORK_ERROR: 'NETWORK_ERROR',
	CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
	UNHANDLED_ERROR: 'UNHANDLED_ERROR',
	CONVERTED_ERROR: 'CONVERTED_ERROR',
	ASYNC_ERROR: 'ASYNC_ERROR',
	SYNC_ERROR: 'SYNC_ERROR',
	RETRY_ERROR: 'RETRY_ERROR'
} as const;

/**
 * Helper function to extract error information for logging.
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
 * Helper function to check if an error is recoverable.
 */
export function isRecoverableError(error: unknown): boolean {
	if (error instanceof AppError) {
		return error.recoverable;
	}

	// Default to true for unknown errors to allow fallback behavior.
	return true;
}
