/**
 * Minimal performance monitoring.
 *
 * Tracks operation timings (with a console warning for slow operations) and
 * database query durations. Deliberately small: metrics nobody reads were
 * removed — add reporting back when something consumes it.
 */

interface Timer {
	operation: string;
	start: number;
}

export class PerformanceMonitor {
	private timers = new Map<string, Timer>();
	private dbQueryCount = 0;
	private dbTotalQueryTime = 0;

	/**
	 * Start timing an operation.
	 *
	 * @param operation - Name of the operation being timed.
	 * @returns Timer ID for `stopTimer`.
	 */
	startTimer(operation: string): string {
		const timerId = `${operation}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
		this.timers.set(timerId, { operation, start: performance.now() });
		return timerId;
	}

	/**
	 * Stop a timer and return the elapsed duration in milliseconds.
	 *
	 * @param timerId - ID returned by `startTimer`.
	 * @param metadata - Optional context included in slow-operation warnings.
	 * @returns Duration in milliseconds, or 0 if the timer is unknown.
	 */
	stopTimer(timerId: string, metadata?: Record<string, unknown>): number {
		const timer = this.timers.get(timerId);
		if (!timer) return 0;
		this.timers.delete(timerId);

		const duration = performance.now() - timer.start;
		if (duration > 5000) {
			console.warn(`Slow operation: ${timer.operation} took ${duration.toFixed(2)}ms`, metadata);
		}
		return duration;
	}

	/**
	 * Record a database query duration; warns on queries slower than 100ms.
	 */
	recordDatabaseQuery(operation: string, duration: number): void {
		this.dbQueryCount++;
		this.dbTotalQueryTime += duration;
		if (duration > 100) {
			console.warn(`Slow database query: ${operation} took ${duration.toFixed(1)}ms`);
		}
	}

	getDatabaseMetrics(): { queryCount: number; averageQueryTime: number } {
		return {
			queryCount: this.dbQueryCount,
			averageQueryTime: this.dbQueryCount > 0 ? this.dbTotalQueryTime / this.dbQueryCount : 0
		};
	}

	/** Clear all timers and counters. */
	clear(): void {
		this.timers.clear();
		this.dbQueryCount = 0;
		this.dbTotalQueryTime = 0;
	}
}

// Global singleton. `productionMonitor` kept as alias for existing imports.
export const performanceMonitor = new PerformanceMonitor();
export const productionMonitor = performanceMonitor;

/**
 * Measure a single async operation with the global monitor.
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
