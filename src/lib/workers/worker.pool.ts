// src/lib/workers/worker.pool.ts

import type {
	GenerationWorkerMessage,
	CompleteMessage,
	ErrorMessage,
	CancelledMessage,
	OutgoingWorkerMessage,
	ProgressMessage,
	PreviewMessage
} from '$lib/types/worker-messages';
import { performanceMonitor, timed, withTiming } from '$lib/utils/performance-monitor';

// Task complexity levels
enum TaskComplexity {
	LOW = 1,
	MEDIUM = 2,
	HIGH = 3,
	VERY_HIGH = 4
}

// Worker health status
enum WorkerHealth {
	HEALTHY = 'healthy',
	UNRESPONSIVE = 'unresponsive',
	ERROR = 'error',
	DEGRADED = 'degraded',
	REMOVED = 'removed'
}

// Worker pool configuration
interface WorkerPoolConfig {
	maxWorkers?: number;
	maxConcurrentTasks?: number;
	workerInitializationTimeout?: number; // Timeout for worker initialization
	minWorkers?: number; // Minimum workers to maintain
	taskComplexityBasedScaling?: boolean; // Enable complexity-based scaling
	healthCheckInterval?: number; // Health check interval in ms
	maxRestarts?: number; // Max restarts per worker before marking as failed
}

// Task interface
interface WorkerTask<T = unknown> {
	id: string;
	message: GenerationWorkerMessage;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
	assignedWorker?: number; // Track which worker is handling this task
	timestamp: number; // Track when task was queued
	complexity: TaskComplexity; // Task complexity level
	estimatedDuration?: number; // Estimated time to complete in ms
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
	workerHealth: WorkerHealth[]; // Track health status of each worker
	workerStats: {
		startTime: number;
		taskCount: number;
		errorCount: number;
		averageTaskTime: number;
		lastActivity: number;
		restartCount: number;
	}[];
	config: WorkerPoolConfig;
	workerInitializationPromises: Promise<void>[]; // Track worker initialization
	healthCheckInterval: number | null; // Health check timer
	scalingInterval: number | null; // Dynamic scaling timer
}

// Global worker pool instance
let workerPool: WorkerPool | null = null;

// Callback for forwarding messages to clients
let messageCallback:
	| ((
			data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	  ) => void)
	| null = null;

/**
 * Clone serializable data, preserving ArrayBuffers and other transferable objects
 */
function cloneSerializableData(obj: unknown): unknown {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}

	// Handle ArrayBuffer specifically
	if (obj instanceof ArrayBuffer) {
		const newBuffer = new ArrayBuffer(obj.byteLength);
		const sourceView = new Uint8Array(obj);
		const destView = new Uint8Array(newBuffer);
		destView.set(sourceView);
		return newBuffer;
	}

	// Handle TypedArray (like Uint8Array, Int32Array, etc.)
	if (ArrayBuffer.isView(obj)) {
		// Create a new instance of the same type with copied data
		const TypedArrayConstructor = Object.getPrototypeOf(obj).constructor;
		return new TypedArrayConstructor(obj);
	}

	// Handle Date
	if (obj instanceof Date) {
		return new Date(obj.getTime());
	}

	// Handle Array
	if (Array.isArray(obj)) {
		return obj.map((item) => cloneSerializableData(item));
	}

	// Handle plain objects
	if (typeof obj === 'object' && obj !== null) {
		const cloned: Record<string, unknown> = {};
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				cloned[key] = cloneSerializableData((obj as Record<string, unknown>)[key]);
			}
		}
		return cloned;
	}

	return obj;
}

