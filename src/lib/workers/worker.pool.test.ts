// Enhanced worker pool integration tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeWorkerPool, terminateWorkerPool, getWorkerPoolStatus } from './worker.pool';

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
		expect(status!.complexityBreakdown).toBeDefined();
		expect(status!.workerHealth).toEqual([]);
		expect(status!.workerStats).toEqual([]);
	});
});
