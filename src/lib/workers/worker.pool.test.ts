// Enhanced worker pool integration tests
import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import { initializeWorkerPool, terminateWorkerPool, getWorkerPoolStatus } from './pool';

describe('Enhanced Worker Pool Integration', () => {
	beforeEach(() => {
		// Reset worker pool
		terminateWorkerPool();
	});

	afterEach(() => {
		terminateWorkerPool();
	});

	it('should handle configuration options', async () => {
		// Test with minimal config to avoid worker creation issues
		await initializeWorkerPool({
			maxWorkers: 0,
			minWorkers: 0,
			healthCheckInterval: 10000, // Long interval for testing
			maxRestarts: 1
		});

		const status = getWorkerPoolStatus();
		expect(status).not.toBeNull();
		// Since config.maxWorkers=0 is forced to baseWorkers, we expect workers to be present
		expect(status!.workerHealth.length).toBeGreaterThan(0);
		expect(status!.workerStats.length).toBeGreaterThan(0);
	});
});
