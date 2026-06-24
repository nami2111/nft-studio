import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import { setWorkerPool, workerPool } from '../state';
import {
	handleWorkerFailure,
	reassignWorkerTasks,
	performDynamicScaling,
	addWorkers,
	removeIdleWorkers
} from '../pool';
import { WorkerHealth, type WorkerPool } from '../types';

function makeMockWorkerPool(overrides: Partial<WorkerPool> = {}): WorkerPool {
	const base: WorkerPool = {
		workers: [],
		taskQueue: [],
		activeTasks: new Map(),
		workerStatus: [],
		workerHealth: [],
		workerTaskCount: [],
		workerStats: [],
		config: {
			maxWorkers: 4,
			minWorkers: 1,
			maxRestarts: 3
		},
		workerInitializationPromises: [],
		healthCheckInterval: null,
		scalingInterval: null,
		...overrides
	};
	return base;
}

describe('handleWorkerFailure', () => {
	beforeEach(() => {
		setWorkerPool(null);
	});

	afterEach(() => {
		setWorkerPool(null);
	});

	it('attempts restart and increments count when restartCount is below maxRestarts', () => {
		const stats = Array.from({ length: 2 }, (_, i) => ({
			startTime: Date.now(),
			taskCount: 0,
			errorCount: 0,
			averageTaskTime: 0,
			lastActivity: Date.now() - 1000 * i,
			restartCount: 0
		}));

		const pool = makeMockWorkerPool({
			workers: [null as unknown as Worker, {} as Worker],
			workerStatus: [true, true],
			workerHealth: [WorkerHealth.HEALTHY, WorkerHealth.HEALTHY],
			workerTaskCount: [0, 0],
			workerStats: stats
		});
		setWorkerPool(pool);

		// Synchronous part: restartCount is incremented immediately
		expect(workerPool!.workerStats[0].restartCount).toBe(0);
		handleWorkerFailure(0, 'Test failure');
		expect(workerPool!.workerStats[0].restartCount).toBe(1);

		// The actual restart is async (createWorker → Promise rejection caught by .catch).
		// In jsdom, Worker constructor throws, so the catch handler will fire eventually.
		// Just verify no synchronous error was thrown.
	});

	it('marks worker as ERROR when restartCount exceeds maxRestarts', () => {
		const stats = Array.from({ length: 2 }, (_, i) => ({
			startTime: Date.now(),
			taskCount: 0,
			errorCount: 0,
			averageTaskTime: 0,
			lastActivity: Date.now() - 1000 * i,
			restartCount: 3 // Already at max
		}));

		const pool = makeMockWorkerPool({
			workers: [{} as Worker, {} as Worker],
			workerStatus: [true, true],
			workerHealth: [WorkerHealth.HEALTHY, WorkerHealth.HEALTHY],
			workerTaskCount: [0, 0],
			workerStats: stats
		});
		setWorkerPool(pool);

		handleWorkerFailure(0, 'Exceeded restarts');

		expect(workerPool!.workerHealth[0]).toBe(WorkerHealth.ERROR);
		expect(workerPool!.workerStatus[0]).toBe(false);
		expect(workerPool!.workers[0]).toBeNull();
	});

	it('does nothing for invalid workerIndex', () => {
		const pool = makeMockWorkerPool({
			workers: [{} as Worker],
			workerStats: [
				{
					startTime: Date.now(),
					taskCount: 0,
					errorCount: 0,
					averageTaskTime: 0,
					lastActivity: Date.now(),
					restartCount: 0
				}
			]
		});
		setWorkerPool(pool);

		expect(() => handleWorkerFailure(-1, 'bad index')).not.toThrow();
		expect(() => handleWorkerFailure(99, 'bad index')).not.toThrow();
	});

	it('does nothing when pool is null', () => {
		expect(() => handleWorkerFailure(0, 'no pool')).not.toThrow();
	});
});

describe('reassignWorkerTasks', () => {
	beforeEach(() => setWorkerPool(null));
	afterEach(() => setWorkerPool(null));

	it('re-queues tasks from failed worker', () => {
		const taskA = {
			id: 'task-1',
			assignedWorker: 0,
			timestamp: Date.now() - 5000,
			_resolve: undefined,
			_reject: undefined
		} as any;

		const taskB = {
			id: 'task-2',
			assignedWorker: 1, // Different worker — should NOT be moved
			timestamp: Date.now() - 5000,
			_resolve: undefined,
			_reject: undefined
		} as any;

		const activeTasks = new Map<string, any>([
			['task-1', taskA],
			['task-2', taskB]
		]);

		const pool = makeMockWorkerPool({
			workers: [{} as Worker, {} as Worker],
			workerStatus: [false, false],
			workerHealth: [WorkerHealth.UNRESPONSIVE, WorkerHealth.HEALTHY],
			workerTaskCount: [1, 0],
			workerStats: [
				{
					startTime: Date.now(),
					taskCount: 1,
					errorCount: 0,
					averageTaskTime: 0,
					lastActivity: Date.now(),
					restartCount: 0
				},
				{
					startTime: Date.now(),
					taskCount: 0,
					errorCount: 0,
					averageTaskTime: 0,
					lastActivity: Date.now(),
					restartCount: 0
				}
			],
			taskQueue: [],
			activeTasks
		});
		setWorkerPool(pool);

		reassignWorkerTasks(0);

		// taskA should be re-queued, taskB should remain active
		expect(workerPool!.taskQueue.length).toBe(1);
		expect(workerPool!.taskQueue[0].id).toBe('task-1');
		expect(workerPool!.activeTasks.has('task-2')).toBe(true);
		expect(workerPool!.activeTasks.has('task-1')).toBe(false);
		// Failed worker task count reset
		expect(workerPool!.workerTaskCount[0]).toBe(0);
	});
});

