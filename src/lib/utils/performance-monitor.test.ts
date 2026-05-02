/**
 * Test suite for PerformanceMonitor utility.
 *
 * @module performance-monitor.test
 */

import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { PerformanceMonitor } from './performance-monitor';

describe('PerformanceMonitor', () => {
	let monitor: PerformanceMonitor;

	beforeEach(() => {
		monitor = new PerformanceMonitor();
	});

	describe('enable/disable', () => {
		it('is enabled by default', () => {
			expect(monitor.isEnabled()).toBe(true);
		});

		it('setEnabled(false) disables monitoring', () => {
			monitor.setEnabled(false);
			expect(monitor.isEnabled()).toBe(false);
		});

		it('does not record metrics when disabled', () => {
			monitor.setEnabled(false);
			const id = monitor.startTimer('test_op');
			const duration = monitor.stopTimer(id);
			expect(duration).toBe(0);
			expect(monitor.getStats('test_op')).toBeNull();
		});

		it('clears metrics when disabled', () => {
			monitor.recordMetric('op', 100);
			expect(monitor.getStats('op')).not.toBeNull();
			monitor.setEnabled(false);
			expect(monitor.getStats('op')).toBeNull();
		});
	});

	describe('timers', () => {
		it('startTimer and stopTimer record duration', () => {
			const id = monitor.startTimer('render');
			const duration = monitor.stopTimer(id);

			expect(typeof duration).toBe('number');
			expect(duration).toBeGreaterThanOrEqual(0);
		});

		it('stopTimer returns duration', () => {
			const id = monitor.startTimer('paint');
			const dur = monitor.stopTimer(id);
			expect(dur).toBeGreaterThanOrEqual(0);
		});

		it('stopTimer returns 0 for unknown id', () => {
			const dur = monitor.stopTimer('nonexistent');
			expect(dur).toBe(0);
		});

		it('startTimer with custom id stores metric under the custom id', () => {
			const id = monitor.startTimer('op', 'my-custom-id');
			monitor.stopTimer(id);
			// Custom ID without underscore becomes the operation name itself
			expect(monitor.getStats('my-custom-id')).not.toBeNull();
		});
	});

	describe('recordMetric', () => {
		it('records a metric with metadata', () => {
			monitor.recordMetric('parse', 42, { file: 'test.json' });

			const stats = monitor.getStats('parse');
			expect(stats).not.toBeNull();
			expect(stats!.count).toBe(1);
			expect(stats!.averageDuration).toBe(42);
			expect(stats!.maxDuration).toBe(42);
			expect(stats!.minDuration).toBe(42);
			expect(stats!.metrics[0].metadata).toEqual({ file: 'test.json' });
		});

		it('aggregates multiple records', () => {
			monitor.recordMetric('load', 10);
			monitor.recordMetric('load', 20);
			monitor.recordMetric('load', 30);

			const stats = monitor.getStats('load');
			expect(stats).not.toBeNull();
			expect(stats!.count).toBe(3);
			expect(stats!.totalDuration).toBe(60);
			expect(stats!.averageDuration).toBe(20);
			expect(stats!.minDuration).toBe(10);
			expect(stats!.maxDuration).toBe(30);
			expect(stats!.lastDuration).toBe(30);
		});
	});

	describe('getStats / getAllStats', () => {
		it('getStats returns null for unknown operation', () => {
			expect(monitor.getStats('unknown')).toBeNull();
		});

		it('getAllStats returns all operations', () => {
			monitor.recordMetric('a', 10);
			monitor.recordMetric('b', 20);

			const all = monitor.getAllStats();
			expect(Object.keys(all)).toHaveLength(2);
			expect(all.a.count).toBe(1);
			expect(all.b.count).toBe(1);
		});
	});

	describe('getAverageTime / getLastDuration', () => {
		it('getAverageTime returns 0 for unknown operation', () => {
			expect(monitor.getAverageTime('none')).toBe(0);
		});

		it('getAverageTime computes correctly', () => {
			monitor.recordMetric('query', 100);
			monitor.recordMetric('query', 200);
			expect(monitor.getAverageTime('query')).toBe(150);
		});

		it('getLastDuration returns last metric', () => {
			monitor.recordMetric('task', 50);
			monitor.recordMetric('task', 75);
			expect(monitor.getLastDuration('task')).toBe(75);
		});

		it('getLastDuration returns 0 for unknown', () => {
			expect(monitor.getLastDuration('none')).toBe(0);
		});
	});

	describe('generateReport', () => {
		it('returns empty report for no metrics', () => {
			const report = monitor.generateReport();
			expect(report.summary.totalOperations).toBe(0);
			expect(report.summary.averageOperationTime).toBe(0);
		});

		it('identifies slowest and fastest operations', () => {
			monitor.recordMetric('fast', 5);
			monitor.recordMetric('slow', 100);
			monitor.recordMetric('slow', 200);

			const report = monitor.generateReport();
			expect(report.summary.totalOperations).toBe(3);
			expect(report.summary.slowestOperation).toBe('slow');
			expect(report.summary.fastestOperation).toBe('fast');
		});
	});

	describe('clear / clearOperation', () => {
		it('clear removes all metrics', () => {
			monitor.recordMetric('a', 10);
			monitor.recordMetric('b', 20);
			monitor.clear();
			expect(monitor.getAllStats()).toEqual({});
		});

		it('clearOperation removes specific operation', () => {
			monitor.recordMetric('keep', 10);
			monitor.recordMetric('drop', 20);
			monitor.clearOperation('drop');
			expect(monitor.getStats('drop')).toBeNull();
			expect(monitor.getStats('keep')).not.toBeNull();
		});
	});

	describe('getMetricsInRange', () => {
		it('filters by time range', () => {
			// Record with known timestamps via direct metric creation
			const now = Date.now();
			// Use recordMetric which stamps Date.now() internally
			monitor.recordMetric('op', 10);
			monitor.recordMetric('op', 20);

			// Range includes all
			const all = monitor.getMetricsInRange(0, now + 1000);
			expect(all.op.count).toBe(2);

			// Range excludes all (future range)
			const none = monitor.getMetricsInRange(now + 10000, now + 20000);
			expect(Object.keys(none)).toHaveLength(0);
		});
	});

	describe('cache metrics', () => {
		it('tracks cache hits and misses', () => {
			monitor.recordCacheHit('images');
			monitor.recordCacheHit('images');
			monitor.recordCacheMiss('images');

			const rate = monitor.getCacheHitRate('images');
			expect(rate).toBeCloseTo(66.67, 1);
		});

		it('getCacheHitRate returns 0 for unknown cache', () => {
			expect(monitor.getCacheHitRate('unknown')).toBe(0);
		});

		it('getCacheHitRate returns 0 when no hits/misses', () => {
			monitor.recordCacheEviction('cache', 100);
			expect(monitor.getCacheHitRate('cache')).toBe(0);
		});

		it('records evictions with memory tracking', () => {
			monitor.updateCacheMemoryUsage('cache', 500);
			monitor.recordCacheEviction('cache', 100);
			// Memory should decrease
			const rate = monitor.getCacheHitRate('cache');
			expect(rate).toBe(0);
		});

		it('updateCacheMemoryUsage sets memory', () => {
			monitor.updateCacheMemoryUsage('gpu', 256);
			// Verify no error — internal state only
		});
	});

	describe('database metrics', () => {
		it('tracks queries and averages', () => {
			monitor.recordDatabaseQuery('SELECT', 50);
			monitor.recordDatabaseQuery('INSERT', 150);

			const db = monitor.getDatabaseMetrics();
			expect(db.queryCount).toBe(2);
			expect(db.averageQueryTime).toBe(100);
		});

		it('returns zeros for no queries', () => {
			const db = monitor.getDatabaseMetrics();
			expect(db.queryCount).toBe(0);
			expect(db.averageQueryTime).toBe(0);
		});
	});

	describe('alerts', () => {
		it('creates and retrieves alerts', () => {
			monitor.createAlert({
				metric: 'memory',
				value: 500,
				threshold: 400,
				severity: 'high',
				message: 'Memory exceeded threshold'
			});

			const alerts = monitor.getAlerts();
			expect(alerts).toHaveLength(1);
			expect(alerts[0].metric).toBe('memory');
			expect(alerts[0].severity).toBe('high');
		});

		it('getAlerts with time window filters recent', () => {
			monitor.createAlert({
				metric: 'cpu',
				value: 90,
				threshold: 80,
				severity: 'critical',
				message: 'CPU spike'
			});

			const recent = monitor.getAlerts(1); // last minute
			expect(recent).toHaveLength(1);
		});
	});

	describe('batch tracking', () => {
		it('tracks batch progress', () => {
			monitor.startBatch(100);
			monitor.recordBatchItem(10);
			monitor.recordBatchItem(15);
			monitor.finishBatch();

			// No errors — batch tracking is log-only for now
		});
	});

	describe('resetAllMetrics', () => {
		it('clears all tracking state', () => {
			monitor.recordCacheHit('c1');
			monitor.recordDatabaseQuery('q', 10);
			monitor.captureMemoryMetrics();
			monitor.createAlert({
				metric: 'm',
				value: 1,
				threshold: 2,
				severity: 'low',
				message: 'test'
			});

			monitor.resetAllMetrics();

			expect(monitor.getCacheHitRate('c1')).toBe(0);
			expect(monitor.getDatabaseMetrics().queryCount).toBe(0);
		});
	});

	describe('logSummary', () => {
		it('does not throw when enabled', () => {
			monitor.recordMetric('op', 100);
			expect(() => monitor.logSummary()).not.toThrow();
		});

		it('does not throw when disabled', () => {
			monitor.setEnabled(false);
			expect(() => monitor.logSummary()).not.toThrow();
		});
	});
});
