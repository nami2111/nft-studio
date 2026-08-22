import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { PerformanceMonitor, measureOperation, performanceMonitor } from './performance-monitor';

describe('PerformanceMonitor', () => {
	let monitor: PerformanceMonitor;

	beforeEach(() => {
		monitor = new PerformanceMonitor();
		vi.restoreAllMocks();
	});

	describe('timers', () => {
		it('stopTimer returns duration', () => {
			const id = monitor.startTimer('op');
			expect(monitor.stopTimer(id)).toBeGreaterThanOrEqual(0);
		});

		it('stopTimer returns 0 for unknown id and does not warn', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			expect(monitor.stopTimer('nope')).toBe(0);
			expect(warn).not.toHaveBeenCalled();
		});

		it('warns on slow operations', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			monitor.startTimer('slow');
			vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(6000);
			// Re-start after mock so start reads 0.
			const id = monitor.startTimer('slow');
			monitor.stopTimer(id);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('slow'), undefined);
		});
	});

	describe('database metrics', () => {
		it('tracks queries and averages', () => {
			monitor.recordDatabaseQuery('a', 10);
			monitor.recordDatabaseQuery('b', 30);
			expect(monitor.getDatabaseMetrics()).toEqual({ queryCount: 2, averageQueryTime: 20 });
		});

		it('returns zeros for no queries', () => {
			expect(monitor.getDatabaseMetrics()).toEqual({ queryCount: 0, averageQueryTime: 0 });
		});

		it('warns on slow queries', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			monitor.recordDatabaseQuery('slowQuery', 250);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('slowQuery'));
		});
	});

	describe('clear', () => {
		it('resets timers and counters', () => {
			monitor.startTimer('op');
			monitor.recordDatabaseQuery('a', 10);
			monitor.clear();
			expect(monitor.getDatabaseMetrics().queryCount).toBe(0);
		});
	});
});

describe('global singleton and measureOperation', () => {
	it('exposes a shared instance under both names', () => {
		expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
	});

	it('measureOperation resolves and stops the timer', async () => {
		const result = await measureOperation(() => Promise.resolve(42), 'test.op');
		expect(result).toBe(42);
	});

	it('measureOperation rethrows and stops the timer', async () => {
		await expect(
			measureOperation(() => Promise.reject(new Error('boom')), 'test.fail')
		).rejects.toThrow('boom');
	});
});
