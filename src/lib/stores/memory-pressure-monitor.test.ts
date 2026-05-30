import { describe, expect, it, vi } from 'vite-plus/test';
import { MemoryPressureMonitor } from './memory-pressure-monitor';

describe('MemoryPressureMonitor', () => {
	it('triggers aggressive cleanup when usage exceeds 100MB', () => {
		const onCleanup = vi.fn();
		const monitor = new MemoryPressureMonitor({
			getCurrentUsageBytes: () => 150 * 1024 * 1024,
			onCleanup
		});

		monitor.checkNow();
		expect(onCleanup).toHaveBeenCalledWith('aggressive');
	});

	it('triggers moderate cleanup when usage between 50MB and 100MB', () => {
		const onCleanup = vi.fn();
		const monitor = new MemoryPressureMonitor({
			getCurrentUsageBytes: () => 75 * 1024 * 1024,
			onCleanup
		});

		monitor.checkNow();
		expect(onCleanup).toHaveBeenCalledWith('moderate');
	});

	it('does not trigger cleanup when usage below moderate threshold', () => {
		const onCleanup = vi.fn();
		const monitor = new MemoryPressureMonitor({
			getCurrentUsageBytes: () => 10 * 1024 * 1024,
			onCleanup
		});

		monitor.checkNow();
		expect(onCleanup).not.toHaveBeenCalled();
	});

	it('start is idempotent', () => {
		const monitor = new MemoryPressureMonitor({
			getCurrentUsageBytes: () => 0,
			onCleanup: () => {}
		});

		monitor.start();
		monitor.start();
		monitor.stop();
	});

	it('stop is safe before start', () => {
		const monitor = new MemoryPressureMonitor({
			getCurrentUsageBytes: () => 0,
			onCleanup: () => {}
		});

		expect(() => monitor.stop()).not.toThrow();
	});
});
