import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test';
import { postMessageToPool } from '../pool';
import { setWorkerPool } from '../state';
import { WorkerHealth } from '../types';

describe('postMessageToPool', () => {
	beforeEach(() => {
		setWorkerPool(null);
	});

	afterEach(() => {
		setWorkerPool(null);
	});

	it('throws when pool is not initialized', () => {
		// postMessageToPool throws synchronously when pool is not initialized
		expect(() => postMessageToPool({ type: 'start', payload: {} as any })).toThrow(
			'Worker pool not initialized'
		);
	});

	it('processes tasks when pool has available workers', async () => {
		const worker = { postMessage: vi.fn() } as unknown as Worker;

		const pool = {
			workers: [worker],
			taskQueue: [] as any[],
			activeTasks: new Map(),
			workerStatus: [true],
			workerHealth: [WorkerHealth.HEALTHY],
			workerTaskCount: [0],
			workerStats: [
				{
					startTime: Date.now(),
					taskCount: 0,
					errorCount: 0,
					averageTaskTime: 0,
					lastActivity: Date.now(),
					restartCount: 0
				}
			],
			config: { maxWorkers: 4, minWorkers: 1, maxRestarts: 3 },
			workerInitializationPromises: [],
			healthCheckInterval: null,
			scalingInterval: null
		};

		setWorkerPool(pool as any);

		postMessageToPool({ type: 'ping', pingId: 'test-1' }).catch(() => {});

		// Task should be processed immediately via processNextTask
		expect(worker.postMessage).toHaveBeenCalled();
		// Queue should be empty since task was already taken
		expect(pool.taskQueue.length).toBe(0);
	});

	it('processes messages with payload', async () => {
		const worker = { postMessage: vi.fn() } as unknown as Worker;

		const pool = {
			workers: [worker],
			taskQueue: [] as any[],
			activeTasks: new Map(),
			workerStatus: [true],
			workerHealth: [WorkerHealth.HEALTHY],
			workerTaskCount: [0],
			workerStats: [
				{
					startTime: Date.now(),
					taskCount: 0,
					errorCount: 0,
					averageTaskTime: 0,
					lastActivity: Date.now(),
					restartCount: 0
				}
			],
			config: { maxWorkers: 4, minWorkers: 1, maxRestarts: 3 },
			workerInitializationPromises: [],
			healthCheckInterval: null,
			scalingInterval: null
		};

		setWorkerPool(pool as any);

		postMessageToPool({ type: 'init-layers', payload: { layers: [] } }).catch(() => {});

		expect(worker.postMessage).toHaveBeenCalled();
	});
});
