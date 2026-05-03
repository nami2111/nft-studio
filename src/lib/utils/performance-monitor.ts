/**
 * Performance monitoring utility
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
			memoryUsage: metrics.memoryUsage
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
			if (import.meta.env.DEV)
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

	// ==========================================
	// Cache Monitoring
	// ==========================================

	private cacheMetrics = new Map<
		string,
		{ hits: number; misses: number; evictions: number; memoryUsage: number }
	>();

	recordCacheHit(cacheName: string): void {
		const m = this.getOrCreateCacheMetrics(cacheName);
		m.hits++;
	}

	recordCacheMiss(cacheName: string): void {
		const m = this.getOrCreateCacheMetrics(cacheName);
		m.misses++;
	}

	recordCacheEviction(cacheName: string, memoryFreed: number): void {
		const m = this.getOrCreateCacheMetrics(cacheName);
		m.evictions++;
		m.memoryUsage = Math.max(0, m.memoryUsage - memoryFreed);
	}

	updateCacheMemoryUsage(cacheName: string, memoryUsage: number): void {
		const m = this.getOrCreateCacheMetrics(cacheName);
		m.memoryUsage = memoryUsage;
	}

	getCacheHitRate(cacheName: string): number {
		const m = this.cacheMetrics.get(cacheName);
		if (!m) return 0;
		const total = m.hits + m.misses;
		return total === 0 ? 0 : (m.hits / total) * 100;
	}

	private getOrCreateCacheMetrics(cacheName: string) {
		if (!this.cacheMetrics.has(cacheName)) {
			this.cacheMetrics.set(cacheName, {
				hits: 0,
				misses: 0,
				evictions: 0,
				memoryUsage: 0
			});
		}
		return this.cacheMetrics.get(cacheName)!;
	}

	// ==========================================
	// Database Monitoring
	// ==========================================

	private dbQueryCount = 0;
	private dbTotalQueryTime = 0;

	recordDatabaseQuery(_operation: string, duration: number): void {
		this.dbQueryCount++;
		this.dbTotalQueryTime += duration;
		if (duration > 100) {
			console.warn(`Slow database query: ${_operation} took ${duration.toFixed(1)}ms`);
		}
	}

	getDatabaseMetrics(): { queryCount: number; averageQueryTime: number } {
		return {
			queryCount: this.dbQueryCount,
			averageQueryTime: this.dbQueryCount > 0 ? this.dbTotalQueryTime / this.dbQueryCount : 0
		};
	}

	// ==========================================
	// Memory Monitoring
	// ==========================================

	private memoryHistory: Array<{
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
		timestamp: number;
	}> = [];

	captureMemoryMetrics(): void {
		if (typeof window === 'undefined') return;
		const p = performance as Performance & {
			memory?: {
				usedJSHeapSize: number;
				totalJSHeapSize: number;
				jsHeapSizeLimit: number;
			};
		};
		const memory = p.memory;
		if (!memory) return;
		this.memoryHistory.push({ ...memory, timestamp: Date.now() });
		if (this.memoryHistory.length > 100) this.memoryHistory = this.memoryHistory.slice(-100);
	}

	getAverageMemoryUsage(minutes = 5): number {
		const cutoff = Date.now() - minutes * 60 * 1000;
		const recent = this.memoryHistory.filter((m) => m.timestamp >= cutoff);
		if (recent.length === 0) return 0;
		return recent.reduce((s, m) => s + m.usedJSHeapSize, 0) / recent.length / (1024 * 1024);
	}

	// ==========================================
	// Alerts
	// ==========================================

	private alerts: Array<{
		id: string;
		metric: string;
		value: number;
		threshold: number;
		severity: string;
		timestamp: number;
		message: string;
	}> = [];

	createAlert(data: {
		metric: string;
		value: number;
		threshold: number;
		severity: string;
		message: string;
	}): void {
		const alert = {
			id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			...data,
			timestamp: Date.now()
		};
		this.alerts.push(alert);
		if (this.alerts.length > 50) this.alerts = this.alerts.slice(-50);
		if (alert.severity === 'critical' || alert.severity === 'high') {
			console.warn(`[Performance Alert] ${alert.message}`);
		}
	}

	getAlerts(minutes = 15) {
		const cutoff = Date.now() - minutes * 60 * 1000;
		return this.alerts.filter((a) => a.timestamp >= cutoff);
	}

	// ==========================================
	// Batch Progress Tracking (Sequential)
	// ==========================================

	private batchStartTime = 0;
	private batchProcessed = 0;
	private batchTotal = 0;
	private batchAvgTime = 0;
	private batchLastReport = 0;

	startBatch(totalCount: number): void {
		this.batchStartTime = performance.now();
		this.batchProcessed = 0;
		this.batchTotal = totalCount;
		this.batchAvgTime = 0;
		this.batchLastReport = this.batchStartTime;
	}

	recordBatchItem(timePerItem: number): void {
		this.batchProcessed++;
		this.batchAvgTime =
			(this.batchAvgTime * (this.batchProcessed - 1) + timePerItem) / this.batchProcessed;
		const now = performance.now();
		if (now - this.batchLastReport > 2000) {
			const elapsed = now - this.batchStartTime;
			const rate = this.batchProcessed / (elapsed / 1000);
			const remaining = Math.max(0, this.batchTotal - this.batchProcessed);
			const eta = (this.batchAvgTime * remaining) / 1000 / 60;
			if (import.meta.env.DEV)
				console.log(
					`⚡ Sequential Performance: ${this.batchProcessed}/${this.batchTotal} items | ${rate.toFixed(1)} items/sec | ETA: ${eta.toFixed(1)}min | Avg: ${this.batchAvgTime.toFixed(1)}ms/item`
				);
			this.batchLastReport = now;
		}
	}

	finishBatch(): void {
		const totalTime = performance.now() - this.batchStartTime;
		const finalRate = this.batchProcessed / (totalTime / 1000);
		if (import.meta.env.DEV)
			console.log(
				`🎯 Sequential Generation Complete: ${this.batchProcessed} items in ${(totalTime / 1000).toFixed(1)}s | Average: ${finalRate.toFixed(1)} items/sec`
			);
	}

	// ==========================================
	// Reset
	// ==========================================

	resetAllMetrics(): void {
		this.cacheMetrics.clear();
		this.dbQueryCount = 0;
		this.dbTotalQueryTime = 0;
		this.memoryHistory = [];
		this.alerts = [];
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
		if (import.meta.env.DEV) console.log(`Total Operations: ${summary.totalOperations}`);
		if (import.meta.env.DEV) console.log(`Total Duration: ${summary.totalDuration.toFixed(2)}ms`);
		if (import.meta.env.DEV)
			console.log(`Average Operation Time: ${summary.averageOperationTime.toFixed(2)}ms`);
		if (import.meta.env.DEV)
			console.log(
				`Slowest Operation: ${summary.slowestOperation} (${this.getStats(summary.slowestOperation)?.maxDuration.toFixed(2)}ms)`
			);
		if (import.meta.env.DEV)
			console.log(
				`Fastest Operation: ${summary.fastestOperation} (${this.getStats(summary.fastestOperation)?.minDuration.toFixed(2)}ms)`
			);

		if (Object.keys(report.operations).length > 0) {
			console.group('Operation Details');
			for (const [operation, stats] of Object.entries(report.operations)) {
				if (import.meta.env.DEV)
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
	return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
		const originalMethod = descriptor.value;
		const operation =
			operationName ||
			`${(target as Record<string, unknown>).constructor?.name || 'Unknown'}.${propertyKey}`;

		descriptor.value = function (...args: unknown[]) {
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
				performanceMonitor.stopTimer(timerId, {
					...metadata,
					error: String(error)
				});
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
export function withTiming<T extends (...args: unknown[]) => unknown>(
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
			performanceMonitor.stopTimer(timerId, {
				...metadata,
				error: String(error)
			});
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
		performanceMonitor.stopTimer(timerId, {
			...metadata,
			error: String(error)
		});
		throw error;
	}
}