// Set message callback for client components to receive worker messages
export function setMessageCallback(
	callback: (
		data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	) => void
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
 * Calculate task complexity based on collection size and layers
 */
function calculateTaskComplexity(
	layers: unknown[],
	collectionSize: number,
	_size: { width: number; height: number }
): TaskComplexity {
	const layerCount = Array.isArray(layers) ? layers.length : 1;
	const totalPixels = _size.width * _size.height;

	// Calculate complexity score
	let complexityScore = 0;

	// Base on collection size
	if (collectionSize <= 100) {
		complexityScore += 1;
	} else if (collectionSize <= 1000) {
		complexityScore += 2;
	} else if (collectionSize <= 5000) {
		complexityScore += 3;
	} else {
		complexityScore += 4;
	}

	// Base on layer count
	if (layerCount <= 3) {
		complexityScore += 1;
	} else if (layerCount <= 10) {
		complexityScore += 2;
	} else if (layerCount <= 20) {
		complexityScore += 3;
	} else {
		complexityScore += 4;
	}

	// Base on resolution
	if (totalPixels <= 250000) {
		// 500x500 or smaller
		complexityScore += 1;
	} else if (totalPixels <= 1000000) {
		// 1000x1000 or smaller
		complexityScore += 2;
	} else if (totalPixels <= 2250000) {
		// 1500x1500 or smaller
		complexityScore += 3;
	} else {
		complexityScore += 4;
	}

	// Average the score and map to complexity levels
	const avgScore = complexityScore / 3;
	if (avgScore <= 1.5) return TaskComplexity.LOW;
	if (avgScore <= 2.5) return TaskComplexity.MEDIUM;
	if (avgScore <= 3.5) return TaskComplexity.HIGH;
	return TaskComplexity.VERY_HIGH;
}

/**
 * Calculate optimal worker count based on device capabilities and current load
 */
function calculateOptimalWorkerCount(
	taskComplexity?: TaskComplexity,
	queueLength = 0,
	activeWorkers = 0
): number {
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

	// Adjust based on task complexity
	if (taskComplexity === TaskComplexity.VERY_HIGH) {
		workerCount = Math.max(1, Math.floor(workerCount * 0.7)); // Use fewer workers for very high complexity
	} else if (taskComplexity === TaskComplexity.LOW) {
		workerCount = Math.min(8, Math.ceil(workerCount * 1.2)); // Use more workers for low complexity
	}

	// Adjust based on queue length (dynamic scaling)
	const queuePressure = queueLength / (workerCount + activeWorkers);
	if (queuePressure > 2) {
		workerCount = Math.min(8, Math.ceil(workerCount * 1.3)); // Scale up if queue is long
	} else if (queuePressure < 0.5 && activeWorkers > 0) {
		workerCount = Math.max(1, Math.floor(workerCount * 0.8)); // Scale down if queue is short
	}

	// Ensure reasonable bounds
	workerCount = Math.max(1, Math.min(workerCount, 6)); // Between 1 and 6 workers

	return workerCount;
}

/**
 * Estimate task duration based on complexity and device capabilities
 */
function estimateTaskDuration(_complexity: TaskComplexity, collectionSize: number): number {
	const { coreCount, memoryGB, isMobile } = getDeviceCapabilities();

	// Base time estimates (in milliseconds)
	const baseTimes = {
		[TaskComplexity.LOW]: 100,
		[TaskComplexity.MEDIUM]: 500,
		[TaskComplexity.HIGH]: 2000,
		[TaskComplexity.VERY_HIGH]: 5000
	};

	let baseTime = baseTimes[_complexity] * (collectionSize / 100); // Scale by collection size
	baseTime *= 16 / memoryGB; // Adjust for memory (more memory = faster)
	baseTime *= 4 / coreCount; // Adjust for cores (more cores = faster)
	if (isMobile) baseTime *= 1.5; // Mobile devices are slower

	// TODO: Consider resolution in future (currently using collection size as primary factor)
	return Math.max(100, baseTime);
}

/**
 * Perform health check on a specific worker
 */
function checkWorkerHealth(workerIndex: number): void {
	if (!workerPool || !workerPool.workers[workerIndex]) return;

	const worker = workerPool.workers[workerIndex];
	const workerHealth = workerPool.workerHealth[workerIndex];

	// Skip health check if worker is already marked as unhealthy
	if (workerHealth === WorkerHealth.ERROR) return;

	try {
		// Send a lightweight ping to check if worker is responsive
		const pingId = `ping-${Date.now()}-${workerIndex}`;
		const pingTimeout = setTimeout(() => {
			console.warn(`Worker ${workerIndex} unresponsive to health check`);
			workerPool!.workerHealth[workerIndex] = WorkerHealth.UNRESPONSIVE;
			handleWorkerFailure(workerIndex, 'Worker unresponsive');
		}, 3000); // 3 second timeout

		worker.postMessage({ type: 'ping', pingId });

		// Set up temporary message handler for ping response
		const handlePingResponse = (event: MessageEvent) => {
			if (event.data?.pingResponse === pingId) {
				clearTimeout(pingTimeout);
				worker.removeEventListener('message', handlePingResponse);

				// Ensure workerIndex is still valid
				if (workerIndex >= 0 && workerIndex < workerPool!.workerStats.length) {
					// Update health status
					if (workerPool!.workerHealth[workerIndex] === WorkerHealth.UNRESPONSIVE) {
						workerPool!.workerHealth[workerIndex] = WorkerHealth.HEALTHY;
						console.log(`Worker ${workerIndex} recovered from unresponsive state`);
					} else {
						workerPool!.workerHealth[workerIndex] = WorkerHealth.HEALTHY;
					}

					// Update last activity time
					workerPool!.workerStats[workerIndex].lastActivity = Date.now();
				}
			}
		};

		worker.addEventListener('message', handlePingResponse);
	} catch (error) {
		console.error(`Health check failed for worker ${workerIndex}:`, error);
		workerPool!.workerHealth[workerIndex] = WorkerHealth.ERROR;
		handleWorkerFailure(workerIndex, 'Health check error');
	}
}

/**
 * Handle worker failure and decide on restart
 */
function handleWorkerFailure(workerIndex: number, reason: string): void {
	if (!workerPool) return;

	// Ensure workerIndex is valid before accessing workerStats
	if (workerIndex < 0 || workerIndex >= workerPool.workerStats.length) {
		console.error(`Invalid workerIndex ${workerIndex} for failure handling`);
		return;
	}

	const workerStats = workerPool.workerStats[workerIndex];
	const maxRestarts = workerPool.config.maxRestarts || 3;

	console.error(
		`Worker ${workerIndex} failed: ${reason}. Restart count: ${workerStats.restartCount}`
	);

	if (workerStats.restartCount < maxRestarts) {
		workerStats.restartCount++;
		restartWorker(workerIndex).catch((error) => {
			console.error(`Failed to restart worker ${workerIndex}:`, error);
			// Mark as permanently failed
			workerPool!.workerHealth[workerIndex] = WorkerHealth.ERROR;
			// Mark worker as unavailable
			workerPool!.workerStatus[workerIndex] = false;
		});
	} else {
		// Worker has exceeded restart limit
		console.error(
			`Worker ${workerIndex} exceeded max restarts (${maxRestarts}), marking as failed`
		);
		workerPool!.workerHealth[workerIndex] = WorkerHealth.ERROR;
		workerPool!.workerStatus[workerIndex] = false;
		workerPool.workers[workerIndex] = null as unknown as Worker;
	}
}

/**
 * Restart a failed worker
 */
async function restartWorker(workerIndex: number): Promise<void> {
	if (!workerPool) return;

	console.log(`Restarting worker ${workerIndex}`);
	const oldWorker = workerPool.workers[workerIndex];

	// Terminate old worker
	if (oldWorker) {
		oldWorker.terminate();
	}

	try {
		const newWorker = await createWorker(workerPool.config.workerInitializationTimeout || 5000);

		// Replace worker in pool
		workerPool.workers[workerIndex] = newWorker;
		workerPool.workerStatus[workerIndex] = true; // Mark as available
		workerPool.workerHealth[workerIndex] = WorkerHealth.HEALTHY;

		// Set up message handler
		newWorker.onmessage = (e: MessageEvent) => {
			handleWorkerMessage(e, workerIndex);
		};

		// Reassign any tasks that were assigned to this worker
		reassignWorkerTasks(workerIndex);

		console.log(`Worker ${workerIndex} restarted successfully`);
	} catch (error) {
		console.error(`Failed to restart worker ${workerIndex}:`, error);
		throw error;
	}
}

/**
 * Reassign tasks from a failed worker to other workers
 */
function reassignWorkerTasks(failedWorkerIndex: number): void {
	if (!workerPool) return;

	const reassignedTasks: WorkerTask[] = [];

	// Find tasks assigned to failed worker
	for (const [taskId, task] of workerPool.activeTasks.entries()) {
		if (task.assignedWorker === failedWorkerIndex) {
			// Move task back to queue for reassignment
			reassignedTasks.push(task);
			workerPool.activeTasks.delete(taskId);
		}
	}

	// Add tasks back to queue with updated timestamps
	reassignedTasks.forEach((task) => {
		task.timestamp = Date.now();
		workerPool!.taskQueue.unshift(task); // Prioritize failed tasks
	});

	// Process next tasks to redistribute load
	processNextTask();
}
async function createWorker(timeoutMs: number = 5000): Promise<Worker> {
	return new Promise((resolve, reject) => {
		let worker: Worker;

		try {
			worker = new Worker(new URL('./generation.worker.ts', import.meta.url), {
				type: 'module'
			});
		} catch (creationError) {
			reject(
				new Error(
					`Worker creation failed: ${creationError instanceof Error ? creationError.message : 'Unknown error'}`
				)
			);
			return;
		}

		// Set up timeout for worker initialization
		const timeoutId = setTimeout(() => {
			worker.terminate();
			reject(new Error('Worker initialization timeout'));
		}, timeoutMs);

		// Handle worker errors
		worker.onerror = (error: ErrorEvent) => {
			clearTimeout(timeoutId);
			let errorMessage = 'Unknown worker error';
			if (error.message) {
				errorMessage = error.message;
			} else if (error.filename && error.lineno) {
				errorMessage = `Error in ${error.filename}:${error.lineno}:${error.colno || 0}`;
			}
			reject(new Error(`Worker error: ${errorMessage}`));
		};

		// Worker is ready when it sends a "ready" message
		worker.onmessage = (e: MessageEvent) => {
			if (e.data?.type === 'ready') {
				clearTimeout(timeoutId);
				// Don't set onmessage to null - let the caller handle it
				resolve(worker);
			}
		};

		// Send initialization message to worker
		worker.postMessage({ type: 'initialize' });
	});
}

/**
 * Handle messages from workers with performance tracking
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

	// Handle unknown message types
	if (!type) {
		return;
	}

	// Handle ping responses - these are internal messages for health checks
	if (type === 'pingResponse') {
		// This will be handled by the health check system
		return;
	}

	// Forward all other messages to client components
	if (messageCallback) {
		messageCallback(
			data as CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
		);
	}

	// For preview messages, just forward to client without affecting worker status
	if (type === 'preview') {
		// Preview messages are forwarded but don't affect worker state
		return;
	}

	// For terminal messages (complete, error, cancelled), resolve/reject promises and clean up
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
					// Update worker performance stats
					updateWorkerPerformance(workerIndex, task.complexity, Date.now() - task.timestamp);
				} else if (type === 'error') {
					if (task._reject)
						task._reject(new Error((data as ErrorMessage).payload?.message || 'Worker error'));
					// Update worker error count with bounds checking
					if (workerIndex >= 0 && workerIndex < workerPool.workerStats.length) {
						workerPool.workerStats[workerIndex].errorCount++;
					}
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
						updateWorkerPerformance(workerIndex, task.complexity, Date.now() - task.timestamp);
					} else if (type === 'error') {
						if (task._reject)
							task._reject(new Error((data as ErrorMessage).payload?.message || 'Worker error'));
						// Update error count with bounds checking
						if (workerIndex >= 0 && workerIndex < workerPool.workerStats.length) {
							workerPool.workerStats[workerIndex].errorCount++;
						}
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

		// If we couldn't find the task, just mark worker as available and continue
		if (!foundTask) {
			if (workerPool) {
				workerPool.workerStatus[workerIndex] = true;
			}
			processNextTask();
			return;
		}

		// Mark worker as available when task completes (for terminal messages)
		if (foundTask && (type === 'complete' || type === 'error' || type === 'cancelled')) {
			if (workerPool) {
				workerPool.workerStatus[workerIndex] = true;
			}

			// Process next task if available
			processNextTask();
		}
	}
}

/**
 * Update worker performance statistics
 */
function updateWorkerPerformance(
	workerIndex: number,
	complexity: TaskComplexity,
	taskDuration: number
): void {
	if (!workerPool) return;

	// Ensure workerIndex is valid before accessing workerStats
	if (workerIndex < 0 || workerIndex >= workerPool.workerStats.length) {
		return;
	}

	const stats = workerPool.workerStats[workerIndex];
	stats.taskCount++;
	stats.lastActivity = Date.now();

	// Calculate weighted average for task time
	if (stats.averageTaskTime === 0) {
		stats.averageTaskTime = taskDuration;
	} else {
		// Give more weight to recent tasks (exponential moving average)
		stats.averageTaskTime = stats.averageTaskTime * 0.7 + taskDuration * 0.3;
	}

	console.log(
		`Worker ${workerIndex} completed ${TaskComplexity[complexity]} task in ${taskDuration}ms (avg: ${Math.round(stats.averageTaskTime)}ms)`
	);
}

/**
 * Find the least loaded worker using work stealing algorithm
 */
function findBestWorkerForTask(): number | null {
	if (!workerPool) return null;

	const availableWorkers: number[] = [];
	const healthyWorkers: number[] = [];

	// Find all available and healthy workers
	for (let i = 0; i < workerPool.workerStatus.length; i++) {
		if (workerPool.workers[i] && workerPool.workerStatus[i]) {
			availableWorkers.push(i);
			if (workerPool.workerHealth[i] === WorkerHealth.HEALTHY) {
				healthyWorkers.push(i);
			}
		}
	}

	if (availableWorkers.length === 0) return null;

	// Prefer healthy workers
	const candidates = healthyWorkers.length > 0 ? healthyWorkers : availableWorkers;

	if (candidates.length === 1) return candidates[0];

	// Work stealing: find worker with least active tasks
	let bestWorker = candidates[0];
	let minTaskCount = Infinity;

	for (const workerIndex of candidates) {
		const workerTaskCount = Array.from(workerPool.activeTasks.values()).filter(
			(task) => task.assignedWorker === workerIndex
		).length;

		// Ensure workerIndex is valid before accessing workerStats
		if (workerIndex < 0 || workerIndex >= workerPool.workerStats.length) {
			continue;
		}

		// Consider worker's historical performance
		const workerStats = workerPool.workerStats[workerIndex];
		const performanceScore = workerStats.averageTaskTime * (workerStats.errorCount + 1);

		if (
			workerTaskCount < minTaskCount ||
			(workerTaskCount === minTaskCount && performanceScore < minTaskCount * 1000)
		) {
			minTaskCount = workerTaskCount;
			bestWorker = workerIndex;
		}
	}

	return bestWorker;
}

/**
 * Dynamic scaling based on current load and complexity
 */
function performDynamicScaling(): void {
	if (!workerPool) return;

	const { taskComplexityBasedScaling = true } = workerPool.config;
	if (!taskComplexityBasedScaling) return;

	const currentWorkers = workerPool.workers.filter((w) => w !== (null as unknown as Worker)).length;
	const queuedTasks = workerPool.taskQueue.length;
	const activeTasks = workerPool.activeTasks.size;
	const totalLoad = queuedTasks + activeTasks;

	// Calculate average load per worker
	const avgLoadPerWorker = currentWorkers > 0 ? totalLoad / currentWorkers : 0;

	// Determine if we need to scale
	let targetWorkerCount = currentWorkers;

	if (avgLoadPerWorker > 2 && currentWorkers < (workerPool.config.maxWorkers || 6)) {
		// Scale up: high queue pressure
		targetWorkerCount = Math.min(
			workerPool.config.maxWorkers || 6,
			Math.ceil(currentWorkers * 1.5)
		);
	} else if (avgLoadPerWorker < 0.5 && currentWorkers > (workerPool.config.minWorkers || 1)) {
		// Scale down: low queue pressure
		targetWorkerCount = Math.max(
			workerPool.config.minWorkers || 1,
			Math.floor(currentWorkers * 0.8)
		);
	}

	// Add workers if needed
	if (targetWorkerCount > currentWorkers) {
		addWorkers(targetWorkerCount - currentWorkers);
	} else if (targetWorkerCount < currentWorkers) {
		// Remove idle workers (graceful shutdown)
		removeIdleWorkers(currentWorkers - targetWorkerCount);
	}
}

/**
 * Add new workers to the pool
 */
async function addWorkers(count: number): Promise<void> {
	if (!workerPool) return;

	console.log(`Adding ${count} worker(s) to pool`);
	const promises: Promise<void>[] = [];

	for (let i = 0; i < count; i++) {
		promises.push(addSingleWorker());
	}

	await Promise.allSettled(promises);
}

/**
 * Add a single worker to the pool
 */
async function addSingleWorker(): Promise<void> {
	if (!workerPool) return;

	try {
		const newWorker = await createWorker(workerPool.config.workerInitializationTimeout || 5000);
		const workerIndex = workerPool.workers.length;

		workerPool.workers.push(newWorker);
		workerPool.workerStatus.push(true);
		workerPool.workerHealth.push(WorkerHealth.HEALTHY);
		workerPool.workerStats.push({
			startTime: Date.now(),
			taskCount: 0,
			errorCount: 0,
			averageTaskTime: 0,
			lastActivity: Date.now(),
			restartCount: 0
		});

		// Set up message handler
		newWorker.onmessage = (e: MessageEvent) => {
			handleWorkerMessage(e, workerIndex);
		};

		// Process any queued tasks
		processNextTask();

		console.log(`Added worker ${workerIndex} successfully`);
	} catch (error) {
		console.error('Failed to add worker:', error);
	}
}

/**
 * Properly remove a worker with full cleanup
 */
function removeWorker(workerIndex: number): void {
	if (!workerPool) return;

	console.log(`Removing worker ${workerIndex} with proper cleanup`);

	// Terminate the worker
	if (workerPool.workers[workerIndex]) {
		workerPool.workers[workerIndex].terminate();
		workerPool.workers[workerIndex] = null as unknown as Worker;
	}

	// Update status arrays
	workerPool.workerStatus[workerIndex] = false;
	workerPool.workerHealth[workerIndex] = WorkerHealth.REMOVED;

	// Clear any queued tasks assigned to this worker
	const removedTasks: WorkerTask[] = [];
	workerPool.taskQueue = workerPool.taskQueue.filter((task) => {
		if (task.assignedWorker === workerIndex) {
			removedTasks.push(task);
			return false; // Remove from queue
		}
		return true;
	});

	// Reject any removed tasks
	for (const task of removedTasks) {
		if (task._reject) {
			task._reject(new Error('Task cancelled due to worker removal'));
		}
		workerPool.activeTasks.delete(task.id);
	}

	console.log(
		`Worker ${workerIndex} removed successfully. ` +
			`Cleaned up ${removedTasks.length} queued tasks and freed resources.`
	);
}

/**
 * Remove idle workers from the pool
 */
function removeIdleWorkers(count: number): void {
	if (!workerPool) return;

	console.log(`Attempting to remove ${count} idle worker(s)`);

	let removedCount = 0;
	for (let i = workerPool.workers.length - 1; i >= 0 && removedCount < count; i--) {
		// Ensure bounds checking for workerStats access
		if (i < 0 || i >= workerPool.workerStats.length) {
			continue;
		}

		const worker = workerPool.workers[i];
		const isHealthy = workerPool.workerHealth[i] === WorkerHealth.HEALTHY;
		// const isActive = !workerPool.workerStatus[i]; // false means busy
		const lastActivity = workerPool.workerStats[i].lastActivity;
		const idleTime = Date.now() - lastActivity;

		// Only remove healthy, idle workers that haven't been active recently
		if (isHealthy && workerPool.workerStatus[i] && idleTime > 30000) {
			// 30 seconds idle
			// Check if any tasks are assigned to this worker
			const hasActiveTasks = Array.from(workerPool.activeTasks.values()).some(
				(task) => task.assignedWorker === i
			);

			if (!hasActiveTasks) {
				// Safe to remove
				removeWorker(i);
				removedCount++;
			}
		}
	}
}

/**
 * Process the next task in the queue using work stealing
 */
function processNextTask(): void {
	if (!workerPool || workerPool.taskQueue.length === 0) {
		return;
	}

	const bestWorker = findBestWorkerForTask();
	if (bestWorker === null) {
		return; // No workers available
	}

	const task = workerPool.taskQueue.shift();
	if (!task) return;

	// Assign task to worker
	task.assignedWorker = bestWorker;
	workerPool.activeTasks.set(task.id, task);
	workerPool.workerStatus[bestWorker] = false; // Mark as busy

	// Post message to worker (only send the message, not the task with functions)
	try {
		// Create a clean message object without any potential non-cloneable data
		const baseMessage = {
			type: task.message.type,
			taskId: task.id // Include task ID for tracking
		};

		// Only include payload if it exists (not all message types have payload)
		// Create a deep copy of the payload to ensure it's clean of any non-serializable references
		// We need to handle ArrayBuffers specially since JSON serialization loses them
		let messageToSend: { type: string; taskId: string; payload?: unknown };
		if ('payload' in task.message) {
			// For deep cloning that preserves ArrayBuffers, we need a custom approach
			// Create a structured clone by serializing and deserializing only the non-ArrayBuffer parts
			const cleanPayload = cloneSerializableData(task.message.payload);
			messageToSend = { ...baseMessage, payload: cleanPayload };
		} else {
			messageToSend = baseMessage;
		}

		workerPool.workers[bestWorker].postMessage(messageToSend);
		console.log(
			`Task ${task.id} assigned to worker ${bestWorker} (complexity: ${task.complexity})`
		);

		// Perform dynamic scaling after task assignment
		performDynamicScaling();
	} catch (error) {
		console.error(`Failed to post message to worker ${bestWorker}:`, error);
		// Mark worker as available and reject task
		workerPool.workerStatus[bestWorker] = true;
		if (task._reject) {
			task._reject(new Error('Failed to send task to worker'));
		}
		workerPool.activeTasks.delete(task.id);
		// Process next task
		processNextTask();
	}
}

/**
 * Initialize the worker pool with enhanced features
 */
export async function initializeWorkerPool(config?: WorkerPoolConfig): Promise<void> {
	const timerId = performanceMonitor.startTimer('worker.initializeWorkerPool');
	try {
		if (workerPool) {
			console.warn('Worker pool already initialized');
			return;
		}

		const optimalWorkerCount = calculateOptimalWorkerCount();
		const maxWorkers = config?.maxWorkers || optimalWorkerCount;
		const workerInitializationTimeout = config?.workerInitializationTimeout || 5000;
		const minWorkers = config?.minWorkers || 1;
		const healthCheckInterval = config?.healthCheckInterval || 30000; // 30 seconds

		workerPool = {
			workers: [],
			taskQueue: [],
			activeTasks: new Map(),
			workerStatus: [],
			workerHealth: [],
			workerStats: [],
			config: {
				maxWorkers,
				maxConcurrentTasks: config?.maxConcurrentTasks || maxWorkers,
				workerInitializationTimeout,
				minWorkers,
				taskComplexityBasedScaling: config?.taskComplexityBasedScaling ?? true,
				healthCheckInterval,
				maxRestarts: config?.maxRestarts || 3
			},
			workerInitializationPromises: [],
			healthCheckInterval: null,
			scalingInterval: null
		};

		// Initialize worker arrays
		for (let i = 0; i < maxWorkers; i++) {
			workerPool.workerHealth.push(WorkerHealth.HEALTHY);
			workerPool.workerStats.push({
				startTime: Date.now(),
				taskCount: 0,
				errorCount: 0,
				averageTaskTime: 0,
				lastActivity: Date.now(),
				restartCount: 0
			});
		}

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
					workerPool!.workerHealth[i] = WorkerHealth.ERROR; // Mark as failed
				});
		}

		// Wait for all workers to initialize
		await Promise.allSettled(workerPromises);

		const successfulWorkers = workerPool.workers.filter(
			(worker) => worker !== (null as unknown as Worker)
		).length;
		console.log(`Worker pool initialized with ${successfulWorkers}/${maxWorkers} workers`);

		performanceMonitor.stopTimer(timerId);

		// Start health checks and dynamic scaling
		startBackgroundProcesses(healthCheckInterval);
	} catch (error) {
		performanceMonitor.stopTimer(timerId, { error: String(error) });
		throw error;
	}
}

