/**
 * Centralized error handling utilities
 */

import { toast } from 'svelte-sonner';
import { AppError } from './typed-errors';

// Re-export AppError for backward compatibility
export { AppError };

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

/**
 * Show user-friendly error message with toast notification
 */
export function showError(error: unknown, options: ErrorOptions = {}): void {
	let errorMessage = 'An unexpected error occurred';
	let errorTitle = 'Error';
	let errorContext: Record<string, unknown> | undefined;

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
		const component = errorContext.component as string | undefined;
		const action = errorContext.action as string | undefined;
		const userAction = errorContext.userAction as string | undefined;
		if (component) contextParts.push(`Component: ${component}`);
		if (action) contextParts.push(`Action: ${action}`);
		if (userAction) contextParts.push(`User Action: ${userAction}`);

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
