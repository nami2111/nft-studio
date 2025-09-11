// src/lib/workers/worker.pool.ts

import type { GenerationWorkerMessage } from './generation.worker.loader';

// Worker pool configuration
interface WorkerPoolConfig {
	maxWorkers?: number;
	maxConcurrentTasks?: number;
}

// Task interface
interface WorkerTask<T = unknown> {
	id: string;
	message: GenerationWorkerMessage;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
	assignedWorker?: number; // Track which worker is handling this task
}

// Worker pool interface
interface WorkerPool {
	workers: Worker[];
	taskQueue: WorkerTask[];
	activeTasks: Map<string, WorkerTask>;
	workerStatus: boolean[]; // true = available, false = busy
	config: WorkerPoolConfig;
}

// Global worker pool instance
let workerPool: WorkerPool | null = null;

// Callback for forwarding messages to clients
let messageCallback: ((data: unknown) => void) | null = null;

// Set message callback for client components to receive worker messages
export function setMessageCallback(callback: (data: unknown) => void): void {
	messageCallback = callback;
}

/**
 * Get device capabilities to determine optimal worker count
 */
function getDeviceCapabilities() {
	const coreCount = navigator.hardwareConcurrency || 4;
	let memoryGB = 8;
	if ('deviceMemory' in navigator) {
		// @ts-expect-error - deviceMemory not in all browsers
		memoryGB = navigator.deviceMemory || 8;
	}
	const isMobile = /Mobi|Android/i.test(navigator.userAgent);
	return { coreCount, memoryGB, isMobile };
}

/**
 * Calculate optimal worker count based on device capabilities
 */
function calculateOptimalWorkerCount(): number {
	const { coreCount, memoryGB, isMobile } = getDeviceCapabilities();

	// Base calculation considering memory and cores
	let workerCount = Math.min(
		Math.floor(coreCount * 0.75), // Use 75% of cores to avoid overloading
		Math.floor((memoryGB * 1024) / 128) // ~128MB per worker rough estimate
	);

	// Adjust for mobile devices
	if (isMobile) {
		workerCount = Math.max(1, Math.floor(workerCount * 0.5)); // Reduce by half for mobile
	}

	// Ensure reasonable bounds
	workerCount = Math.max(1, Math.min(workerCount, 4)); // Between 1 and 4 workers

	return workerCount;
}

/**
 * Create a new generation worker
 */
function createWorker(): Worker {
	return new Worker(new URL('./generation.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Initialize the worker pool
 */
export function initializeWorkerPool(config?: WorkerPoolConfig): void {
	if (workerPool) {
		console.warn('Worker pool already initialized');
		return;
	}

	const optimalWorkerCount = calculateOptimalWorkerCount();
	const maxWorkers = config?.maxWorkers || optimalWorkerCount;

	workerPool = {
		workers: [],
		taskQueue: [],
		activeTasks: new Map(),
		workerStatus: [],
		config: {
			maxWorkers,
			maxConcurrentTasks: config?.maxConcurrentTasks || maxWorkers
		}
	};

	// Create the workers
	for (let i = 0; i < maxWorkers; i++) {
		const worker = createWorker();
		workerPool.workers.push(worker);
		workerPool.workerStatus.push(true); // Mark as available

		// Set up message handler for each worker
		worker.onmessage = (e: MessageEvent) => {
			handleWorkerMessage(e, i);
		};
	}

	console.log(`Worker pool initialized with ${maxWorkers} workers`);
}

/**
 * Handle messages from workers
 */
function handleWorkerMessage(event: MessageEvent, workerIndex: number): void {
	if (!workerPool) return;

	const data = event.data;
	const { type } = data;

	// Forward all messages to client components
	if (messageCallback) {
		messageCallback(data);
	}

	// For terminal messages, resolve/reject promises and clean up
	if (type === 'complete' || type === 'error' || type === 'cancelled') {
		// Find and resolve/reject the corresponding task
		let foundTask = false;
		for (const [taskId, task] of workerPool.activeTasks.entries()) {
			if (task.assignedWorker === workerIndex) {
				if (type === 'complete') {
					task.resolve(data);
				} else if (type === 'error') {
					task.reject(new Error(data.payload?.message || 'Worker error'));
				} else if (type === 'cancelled') {
					task.reject(new Error('Generation cancelled'));
				}

				// Remove the task from active tasks
				workerPool.activeTasks.delete(taskId);
				foundTask = true;
				break;
			}
		}

		// If we couldn't find the task, it might be a chunked message
		// Just mark worker as available and continue
		if (!foundTask) {
			if (workerPool) {
				workerPool.workerStatus[workerIndex] = true;
			}
			processNextTask();
			return;
		}

		// Mark worker as available when task completes
		if (workerPool) {
			workerPool.workerStatus[workerIndex] = true;
		}

		// Process next task if available
		processNextTask();
	}
}

/**
 * Get an available worker index, or null if none available
 */
function getAvailableWorker(): number | null {
	if (!workerPool) return null;

	for (let i = 0; i < workerPool.workerStatus.length; i++) {
		if (workerPool.workerStatus[i]) {
			return i;
		}
	}
	return null;
}

/**
 * Process the next task in the queue
 */
function processNextTask(): void {
	if (!workerPool || workerPool.taskQueue.length === 0) return;

	const workerIndex = getAvailableWorker();
	if (workerIndex === null) return; // No workers available

	const task = workerPool.taskQueue.shift();
	if (!task) return;

	// Assign task to worker
	task.assignedWorker = workerIndex;
	workerPool.activeTasks.set(task.id, task);
	workerPool.workerStatus[workerIndex] = false; // Mark as busy

	// Post message to worker
	workerPool.workers[workerIndex].postMessage(task.message);

	console.log(`Task ${task.id} assigned to worker ${workerIndex}`);
}

/**
 * Post a message to the worker pool
 */
export function postMessageToPool<T>(message: GenerationWorkerMessage): Promise<T> {
	if (!workerPool) {
		throw new Error('Worker pool not initialized. Call initializeWorkerPool() first.');
	}

	return new Promise<T>((resolve, reject) => {
		const taskId = `${Date.now()}-${Math.random()}`;
		const task: WorkerTask<T> = { id: taskId, message, resolve, reject };

		// Add to queue
		if (workerPool) {
			workerPool.taskQueue.push(task as WorkerTask);
		}

		// Process immediately if possible
		processNextTask();
	});
}

/**
 * Terminate all workers in the pool
 */
export function terminateWorkerPool(): void {
	if (!workerPool) return;

	// Terminate all workers
	for (const worker of workerPool.workers) {
		worker.terminate();
	}

	// Clear all pending tasks
	for (const task of workerPool.taskQueue) {
		task.reject(new Error('Worker pool terminated'));
	}

	// Clear active tasks
	for (const task of workerPool.activeTasks.values()) {
		task.reject(new Error('Worker pool terminated'));
	}

	// Clear the pool
	workerPool = null;

	console.log('Worker pool terminated');
}

/**
 * Get current pool status
 */
export function getWorkerPoolStatus(): {
	totalWorkers: number;
	availableWorkers: number;
	queuedTasks: number;
	activeTasks: number;
} | null {
	if (!workerPool) return null;

	const availableWorkers = workerPool.workerStatus.filter((status) => status).length;

	return {
		totalWorkers: workerPool.workers.length,
		availableWorkers,
		queuedTasks: workerPool.taskQueue.length,
		activeTasks: workerPool.activeTasks.size
	};
}
