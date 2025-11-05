/**
 * Performance monitoring utility for NFT Studio
 * Provides comprehensive metrics collection and analysis for application performance
 */

export interface PerformanceMetric {
	operation: string;
	duration: number;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface PerformanceStats {
	operation: string;
	count: number;
	totalDuration: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	lastDuration: number;
	metrics: PerformanceMetric[];
}

export interface PerformanceReport {
	generatedAt: number;
	operations: Record<string, PerformanceStats>;
	summary: {
		totalOperations: number;
		totalDuration: number;
		slowestOperation: string;
		fastestOperation: string;
		averageOperationTime: number;
	};
}

/**
 * Cache metrics interface for performance monitoring integration
 */
export interface CacheMetrics {
	hits: number;
	misses: number;
	sets: number;
	evictions: number;
	currentSize: number;
	currentEntries: number;
	maxSize: number;
	maxEntries: number;
	memoryUsage: number;
	hitRate: number;
	averageAccessCount: number;
}

/**
 * Performance Monitor class for tracking operation performance
 */
export class PerformanceMonitor {
	private metrics = new Map<string, PerformanceMetric[]>();
	private timers = new Map<string, number>();
	private enabled = true;

	/**
	 * Enable or disable performance monitoring
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (!enabled) {
			this.clear();
		}
	}

	/**
	 * Check if performance monitoring is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Start timing an operation
	 * @param operation - Name of the operation being timed
	 * @param id - Optional unique identifier for the timer
	 * @returns Timer ID for stopping the timer
	 */
	startTimer(operation: string, id?: string): string {
		if (!this.enabled) {
			return id || operation;
		}

		const timerId = id || `${operation}_${Date.now()}_${Math.random()}`;
		this.timers.set(timerId, performance.now());
		return timerId;
	}

	/**
	 * Stop timing an operation and record the duration
	 * @param timerId - Timer ID returned by startTimer
	 * @param metadata - Optional metadata to store with the metric
	 * @returns Duration in milliseconds
	 */
	stopTimer(timerId: string, metadata?: Record<string, unknown>): number {
		if (!this.enabled) {
			return 0;
		}

		const startTime = this.timers.get(timerId);
		if (!startTime) {
			console.warn(`Timer not found: ${timerId}`);
			return 0;
		}

		const duration = performance.now() - startTime;
		this.timers.delete(timerId);

		// Extract operation name from timer ID
		const operation = timerId.includes('_') ? timerId.split('_')[0] : timerId;

		this.recordMetric(operation, duration, metadata);
		return duration;
	}

