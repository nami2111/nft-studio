/**
 * Error logging system for tracking and monitoring application errors
 */

export interface ErrorLogEntry {
	id: string;
	timestamp: Date;
	errorType: string;
	message: string;
	stackTrace?: string;
	context?: ErrorContext;
	severity: 'info' | 'warning' | 'error' | 'critical';
	userAgent?: string;
	url?: string;
	lineNumber?: number;
	columnNumber?: number;
	handled: boolean;
	sessionId?: string;
}

export interface ErrorContext {
	component?: string;
	action?: string;
	userAction?: string;
	route?: string;
	additionalData?: Record<string, unknown>;
}

export interface ErrorLoggerConfig {
	maxEntries: number;
	persistToStorage: boolean;
	sendToConsole: boolean;
	remoteLogging?: {
		enabled: boolean;
		endpoint?: string;
		apiKey?: string;
	};
	excludedErrors: string[];
}

class ErrorLogger {
	private logs: ErrorLogEntry[] = [];
	private config: ErrorLoggerConfig;
	private sessionId: string;

	constructor(config: Partial<ErrorLoggerConfig> = {}) {
		this.config = {
			maxEntries: 100,
			persistToStorage: true,
			sendToConsole: true,
			excludedErrors: [],
			...config
		};

		this.sessionId = crypto.randomUUID();

		// Set up global error handlers
		this.setupGlobalErrorHandlers();

		// Load logs from storage if enabled
		this.loadLogsFromStorage();
	}

	private setupGlobalErrorHandlers(): void {
		if (typeof window !== 'undefined') {
			// Handle uncaught JavaScript errors
			window.addEventListener('error', (event) => {
				if (this.config.excludedErrors.includes(event.message)) {
					return;
				}

				this.logError({
					errorType: 'UncaughtError',
					message: event.message,
					stackTrace: event.error?.stack,
					context: {
						additionalData: {
							filename: event.filename,
							lineNumber: event.lineno,
							columnNumber: event.colno
						}
					},
					severity: 'critical',
					handled: false,
					userAgent: navigator.userAgent,
					url: window.location.href
				});
			});

			// Handle unhandled promise rejections
			window.addEventListener('unhandledrejection', (event) => {
				const error = event.reason;
				const message = error instanceof Error ? error.message : String(error);
				const stackTrace = error instanceof Error ? error.stack : undefined;

				this.logError({
					errorType: 'UnhandledPromiseRejection',
					message,
					stackTrace,
					severity: 'critical',
					handled: false,
					userAgent: navigator.userAgent,
					url: window.location.href
				});
			});
		}
	}

	private loadLogsFromStorage(): void {
		if (!this.config.persistToStorage || typeof localStorage === 'undefined') {
			return;
		}

		try {
			const stored = localStorage.getItem('nft-studio-error-logs');
			if (stored) {
				const parsedLogs = JSON.parse(stored);
				this.logs = parsedLogs.map((log: { timestamp: string | number | Date }) => ({
					...log,
					timestamp: new Date(log.timestamp)
				}));

				// Trim to max entries
				this.trimLogs();
			}
		} catch (error) {
			console.warn('Failed to load error logs from storage:', error);
		}
	}

	private saveLogsToStorage(): void {
		if (!this.config.persistToStorage || typeof localStorage === 'undefined') {
			return;
		}

		try {
			localStorage.setItem('nft-studio-error-logs', JSON.stringify(this.logs));
		} catch (error) {
			console.warn('Failed to save error logs to storage:', error);
		}
	}

	private trimLogs(): void {
		if (this.logs.length > this.config.maxEntries) {
			this.logs = this.logs.slice(-this.config.maxEntries);
		}
	}

	logError(entry: Omit<ErrorLogEntry, 'id' | 'timestamp' | 'sessionId'>): string {
		const logEntry: ErrorLogEntry = {
			id: crypto.randomUUID(),
			timestamp: new Date(),
			sessionId: this.sessionId,
			...entry
		};

		this.logs.push(logEntry);
		this.trimLogs();

		if (this.config.sendToConsole) {
			this.sendToConsole(logEntry);
		}

		if (this.config.persistToStorage) {
			this.saveLogsToStorage();
		}

		if (this.config.remoteLogging?.enabled) {
			this.sendToRemote(logEntry);
		}

		return logEntry.id;
	}

	logCustomError(
		errorType: string,
		message: string,
		severity: ErrorLogEntry['severity'] = 'error',
		context?: ErrorContext,
		stackTrace?: string
	): string {
		return this.logError({
			errorType,
			message,
			severity,
			context,
			stackTrace,
			handled: true,
			url: typeof window !== 'undefined' ? window.location.href : undefined,
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
		});
	}

	logAppError(error: Error, errorType: string = 'AppError', context?: ErrorContext): string {
		return this.logError({
			errorType,
			message: error.message,
			stackTrace: error.stack,
			context,
			severity: 'error',
			handled: true,
			url: typeof window !== 'undefined' ? window.location.href : undefined,
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
		});
	}

