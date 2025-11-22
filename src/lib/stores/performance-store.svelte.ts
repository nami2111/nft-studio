/**
 * Performance monitoring store for Svelte integration
 * Provides reactive performance metrics and statistics
 */

import {
	performanceMonitor,
	type PerformanceStats,
	type PerformanceReport
} from '$lib/utils/performance-monitor';
import { onDestroy } from 'svelte';

// Reactive state for performance metrics
let isMonitoringEnabled = $state(performanceMonitor.isEnabled());

// Reactive state for performance statistics
let performanceStats = $state<Record<string, PerformanceStats>>({});

// Reactive state for performance report
let performanceReport = $state<PerformanceReport | null>(null);

// Update interval in milliseconds
const UPDATE_INTERVAL = 1000;

// Interval reference for cleanup
let updateInterval: number | null = null;

/**
 * Update performance statistics reactively
 */
function updateStats(): void {
	performanceStats = performanceMonitor.getAllStats();
	performanceReport = performanceMonitor.generateReport();
}

/**
 * Enable performance monitoring and start reactive updates
 */
export function enableMonitoring(): void {
	performanceMonitor.setEnabled(true);
	isMonitoringEnabled = true;
	updateStats();
	startUpdateInterval();
}

/**
 * Disable performance monitoring and stop updates
 */
export function disableMonitoring(): void {
	performanceMonitor.setEnabled(false);
	isMonitoringEnabled = false;
	stopUpdateInterval();
	performanceStats = {};
	performanceReport = null;
}

/**
 * Toggle performance monitoring on/off
 */
export function toggleMonitoring(): void {
	if (isMonitoringEnabled) {
		disableMonitoring();
	} else {
		enableMonitoring();
	}
}

/**
 * Start the update interval
 */
function startUpdateInterval(): void {
	if (updateInterval) {
		clearInterval(updateInterval);
	}

	updateInterval = setInterval(updateStats, UPDATE_INTERVAL) as unknown as number;
}

/**
 * Stop the update interval
 */
function stopUpdateInterval(): void {
	if (updateInterval) {
		clearInterval(updateInterval);
		updateInterval = null;
	}
}

/**
 * Get statistics for a specific operation
 */
export function getOperationStats(operation: string): PerformanceStats | null {
	return performanceStats[operation] || null;
}

/**
 * Get average time for an operation
 */
export function getAverageTime(operation: string): number {
	const stats = getOperationStats(operation);
	return stats ? stats.averageDuration : 0;
}

/**
 * Get formatted average time for display
 */
export function getFormattedAverageTime(operation: string): string {
	const avgTime = getAverageTime(operation);
	if (avgTime < 1000) {
		return `${avgTime.toFixed(0)}ms`;
	} else {
		return `${(avgTime / 1000).toFixed(2)}s`;
	}
}

/**
 * Get formatted total duration for an operation
 */
export function getFormattedTotalDuration(operation: string): string {
	const stats = getOperationStats(operation);
	if (!stats) return '0ms';

	if (stats.totalDuration < 1000) {
		return `${stats.totalDuration.toFixed(0)}ms`;
	} else {
		return `${(stats.totalDuration / 1000).toFixed(2)}s`;
	}
}

/**
 * Get performance summary for display
 */
export function getPerformanceSummary() {
	if (!performanceReport) {
		return {
			totalOperations: 0,
			totalDuration: '0ms',
			averageOperationTime: '0ms',
			slowestOperation: 'N/A',
			fastestOperation: 'N/A'
		};
	}

	const { summary } = performanceReport;

	return {
		totalOperations: summary.totalOperations,
		totalDuration:
			summary.totalDuration < 1000
				? `${summary.totalDuration.toFixed(0)}ms`
				: `${(summary.totalDuration / 1000).toFixed(2)}s`,
		averageOperationTime:
			summary.averageOperationTime < 1000
				? `${summary.averageOperationTime.toFixed(0)}ms`
				: `${(summary.averageOperationTime / 1000).toFixed(2)}s`,
		slowestOperation: summary.slowestOperation || 'N/A',
		fastestOperation: summary.fastestOperation || 'N/A'
	};
}

/**
 * Clear all performance metrics
 */
export function clearMetrics(): void {
	performanceMonitor.clear();
	updateStats();
}

/**
 * Clear metrics for a specific operation
 */
export function clearOperationMetrics(operation: string): void {
	performanceMonitor.clearOperation(operation);
	updateStats();
}

/**
 * Get operations sorted by average duration (slowest first)
 */
export function getSlowestOperations(
	limit: number = 10
): Array<{ operation: string; avgTime: number; formattedAvgTime: string }> {
	return Object.values(performanceStats)
		.sort((a, b) => b.averageDuration - a.averageDuration)
		.slice(0, limit)
		.map((stats) => ({
			operation: stats.operation,
			avgTime: stats.averageDuration,
			formattedAvgTime:
				stats.averageDuration < 1000
					? `${stats.averageDuration.toFixed(0)}ms`
					: `${(stats.averageDuration / 1000).toFixed(2)}s`
		}));
}

/**
 * Get operations sorted by frequency (most called first)
 */
export function getMostFrequentOperations(
	limit: number = 10
): Array<{ operation: string; count: number }> {
	return Object.values(performanceStats)
		.sort((a, b) => b.count - a.count)
		.slice(0, limit)
		.map((stats) => ({
			operation: stats.operation,
			count: stats.count
		}));
}

/**
 * Get recent metrics within the last N minutes
 */
export function getRecentMetrics(minutes: number = 5): Record<string, PerformanceStats> {
	const now = Date.now();
	const startTime = now - minutes * 60 * 1000;
	return performanceMonitor.getMetricsInRange(startTime, now);
}

/**
 * Performance monitoring hook for Svelte components
 */
export function usePerformanceMonitoring() {
	// Initialize monitoring if not already enabled
	if (!isMonitoringEnabled) {
		enableMonitoring();
	}

	// Cleanup on component destroy
	onDestroy(() => {
		// Note: We don't disable monitoring here as it might be used by other components
		// The user can manually disable it if needed
	});

	// Create derived reactive values
	const summary = $derived(getPerformanceSummary());
	const slowestOps = $derived(getSlowestOperations());
	const frequentOps = $derived(getMostFrequentOperations());
	const recentMetrics = $derived(getRecentMetrics());

	return {
		get isEnabled() {
			return isMonitoringEnabled;
		},
		get stats() {
			return performanceStats;
		},
		get report() {
			return performanceReport;
		},
		get summary() {
			return summary;
		},
		get slowestOps() {
			return slowestOps;
		},
		get frequentOps() {
			return frequentOps;
		},
		get recentMetrics() {
			return recentMetrics;
		},
		toggle: toggleMonitoring,
		clearAll: clearMetrics,
		clearOperation: clearOperationMetrics,
		getStats: getOperationStats,
		getAverageTime,
		getFormattedAverageTime,
		getFormattedTotalDuration
	};
}

// Auto-start monitoring
enableMonitoring();
