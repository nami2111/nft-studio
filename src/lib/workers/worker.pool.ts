// src/lib/workers/worker.pool.ts

import type {
	GenerationWorkerMessage,
	CompleteMessage,
	ErrorMessage,
	CancelledMessage,
	OutgoingWorkerMessage,
	ProgressMessage
} from '$lib/types/worker-messages';

// Worker pool configuration
interface WorkerPoolConfig {
	maxWorkers?: number;
	maxConcurrentTasks?: number;
	workerInitializationTimeout?: number; // Timeout for worker initialization
}

// Task interface
interface WorkerTask<T = unknown> {
	id: string;
	message: GenerationWorkerMessage;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
	assignedWorker?: number; // Track which worker is handling this task
	timestamp: number; // Track when task was queued
	// Store resolve/reject separately to avoid cloning issues
	_resolve?: (value: T) => void;
	_reject?: (reason?: unknown) => void;
}

// Worker pool interface
interface WorkerPool {
	workers: Worker[];
	taskQueue: WorkerTask[];
	activeTasks: Map<string, WorkerTask>;
	workerStatus: boolean[]; // true = available, false = busy
	config: WorkerPoolConfig;
	workerInitializationPromises: Promise<void>[]; // Track worker initialization
}

// Global worker pool instance
let workerPool: WorkerPool | null = null;

// Callback for forwarding messages to clients
let messageCallback:
	| ((data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage) => void)
	| null = null;

// Set message callback for client components to receive worker messages
export function setMessageCallback(
	callback: (data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage) => void
): void {
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
 * Create a new generation worker with error handling and timeout
 */
async function createWorker(timeoutMs: number = 5000): Promise<Worker> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./generation.worker.ts', import.meta.url), {
			type: 'module'
		});

		// Set up timeout for worker initialization
		const timeoutId = setTimeout(() => {
			worker.terminate();
			reject(new Error('Worker initialization timeout'));
		}, timeoutMs);

		// Handle worker errors
		worker.onerror = (error) => {
			clearTimeout(timeoutId);
			reject(new Error(`Worker error: ${error.message}`));
		};

		// Worker is ready when it sends a "ready" message
		worker.onmessage = (e: MessageEvent) => {
			if (e.data?.type === 'ready') {
				clearTimeout(timeoutId);
				worker.onmessage = null; // Reset to avoid conflict with normal message handling
				resolve(worker);
			}
		};

		// Send initialization message to worker
		worker.postMessage({ type: 'initialize' });
	});
}

/**
 * Handle messages from workers
 */