/**
 * Start background processes for health checks and dynamic scaling
 */
function startBackgroundProcesses(healthCheckInterval: number): void {
	if (!workerPool) return;

	// Health check interval
	workerPool.healthCheckInterval = setInterval(() => {
		performHealthChecks();
	}, healthCheckInterval);

	// Dynamic scaling interval (less frequent)
	workerPool.scalingInterval = setInterval(() => {
		performDynamicScaling();
	}, 60000); // Every minute

	console.log('Background processes started: health checks and dynamic scaling');
}

/**
 * Perform health checks on all workers
 */
function performHealthChecks(): void {
	if (!workerPool) return;

	console.log('Running health checks on all workers');

	for (let i = 0; i < workerPool.workers.length; i++) {
		if (workerPool.workers[i] && workerPool.workerHealth[i] !== WorkerHealth.ERROR) {
			checkWorkerHealth(i);
		}
	}
}
export function postMessageToPool<T>(message: GenerationWorkerMessage): Promise<T> {
	const timerId = performanceMonitor.startTimer('worker.postMessageToPool', message.type);
	console.log('WorkerPool: postMessageToPool called with message:', message);
	if (!workerPool) {
		throw new Error('Worker pool not initialized. Call initializeWorkerPool() first.');
	}

	performanceMonitor.stopTimer(timerId);
	return new Promise<T>((resolve, reject) => {
		const taskId = `${Date.now()}-${Math.random()}`;

		// Calculate task complexity
		let complexity = TaskComplexity.MEDIUM; // Default
		let estimatedDuration = 500; // Default 500ms

		if (message.type === 'start' && message.payload) {
			const { layers, collectionSize, outputSize } = message.payload;
			complexity = calculateTaskComplexity(layers, collectionSize, outputSize);
			estimatedDuration = estimateTaskDuration(complexity, collectionSize);
		}

		const task: WorkerTask<T> = {
			id: taskId,
			message,
			resolve,
			reject,
			timestamp: Date.now(),
			complexity,
			estimatedDuration,
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
 * Terminate all workers in the pool and cleanup background processes
 */
export function terminateWorkerPool(): void {
	if (!workerPool) return;

	// Clear background intervals
	if (workerPool.healthCheckInterval) {
		clearInterval(workerPool.healthCheckInterval);
	}
	if (workerPool.scalingInterval) {
		clearInterval(workerPool.scalingInterval);
	}

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
 * Get current pool status with health and performance metrics
 */
export function getWorkerPoolStatus(): {
	totalWorkers: number;
	availableWorkers: number;
	queuedTasks: number;
	activeTasks: number;
	workerHealth: WorkerHealth[];
	workerStats: {
		taskCount: number;
		errorCount: number;
		averageTaskTime: number;
		workerCount: number;
	}[];
	complexityBreakdown: {
		low: number;
		medium: number;
		high: number;
		veryHigh: number;
	};
} | null {
	if (!workerPool) return null;

	const availableWorkers = workerPool.workerStatus.filter(
		(status, index) => workerPool!.workers[index] && status
	).length;

	// const healthyWorkers = workerPool.workerHealth.filter(
	// 	(health, index) => workerPool!.workers[index] && health === WorkerHealth.HEALTHY
	// ).length;

	// Count tasks by complexity
	const complexityBreakdown = {
		low: 0,
		medium: 0,
		high: 0,
		veryHigh: 0
	};

	workerPool.taskQueue.forEach((task) => {
		switch (task.complexity) {
			case TaskComplexity.LOW:
				complexityBreakdown.low++;
				break;
			case TaskComplexity.MEDIUM:
				complexityBreakdown.medium++;
				break;
			case TaskComplexity.HIGH:
				complexityBreakdown.high++;
				break;
			case TaskComplexity.VERY_HIGH:
				complexityBreakdown.veryHigh++;
				break;
		}
	});

	return {
		totalWorkers: workerPool.workers.filter((worker) => worker !== (null as unknown as Worker))
			.length,
		availableWorkers,
		queuedTasks: workerPool.taskQueue.length,
		activeTasks: workerPool.activeTasks.size,
		workerHealth: workerPool.workerHealth.slice(),
		workerStats: workerPool.workerStats.map((stats) => ({
			taskCount: stats.taskCount,
			errorCount: stats.errorCount,
			averageTaskTime: Math.round(stats.averageTaskTime),
			workerCount: 1
		})),
		complexityBreakdown
	};
}

/**
 * Clean up any completed tasks that are older than a certain threshold
 */
export function cleanupOldTasks(thresholdMs: number = 3000): void {
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

// Export helper functions for testing
export { TaskComplexity, WorkerHealth, getDeviceCapabilities, calculateTaskComplexity };