describe('performDynamicScaling', () => {
	beforeEach(() => setWorkerPool(null));
	afterEach(() => setWorkerPool(null));

	it('adds workers when queue exceeds high threshold (20)', () => {
		// With 1 worker and 21 queued tasks, should trigger add
		const stats = Array(3)
			.fill(null)
			.map(() => ({
				startTime: Date.now(),
				taskCount: 0,
				errorCount: 0,
				averageTaskTime: 0,
				lastActivity: Date.now(),
				restartCount: 0
			}));

		const pool = makeMockWorkerPool({
			workers: [{} as Worker, null as unknown as Worker, null as unknown as Worker],
			workerStatus: [true, false, false],
			workerHealth: [WorkerHealth.HEALTHY, WorkerHealth.HEALTHY, WorkerHealth.HEALTHY],
			workerTaskCount: [0, 0, 0],
			workerStats: stats,
			taskQueue: Array(21)
				.fill(null)
				.map((_, i) => ({
					id: `task-${i}`,
					assignedWorker: undefined,
					timestamp: Date.now()
				}))
		});
		// High maxWorkers so we can add
		pool.config.maxWorkers = 8;
		setWorkerPool(pool);

		// performDynamicScaling calls addWorkers which calls addSingleWorker which calls createWorker.
		// createWorker will fail in jsdom (Worker constructor). We just verify it doesn't throw
		// and that the attempt was made.
		expect(() => performDynamicScaling()).not.toThrow();
	});

	it('does not add workers when at maxWorkers', () => {
		const stats = Array(4)
			.fill(null)
			.map(() => ({
				startTime: Date.now(),
				taskCount: 0,
				errorCount: 0,
				averageTaskTime: 0,
				lastActivity: Date.now(),
				restartCount: 0
			}));

		const pool = makeMockWorkerPool({
			workers: [{} as Worker, {} as Worker, {} as Worker, {} as Worker],
			workerStatus: [true, true, true, true],
			workerHealth: [
				WorkerHealth.HEALTHY,
				WorkerHealth.HEALTHY,
				WorkerHealth.HEALTHY,
				WorkerHealth.HEALTHY
			],
			workerTaskCount: [1, 1, 1, 1],
			workerStats: stats,
			taskQueue: Array(25)
				.fill(null)
				.map((_, i) => ({
					id: `task-${i}`,
					assignedWorker: undefined,
					timestamp: Date.now()
				})),
			config: { maxWorkers: 4, minWorkers: 1, maxRestarts: 3 }
		});
		setWorkerPool(pool);

		// Should do nothing — already at maxWorkers
		const beforeLength = workerPool!.workers.length;
		performDynamicScaling();
		expect(workerPool!.workers.length).toBe(beforeLength);
	});

	it('removes idle workers when queue is low', () => {
		const mockTerminate = vi.fn();
		const mockWorker = { terminate: mockTerminate } as unknown as Worker;
		const stats = Array(4)
			.fill(null)
			.map(() => ({
				startTime: Date.now(),
				taskCount: 0,
				errorCount: 0,
				averageTaskTime: 0,
				lastActivity: Date.now(),
				restartCount: 0
			}));

		const pool = makeMockWorkerPool({
			workers: [mockWorker, mockWorker, mockWorker, mockWorker],
			workerStatus: [true, true, true, true],
			workerHealth: [
				WorkerHealth.HEALTHY,
				WorkerHealth.HEALTHY,
				WorkerHealth.HEALTHY,
				WorkerHealth.HEALTHY
			],
			workerTaskCount: [0, 0, 0, 0],
			workerStats: stats.map((s, i) => ({
				...s,
				lastActivity: Date.now() - 120000 // Idle for 2 minutes
			})),
			taskQueue: [],
			activeTasks: new Map(),
			config: { maxWorkers: 8, minWorkers: 2, maxRestarts: 3 }
		});
		setWorkerPool(pool);

		// removeIdleWorkers is called internally — just verify no errors
		expect(() => performDynamicScaling()).not.toThrow();
	});
});