	logInfo(message: string, context?: ErrorContext): string {
		return this.logCustomError('Info', message, 'info', context);
	}

	logWarning(message: string, context?: ErrorContext): string {
		return this.logCustomError('Warning', message, 'warning', context);
	}

	logCritical(message: string, context?: ErrorContext, stackTrace?: string): string {
		return this.logCustomError('Critical', message, 'critical', context, stackTrace);
	}

	private sendToConsole(entry: ErrorLogEntry): void {
		const consoleMethod = {
			info: console.info,
			warning: console.warn,
			error: console.error,
			critical: console.error
		}[entry.severity];

		const message = `[${entry.severity.toUpperCase()}] ${entry.errorType}: ${entry.message}`;
		const additionalData = {
			id: entry.id,
			timestamp: entry.timestamp,
			context: entry.context,
			handled: entry.handled,
			url: entry.url
		};

		consoleMethod(message, additionalData);
	}

	private async sendToRemote(entry: ErrorLogEntry): Promise<void> {
		if (!this.config.remoteLogging?.enabled || !this.config.remoteLogging.endpoint) {
			return;
		}

		try {
			const response = await fetch(this.config.remoteLogging.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(this.config.remoteLogging.apiKey && {
						Authorization: `Bearer ${this.config.remoteLogging.apiKey}`
					})
				},
				body: JSON.stringify(entry)
			});

			if (!response.ok) {
				console.warn(
					'Failed to send error log to remote endpoint:',
					response.status,
					response.statusText
				);
			}
		} catch (error) {
			console.warn('Failed to send error log to remote endpoint:', error);
		}
	}

	getLogs(filter?: {
		severity?: ErrorLogEntry['severity'];
		errorType?: string;
		since?: Date;
		limit?: number;
	}): ErrorLogEntry[] {
		let filteredLogs = [...this.logs];

		if (filter) {
			if (filter.severity) {
				filteredLogs = filteredLogs.filter((log) => log.severity === filter.severity);
			}

			if (filter.errorType) {
				filteredLogs = filteredLogs.filter((log) => log.errorType === filter.errorType);
			}

			if (filter.since) {
				filteredLogs = filteredLogs.filter((log) => log.timestamp >= filter.since!);
			}

			if (filter.limit) {
				filteredLogs = filteredLogs.slice(-filter.limit);
			}
		}

		return filteredLogs;
	}

	getLogsByErrorType(errorType: string): ErrorLogEntry[] {
		return this.logs.filter((log) => log.errorType === errorType);
	}

	getErrorStats(): {
		total: number;
		bySeverity: Record<ErrorLogEntry['severity'], number>;
		byErrorType: Record<string, number>;
		recentErrors: number; // Last 24 hours
	} {
		const now = new Date();
		const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		const bySeverity: Record<ErrorLogEntry['severity'], number> = {
			info: 0,
			warning: 0,
			error: 0,
			critical: 0
		};

		const byErrorType: Record<string, number> = {};

		this.logs.forEach((log) => {
			bySeverity[log.severity]++;
			byErrorType[log.errorType] = (byErrorType[log.errorType] || 0) + 1;
		});

		return {
			total: this.logs.length,
			bySeverity,
			byErrorType,
			recentErrors: this.logs.filter((log) => log.timestamp >= yesterday).length
		};
	}

	clearLogs(): void {
		this.logs = [];
		if (this.config.persistToStorage && typeof localStorage !== 'undefined') {
			localStorage.removeItem('nft-studio-error-logs');
		}
	}

	exportLogs(): string {
		return JSON.stringify(
			{
				logs: this.logs,
				stats: this.getErrorStats(),
				sessionId: this.sessionId,
				exportedAt: new Date().toISOString()
			},
			null,
			2
		);
	}

	updateConfig(newConfig: Partial<ErrorLoggerConfig>): void {
		this.config = { ...this.config, ...newConfig };

		if (newConfig.maxEntries !== undefined) {
			this.trimLogs();
		}
	}
}

// Create singleton instance
export const errorLogger = new ErrorLogger({
	maxEntries: 100,
	persistToStorage: true,
	sendToConsole: true,
	remoteLogging: {
		enabled: false // Can be enabled when remote endpoint is available
	},
	excludedErrors: [
		// Common errors to exclude from logging
		'ResizeObserver loop limit exceeded',
		'Non-Error promise rejection captured'
	]
});

// Export utility functions for common use cases
export const logError = (error: Error, context?: ErrorContext) =>
	errorLogger.logAppError(error, 'AppError', context);
export const logCritical = (message: string, context?: ErrorContext) =>
	errorLogger.logCritical(message, context);
export const logWarning = (message: string, context?: ErrorContext) =>
	errorLogger.logWarning(message, context);
export const logInfo = (message: string, context?: ErrorContext) =>
	errorLogger.logInfo(message, context);