	/**
	 * Record a performance metric directly
	 * @param operation - Name of the operation
	 * @param duration - Duration in milliseconds
	 * @param metadata - Optional metadata to store with the metric
	 */
	recordMetric(operation: string, duration: number, metadata?: Record<string, unknown>): void {
		if (!this.enabled) {
			return;
		}

		const metric: PerformanceMetric = {
			operation,
			duration,
			timestamp: Date.now(),
			metadata
		};

		if (!this.metrics.has(operation)) {
			this.metrics.set(operation, []);
		}

		const operationMetrics = this.metrics.get(operation)!;
		operationMetrics.push(metric);

		// Keep only last 100 metrics per operation to prevent memory leaks
		if (operationMetrics.length > 100) {
			operationMetrics.splice(0, operationMetrics.length - 100);
		}

		// Log slow operations (> 5 seconds)
		if (duration > 5000) {
			console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`, metadata);
		}
	}

	/**
	 * Get statistics for a specific operation
	 * @param operation - Name of the operation
	 * @returns Performance statistics or null if operation not found
	 */
	getStats(operation: string): PerformanceStats | null {
		const metrics = this.metrics.get(operation);
		if (!metrics || metrics.length === 0) {
			return null;
		}

		const durations = metrics.map((m) => m.duration);
		const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);

		return {
			operation,
			count: metrics.length,
			totalDuration,
			averageDuration: totalDuration / metrics.length,
			minDuration: Math.min(...durations),
			maxDuration: Math.max(...durations),
			lastDuration: durations[durations.length - 1],
			metrics: [...metrics]
		};
	}

	/**
	 * Get statistics for all operations
	 * @returns Record of operation names to their statistics
	 */
	getAllStats(): Record<string, PerformanceStats> {
		const stats: Record<string, PerformanceStats> = {};

		for (const operation of this.metrics.keys()) {
			const operationStats = this.getStats(operation);
			if (operationStats) {
				stats[operation] = operationStats;
			}
		}

		return stats;
	}

	/**
	 * Get average time for an operation
	 * @param operation - Name of the operation
	 * @returns Average duration in milliseconds or 0 if not found
	 */
	getAverageTime(operation: string): number {
		const stats = this.getStats(operation);
		return stats ? stats.averageDuration : 0;
	}

	/**
	 * Get the last recorded duration for an operation
	 * @param operation - Name of the operation
	 * @returns Last duration in milliseconds or 0 if not found
	 */
	getLastDuration(operation: string): number {
		const stats = this.getStats(operation);
		return stats ? stats.lastDuration : 0;
	}

	/**
	 * Generate a comprehensive performance report
	 * @returns Performance report with summary and detailed statistics
	 */
	generateReport(): PerformanceReport {
		const stats = this.getAllStats();
		const allStats = Object.values(stats);

		let totalOperations = 0;
		let totalDuration = 0;
		let slowestOperation = '';
		let fastestOperation = '';
		let maxDuration = 0;
		let minDuration = Infinity;

		for (const [operation, stat] of Object.entries(stats)) {
			totalOperations += stat.count;
			totalDuration += stat.totalDuration;

			if (stat.maxDuration > maxDuration) {
				maxDuration = stat.maxDuration;
				slowestOperation = operation;
			}

			if (stat.minDuration < minDuration) {
				minDuration = stat.minDuration;
				fastestOperation = operation;
			}
		}

		return {
			generatedAt: Date.now(),
			operations: stats,
			summary: {
				totalOperations,
				totalDuration,
				slowestOperation,
				fastestOperation,
				averageOperationTime: totalOperations > 0 ? totalDuration / totalOperations : 0
			}
		};
	}

	/**
	 * Add cache metrics to performance monitoring
	 * @param cacheType - Type of cache ('imageBitmap', 'imageData', 'arrayBuffer')
	 * @param metrics - Cache performance metrics
	 */
	addCacheMetrics(
		cacheType: 'imageBitmap' | 'imageData' | 'arrayBuffer',
		metrics: CacheMetrics
	): void {
		if (!this.enabled) return;

		// Record cache hit rate as a performance metric
		this.recordMetric(`cache.${cacheType}.hitRate`, metrics.hitRate, {
			cacheType,
			hits: metrics.hits,
			misses: metrics.misses,
			hitRate: metrics.hitRate,
			evictions: metrics.evictions,
			entries: metrics.currentEntries,
			memoryUsage: metrics.memoryUsage,
			averageAccessCount: metrics.averageAccessCount
		});

		// Record cache memory usage as a performance metric
		this.recordMetric(`cache.${cacheType}.memoryUsage`, metrics.memoryUsage, {
			cacheType,
			memoryUsage: metrics.memoryUsage,
			entries: metrics.currentEntries,
			maxMemory: metrics.maxSize
		});

		// Record cache hit rate percentage (for easier interpretation)
		this.recordMetric(`cache.${cacheType}.hitRatePercent`, metrics.hitRate * 100, {
			cacheType,
			hitRatePercent: metrics.hitRate * 100,
			hits: metrics.hits,
			misses: metrics.misses
		});

		// Log cache performance periodically
		const totalOps = metrics.hits + metrics.misses;
		if (totalOps > 0 && totalOps % 50 === 0) {
			// Every 50 operations
			const hitRatePercent = (metrics.hitRate * 100).toFixed(1);
			const memoryUsageMB = (metrics.memoryUsage / (1024 * 1024)).toFixed(2);
			console.log(
				`🎯 Cache ${cacheType}: ${hitRatePercent}% hit rate, ${memoryUsageMB}MB, ${metrics.currentEntries} entries`
			);
		}
	}

	/**
	 * Clear all metrics and timers
	 */
	clear(): void {
		this.metrics.clear();
		this.timers.clear();
	}

	/**
	 * Clear metrics for a specific operation
	 * @param operation - Name of the operation to clear
	 */
	clearOperation(operation: string): void {
		this.metrics.delete(operation);
		// Clear any timers for this operation
		for (const [timerId] of this.timers) {
			if (timerId.startsWith(operation)) {
				this.timers.delete(timerId);
			}
		}
	}

	/**
	 * Get metrics for operations within a time range
	 * @param startTime - Start timestamp in milliseconds
	 * @param endTime - End timestamp in milliseconds
	 * @returns Filtered performance statistics
	 */
	getMetricsInRange(startTime: number, endTime: number): Record<string, PerformanceStats> {
		const filteredStats: Record<string, PerformanceStats> = {};

		for (const [operation, metrics] of this.metrics) {
			const filteredMetrics = metrics.filter(
				(metric) => metric.timestamp >= startTime && metric.timestamp <= endTime
			);

			if (filteredMetrics.length > 0) {
				const durations = filteredMetrics.map((m) => m.duration);
				const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);

				filteredStats[operation] = {
					operation,
					count: filteredMetrics.length,
					totalDuration,
					averageDuration: totalDuration / filteredMetrics.length,
					minDuration: Math.min(...durations),
					maxDuration: Math.max(...durations),
					lastDuration: durations[durations.length - 1],
					metrics: filteredMetrics
				};
			}
		}

		return filteredStats;
	}

	/**
	 * Log performance summary to console
	 */
	logSummary(): void {
		if (!this.enabled) {
			return;
		}

		const report = this.generateReport();
		const { summary } = report;

		console.group('📊 Performance Summary');
		console.log(`Total Operations: ${summary.totalOperations}`);
		console.log(`Total Duration: ${summary.totalDuration.toFixed(2)}ms`);
		console.log(`Average Operation Time: ${summary.averageOperationTime.toFixed(2)}ms`);
		console.log(
			`Slowest Operation: ${summary.slowestOperation} (${this.getStats(summary.slowestOperation)?.maxDuration.toFixed(2)}ms)`
		);
		console.log(
			`Fastest Operation: ${summary.fastestOperation} (${this.getStats(summary.fastestOperation)?.minDuration.toFixed(2)}ms)`
		);

		if (Object.keys(report.operations).length > 0) {
			console.group('Operation Details');
			for (const [operation, stats] of Object.entries(report.operations)) {
				console.log(
					`${operation}: ${stats.count} calls, avg ${stats.averageDuration.toFixed(2)}ms`
				);
			}
			console.groupEnd();
		}

		console.groupEnd();
	}
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatically timing function execution
 * @param operationName - Name of the operation for logging
 * @param metadata - Optional metadata to include with the metric
 */
export function timed(operationName?: string, metadata?: Record<string, unknown>) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		const operation = operationName || `${target.constructor.name}.${propertyKey}`;

		descriptor.value = function (...args: any[]) {
			const timerId = performanceMonitor.startTimer(operation);
			try {
				const result = originalMethod.apply(this, args);

				// Handle both sync and async functions
				if (result && typeof result.then === 'function') {
					return result.finally(() => {
						performanceMonitor.stopTimer(timerId, metadata);
					});
				} else {
					performanceMonitor.stopTimer(timerId, metadata);
					return result;
				}
			} catch (error) {
				performanceMonitor.stopTimer(timerId, { ...metadata, error: String(error) });
				throw error;
			}
		};

		return descriptor;
	};
}

/**
 * Utility function to wrap an async function with performance monitoring
 * @param fn - Function to monitor
 * @param operationName - Name of the operation
 * @param metadata - Optional metadata to include with metrics
 * @returns Wrapped function with performance monitoring
 */
export function withTiming<T extends (...args: any[]) => any>(
	fn: T,
	operationName: string,
	metadata?: Record<string, unknown>
): T {
	return (async (...args: Parameters<T>) => {
		const timerId = performanceMonitor.startTimer(operationName);
		try {
			const result = await fn(...args);
			performanceMonitor.stopTimer(timerId, metadata);
			return result;
		} catch (error) {
			performanceMonitor.stopTimer(timerId, { ...metadata, error: String(error) });
			throw error;
		}
	}) as T;
}

/**
 * Utility function to measure a single operation
 * @param operation - Operation function to measure
 * @param operationName - Name of the operation
 * @param metadata - Optional metadata to include with metrics
 * @returns Promise that resolves to the operation result
 */
export async function measureOperation<T>(
	operation: () => Promise<T> | T,
	operationName: string,
	metadata?: Record<string, unknown>
): Promise<T> {
	const timerId = performanceMonitor.startTimer(operationName);
	try {
		const result = await operation();
		performanceMonitor.stopTimer(timerId, metadata);
		return result;
	} catch (error) {
		performanceMonitor.stopTimer(timerId, { ...metadata, error: String(error) });
		throw error;
	}
}