function handleWorkerMessage(event: MessageEvent, workerIndex: number): void {
	if (!workerPool) return;

	const data = event.data as OutgoingWorkerMessage;
	const { type } = data;

	// Handle "ready" messages separately - these are initialization messages
	if (type === 'ready') {
		// Worker is ready, no need to forward to client
		return;
	}

	// Forward all other messages to client components
	if (messageCallback) {
		messageCallback(data as CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage);
	}

	// For terminal messages, resolve/reject promises and clean up
	if (type === 'complete' || type === 'error' || type === 'cancelled') {
		// Find and resolve/reject the corresponding task using taskId from message
		const messageTaskId = (data as OutgoingWorkerMessage & { taskId?: string }).taskId;
		let foundTask = false;

		if (messageTaskId) {
			// Try to find task by taskId first
			const task = workerPool.activeTasks.get(messageTaskId);
			if (task) {
				if (type === 'complete') {
					if (task._resolve) task._resolve(data);
				} else if (type === 'error') {
					if (task._reject)
						task._reject(new Error((data as ErrorMessage).payload?.message || 'Worker error'));
				} else if (type === 'cancelled') {
					if (task._reject) task._reject(new Error('Generation cancelled'));
				}
				workerPool.activeTasks.delete(messageTaskId);
				foundTask = true;
			}
		}

		// Fallback: find by worker index if taskId matching failed
		if (!foundTask) {
			for (const [taskId, task] of workerPool.activeTasks.entries()) {
				if (task.assignedWorker === workerIndex) {
					if (type === 'complete') {
						if (task._resolve) task._resolve(data);
					} else if (type === 'error') {
						if (task._reject)
							task._reject(new Error((data as ErrorMessage).payload?.message || 'Worker error'));
					} else if (type === 'cancelled') {
						if (task._reject) task._reject(new Error('Generation cancelled'));
					}

					// Remove the task from active tasks
					workerPool.activeTasks.delete(taskId);
					foundTask = true;
					break;
				}
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
		// Check if worker exists and is available
		if (workerPool.workers[i] && workerPool.workerStatus[i]) {
			return i;
		}
	}
	return null;
}

/**
 * Process the next task in the queue
 */
function processNextTask(): void {
	if (!workerPool || workerPool.taskQueue.length === 0) {
		return;
	}

	const workerIndex = getAvailableWorker();
	if (workerIndex === null) {
		return; // No workers available
	}

	const task = workerPool.taskQueue.shift();
	if (!task) return;

	// Assign task to worker
	task.assignedWorker = workerIndex;
	workerPool.activeTasks.set(task.id, task);
	workerPool.workerStatus[workerIndex] = false; // Mark as busy

	// Post message to worker (only send the message, not the task with functions)
	try {
		// Create a clean message object without any potential non-cloneable data
		const baseMessage = {
			type: task.message.type,
			taskId: task.id // Include task ID for tracking
		};

		// Only include payload if it exists (not all message types have payload)
		const messageToSend =
			'payload' in task.message ? { ...baseMessage, payload: task.message.payload } : baseMessage;

		workerPool.workers[workerIndex].postMessage(messageToSend);
		console.log(`Task ${task.id} assigned to worker ${workerIndex}`);
	} catch (error) {
		console.error(`Failed to post message to worker ${workerIndex}:`, error);
		// Mark worker as available and reject task
		workerPool.workerStatus[workerIndex] = true;
		if (task._reject) {
			task._reject(new Error('Failed to send task to worker'));
		}
		workerPool.activeTasks.delete(task.id);
		// Process next task
		processNextTask();
	}
}

/**
 * Initialize the worker pool with better error handling
 */
export async function initializeWorkerPool(config?: WorkerPoolConfig): Promise<void> {
	if (workerPool) {
		console.warn('Worker pool already initialized');
		return;
	}

	const optimalWorkerCount = calculateOptimalWorkerCount();
	const maxWorkers = config?.maxWorkers || optimalWorkerCount;
	const workerInitializationTimeout = config?.workerInitializationTimeout || 5000;

	workerPool = {
		workers: [],
		taskQueue: [],
		activeTasks: new Map(),
		workerStatus: [],
		config: {
			maxWorkers,
			maxConcurrentTasks: config?.maxConcurrentTasks || maxWorkers,
			workerInitializationTimeout
		},
		workerInitializationPromises: []
	};

	// Create the workers with proper error handling
	const workerPromises: Promise<Worker>[] = [];
	for (let i = 0; i < maxWorkers; i++) {
		const workerPromise = createWorker(workerInitializationTimeout);
		workerPromises.push(workerPromise);

		workerPromise
			.then((worker) => {
				workerPool!.workers.push(worker);
				workerPool!.workerStatus.push(true); // Mark as available

				// Set up message handler for each worker
				worker.onmessage = (e: MessageEvent) => {
					handleWorkerMessage(e, workerPool!.workers.length - 1);
				};

				console.log(`Worker ${workerPool!.workers.length - 1} initialized successfully`);

				// Process any queued tasks now that we have an available worker
				processNextTask();
			})
			.catch((error) => {
				console.error(`Failed to initialize worker ${i}:`, error);
				// Add a placeholder to maintain index consistency
				workerPool!.workers.push(null as unknown as Worker);
				workerPool!.workerStatus.push(false); // Mark as unavailable
			});
	}

	// Wait for all workers to initialize
	await Promise.allSettled(workerPromises);

	const successfulWorkers = workerPool.workers.filter(
		(worker) => worker !== (null as unknown as Worker)
	).length;
	console.log(`Worker pool initialized with ${successfulWorkers}/${maxWorkers} workers`);
}

/**
 * Post a message to the worker pool
 */
export function postMessageToPool<T>(message: GenerationWorkerMessage): Promise<T> {
	console.log('WorkerPool: postMessageToPool called with message:', message);
	if (!workerPool) {
		throw new Error('Worker pool not initialized. Call initializeWorkerPool() first.');
	}

	return new Promise<T>((resolve, reject) => {
		const taskId = `${Date.now()}-${Math.random()}`;
		const task: WorkerTask<T> = {
			id: taskId,
			message,
			resolve,
			reject,
			timestamp: Date.now(),
			// Store functions separately to avoid cloning issues
			_resolve: resolve,
			_reject: reject
		};

		// Add to queue
		if (workerPool) {
			workerPool.taskQueue.push(task as unknown as WorkerTask);
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
		if (worker) {
			worker.terminate();
		}
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

	const availableWorkers = workerPool.workerStatus.filter(
		(status, index) => workerPool!.workers[index] && status
	).length;

	return {
		totalWorkers: workerPool.workers.filter((worker) => worker !== (null as unknown as Worker))
			.length,
		availableWorkers,
		queuedTasks: workerPool.taskQueue.length,
		activeTasks: workerPool.activeTasks.size
	};
}

/**
 * Clean up any completed tasks that are older than a certain threshold
 */
export function cleanupOldTasks(thresholdMs: number = 300000): void {
	// 5 minutes threshold
	if (!workerPool) return;

	const now = Date.now();
	const threshold = now - thresholdMs;

	// Clean up completed tasks (those not in activeTasks but might still be in memory)
	for (const [taskId, task] of workerPool.activeTasks.entries()) {
		if (task.timestamp < threshold) {
			console.warn(`Cleaning up old task ${taskId}`);
			workerPool.activeTasks.delete(taskId);
		}
	}
}
