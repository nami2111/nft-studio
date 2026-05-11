// src/lib/workers/worker.pool.ts

import type {
	CancelledMessage,
	CompleteMessage,
	ErrorMessage,
	GenerationWorkerMessage,
	OutgoingWorkerMessage,
	PreviewMessage,
	ProgressMessage
} from '$lib/types/worker-messages';
import { performanceMonitor } from '$lib/utils/performance-monitor';

function debugLog(...args: unknown[]) {
	if (import.meta.env.DEV) console.log('[worker.pool]', ...args);
}

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
	workerTaskCount: number[]; // Track active task count per worker (O(1) lookup)
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
	healthCheckInterval: ReturnType<typeof setInterval> | null; // Health check timer
	scalingInterval: ReturnType<typeof setInterval> | null; // Dynamic scaling timer
}

// Global worker pool instance
let workerPool: WorkerPool | null = null;

// Callback for forwarding messages to clients
let messageCallback:
	| ((
			data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	  ) => void)
	| null = null;

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
		}, 10000); // 10 second timeout for better stability

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
						debugLog(`Worker ${workerIndex} recovered from unresponsive state`);
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

	debugLog(`Restarting worker ${workerIndex}`);
	const oldWorker = workerPool.workers[workerIndex];

	// Terminate old worker
	if (oldWorker) {
		oldWorker.terminate();
	}

	try {
		const newWorker = await createWorker(workerPool.config.workerInitializationTimeout || 10000);

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

		debugLog(`Worker ${workerIndex} restarted successfully`);
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

	// PERF-3: Reset task count for failed worker
	if (failedWorkerIndex >= 0 && failedWorkerIndex < workerPool.workerTaskCount.length) {
		workerPool.workerTaskCount[failedWorkerIndex] = 0;
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

	// Any message from a worker indicates it's alive; update lastActivity so long-running tasks
	// (like generation) aren't treated as unresponsive while they continue to stream progress.
	if (workerIndex >= 0 && workerIndex < workerPool.workerStats.length) {
		workerPool.workerStats[workerIndex].lastActivity = Date.now();
		if (workerPool.workerHealth[workerIndex] === WorkerHealth.UNRESPONSIVE) {
			workerPool.workerHealth[workerIndex] = WorkerHealth.HEALTHY;
		}
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

	// Generation uses streaming/chunking and emits many "complete" messages.
	// Every complete message is treated as terminal for its task; the scheduler handles finalization.
	// (Previously we ignored non-empty complete messages, but that was to support a duplicate empty marker
	// which has been removed from the worker.)
	if (type === 'complete') {
		// Terminal for this task
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
				if (workerIndex >= 0 && workerIndex < workerPool.workerTaskCount.length) {
					workerPool.workerTaskCount[workerIndex]--;
				}
				foundTask = true;
			}
		}

		// Fallback: find by worker index if taskId matching failed
		if (!foundTask) {
			for (const [taskId, task] of workerPool.activeTasks.entries()) {
				if (task.assignedWorker === workerIndex) {
					// Verify message taskId matches if present (prevents resolving wrong task)
					const msgTaskId = (data as OutgoingWorkerMessage & { taskId?: string }).taskId;
					if (msgTaskId && msgTaskId !== taskId) {
						// Mismatch: mark worker available but don't resolve this task
						workerPool.workerStatus[workerIndex] = true;
						processNextTask();
						return;
					}

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
					if (workerIndex >= 0 && workerIndex < workerPool.workerTaskCount.length) {
						workerPool.workerTaskCount[workerIndex]--;
					}
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

	debugLog(
		`Worker ${workerIndex} completed ${TaskComplexity[complexity]} task in ${taskDuration}ms (avg: ${Math.round(stats.averageTaskTime)}ms)`
	);
}

/**
 * Find the least loaded worker using O(1) task count lookup
 * Selects the available worker with the fewest active tasks for optimal load balancing
 */
function findBestWorkerForTask(): number | null {
	if (!workerPool) return null;

	let bestWorker: number | null = null;
	let bestCount = Infinity;
	let bestAvgTime = Infinity;

	for (let i = 0; i < workerPool.workers.length; i++) {
		if (!workerPool.workers[i] || !workerPool.workerStatus[i]) continue;

		const taskCount = workerPool.workerTaskCount[i];
		const avgTime = workerPool.workerStats[i].averageTaskTime;

		if (taskCount < bestCount || (taskCount === bestCount && avgTime < bestAvgTime)) {
			bestWorker = i;
			bestCount = taskCount;
			bestAvgTime = avgTime;
		}
	}

	return bestWorker;
}

/**
 * Dynamic scaling based on current load and complexity
 * Adds or removes workers based on queue length and task complexity
 */
function performDynamicScaling(): void {
	if (!workerPool) return;

	const currentWorkerCount = workerPool.workers.filter(
		(w) => w !== (null as unknown as Worker)
	).length;
	const queueLength = workerPool.taskQueue.length;
	const activeTaskCount = workerPool.activeTasks.size;

	// Use configured max workers or fall back to device-based default
	const configuredMaxWorkers = workerPool.config?.maxWorkers;
	const cores = navigator.hardwareConcurrency || 4;
	const memGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
	const maxWorkers =
		configuredMaxWorkers ?? Math.min(Math.max(1, cores - 1) + 2, memGB >= 16 ? 8 : 6);

	// Only scale if within bounds
	if (currentWorkerCount >= maxWorkers) {
		return; // Already at max
	}

	// Scaling thresholds
	const highQueueThreshold = 20;
	const lowQueueThreshold = 5;
	const lowActiveThreshold = 2;

	// Add workers if queue is growing OR if all current workers are busy and queue has items
	if (
		(queueLength > highQueueThreshold ||
			(queueLength > 0 && activeTaskCount >= currentWorkerCount)) &&
		currentWorkerCount < maxWorkers
	) {
		const workersToAdd = Math.min(2, maxWorkers - currentWorkerCount);
		addWorkers(workersToAdd).catch((error) => {
			console.error('Failed to add workers during dynamic scaling:', error);
		});
		return;
	}

	// Remove workers if queue is consistently low
	if (queueLength < lowQueueThreshold && activeTaskCount < lowActiveThreshold) {
		const workersToRemove = Math.min(2, currentWorkerCount - (workerPool.config.minWorkers || 1));
		if (workersToRemove > 0) {
			removeIdleWorkers(workersToRemove);
		}
	}
}

/**
 * Add new workers to the pool
 */
async function addWorkers(count: number): Promise<void> {
	if (!workerPool) return;

	debugLog(`Adding ${count} worker(s) to pool`);
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
		workerPool.workerTaskCount.push(0);
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

		debugLog(`Added worker ${workerIndex} successfully`);
	} catch (error) {
		console.error('Failed to add worker:', error);
	}
}

/**
 * Properly remove a worker with full cleanup
 */
function removeWorker(workerIndex: number): void {
	if (!workerPool) return;

	debugLog(`Removing worker ${workerIndex} with proper cleanup`);

	// Terminate the worker
	if (workerPool.workers[workerIndex]) {
		workerPool.workers[workerIndex].terminate();
		workerPool.workers[workerIndex] = null as unknown as Worker;
	}

	// Update status arrays
	workerPool.workerStatus[workerIndex] = false;
	workerPool.workerHealth[workerIndex] = WorkerHealth.REMOVED;
	workerPool.workerTaskCount[workerIndex] = 0;

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

	debugLog(
		`Worker ${workerIndex} removed successfully. ` +
			`Cleaned up ${removedTasks.length} queued tasks and freed resources.`
	);
}

/**
 * Remove idle workers from the pool
 */
function removeIdleWorkers(count: number): void {
	if (!workerPool) return;

	debugLog(`Attempting to remove ${count} idle worker(s)`);

	let removedCount = 0;
	for (let i = workerPool.workers.length - 1; i >= 0 && removedCount < count; i--) {
		// Ensure bounds checking for workerStats access
		if (i < 0 || i >= workerPool.workerStats.length) {
			continue;
		}

		const isHealthy = workerPool.workerHealth[i] === WorkerHealth.HEALTHY;
		const lastActivity = workerPool.workerStats[i].lastActivity;
		const idleTime = Date.now() - lastActivity;

		// Only remove healthy, idle workers that haven't been active recently
		// Keep minimum workers for parallel processing and increase idle timeout
		const minWorkers = Math.max(2, Math.floor(workerPool.workers.length / 2)); // Keep at least half the workers
		if (
			workerPool.workers.length - removedCount > minWorkers &&
			isHealthy &&
			workerPool.workerStatus[i] &&
			idleTime > 60000
		) {
			// 60 seconds idle
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
 * Walk a value and replace any non-cloneable class instances with plain
 * object copies (preserving enumerable own properties). Catches cases
 * where compiled TS `private` fields become JS `#` private fields that
 * `structuredClone` rejects.
 *
 *   - ArrayBuffer  →  .slice(0)  (deep copy, safe for transfer)
 *   - Map / Set    →  preserved  (native structuredClone handles them)
 *   - class instances (constructor !== Object && !== Array)  →  plain {}
 *   - Functions / Symbols  →  removed (replaced with undefined)
 */
function sanitizeForClone(value: unknown, depth = 0): unknown {
	if (depth > 50) return value; // safety valve

	if (value === null || value === undefined) return value;

	// Primitives — return as-is
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return value;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'bigint') return value;

	// Skip non-cloneable leaf types
	if (typeof value === 'function') return undefined;
	if (typeof value === 'symbol') return undefined;

	// ArrayBuffer — safe for structuredClone but we re-slice to be defensive
	if (value instanceof ArrayBuffer) {
		return value.byteLength > 0 ? value.slice(0) : value;
	}
	if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) {
		return value;
	}

	// TypedArrays — return underlying buffer slice instead (avoids detached-buffer issues)
	if (ArrayBuffer.isView(value)) {
		const isShared =
			typeof SharedArrayBuffer !== 'undefined' && value.buffer instanceof SharedArrayBuffer;
		const buf = isShared ? value.buffer : value.buffer.slice(0);
		return buf;
	}

	// Native types that structuredClone handles — trust them
	if (value instanceof Date) return value;
	if (value instanceof RegExp) return value;
	if (value instanceof Blob) return value;
	if (value instanceof ImageData) return value;
	if (value instanceof Map) {
		const out = new Map();
		for (const [k, v] of value) {
			out.set(sanitizeForClone(k, depth + 1), sanitizeForClone(v, depth + 1));
		}
		return out;
	}
	if (value instanceof Set) {
		const out = new Set();
		for (const v of value) {
			out.add(sanitizeForClone(v, depth + 1));
		}
		return out;
	}

	// Arrays — recurse
	if (Array.isArray(value)) {
		const out: unknown[] = [];
		for (let i = 0; i < value.length; i++) {
			out[i] = sanitizeForClone(value[i], depth + 1);
		}
		return out;
	}

	// Plain objects — friendly to structuredClone
	const ctor = (value as object).constructor;
	if (ctor === Object || ctor === undefined) {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>)) {
			const v = sanitizeForClone((value as Record<string, unknown>)[key], depth + 1);
			if (v !== undefined) {
				out[key] = v;
			}
		}
		return out;
	}

	// ★ Class instances (including Svelte reactive proxies, SvelteMap, SvelteSet,
	//   solver-internal objects, etc.) — convert to plain object.
	//   Svelte 5 proxies can have `constructor !== Object` and may carry
	//   `#` private fields that structuredClone rejects.
	const out: Record<string, unknown> = {};
	const descs = Object.getOwnPropertyDescriptors(value as object);
	for (const key of Object.keys(descs)) {
		const desc = descs[key];
		if (desc.get || desc.set) {
			// Accessor properties — skip (may reference private fields)
			continue;
		}
		const v = sanitizeForClone(desc.value, depth + 1);
		if (v !== undefined) {
			out[key] = v;
		}
	}
	return out;
}

/**
 * Safe structuredClone that falls back to manual sanitization when
 * the payload contains non-cloneable objects (class instances with
 * `#` private fields, Svelte proxies, etc.).
 */
function safeStructuredClone<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch (_err) {
		if (_err instanceof DOMException && _err.name === 'DataCloneError') {
			if (import.meta.env.DEV) {
				console.debug(
					'[worker.pool] structuredClone failed, falling back to safe clone:',
					_err.message
				);
			}
			return sanitizeForClone(value) as T;
		}
		throw _err;
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
	task.timestamp = Date.now();
	workerPool.activeTasks.set(task.id, task);
	workerPool.workerStatus[bestWorker] = false; // Mark as busy
	workerPool.workerTaskCount[bestWorker]++; // PERF-3: O(1) task count increment

	// Post message to worker (only send the message, not the task with functions)
	try {
		// Create a clean message object without any potential non-cloneable data
		const baseMessage = {
			type: task.message.type,
			taskId: task.id // Include task ID for tracking
		};

		// Only include payload if it exists (not all message types have payload)
		// PERF-4: Skip safeStructuredClone for batch-ref messages (plain objects only).
		// For batch/init-layers, structuredClone handles Transferable ArrayBuffers natively.
		let messageToSend: { type: string; taskId: string; payload?: unknown };
		if ('payload' in task.message) {
			const payload = task.message.payload;
			if (task.message.type === 'batch-ref') {
				// batch-ref payloads are plain objects (traitRefs, strings, numbers) —
				// no class instances or private fields. structuredClone is safe and fast.
				messageToSend = { ...baseMessage, payload: structuredClone(payload) };
			} else {
				// batch/init-layers payloads contain TransferrableTrait with imageData ArrayBuffers.
				// structuredClone handles these natively via Transferable; fall back to
				// safeStructuredClone only if it fails.
				try {
					messageToSend = { ...baseMessage, payload: structuredClone(payload) };
				} catch {
					messageToSend = { ...baseMessage, payload: safeStructuredClone(payload) };
				}
			}
		} else {
			messageToSend = baseMessage;
		}

		workerPool.workers[bestWorker].postMessage(messageToSend);
		debugLog(`Task ${task.id} assigned to worker ${bestWorker} (complexity: ${task.complexity})`);

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

const TASK_TIMEOUT_MS = 120000; // 2 minutes

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

		const { coreCount, memoryGB } = getDeviceCapabilities();

		// Calculate worker count based on device capabilities
		const baseWorkers = Math.max(1, coreCount - 1);
		const maxWorkers = Math.min(config?.maxWorkers || baseWorkers + 2, memoryGB >= 16 ? 8 : 6);
		const minWorkers = Math.max(1, config?.minWorkers || Math.floor(maxWorkers / 2));
		const workerInitializationTimeout = config?.workerInitializationTimeout || 5000;
		const healthCheckInterval = config?.healthCheckInterval || 30000;

		workerPool = {
			workers: Array.from<unknown, Worker>({ length: maxWorkers }, () => null as unknown as Worker),
			taskQueue: [],
			activeTasks: new Map(),
			workerStatus: Array.from({ length: maxWorkers }, () => false),
			workerHealth: Array.from({ length: maxWorkers }, () => WorkerHealth.HEALTHY),
			workerTaskCount: Array.from({ length: maxWorkers }, () => 0),
			workerStats: Array.from({ length: maxWorkers }, () => ({
				startTime: Date.now(),
				taskCount: 0,
				errorCount: 0,
				averageTaskTime: 0,
				lastActivity: Date.now(),
				restartCount: 0
			})),
			config: {
				maxWorkers,
				maxConcurrentTasks: config?.maxConcurrentTasks || maxWorkers,
				workerInitializationTimeout,
				minWorkers,
				taskComplexityBasedScaling: true,
				healthCheckInterval,
				maxRestarts: config?.maxRestarts || 3
			},
			workerInitializationPromises: [],
			healthCheckInterval: null,
			scalingInterval: null
		};

		// Create only minWorkers initially (lazy init)
		const initialWorkers = minWorkers;
		const workerPromises: Promise<Worker>[] = [];
		for (let i = 0; i < initialWorkers; i++) {
			workerPromises.push(createWorker(workerInitializationTimeout));
		}

		const results = await Promise.allSettled(workerPromises);
		results.forEach((result, i) => {
			if (result.status === 'fulfilled') {
				workerPool!.workers[i] = result.value;
				workerPool!.workerStatus[i] = true;
				result.value.onmessage = (e: MessageEvent) => {
					handleWorkerMessage(e, i);
				};
				debugLog(`Worker ${i} initialized successfully`);
				processNextTask();
			} else {
				workerPool!.workers[i] = null as unknown as Worker;
				workerPool!.workerStatus[i] = false;
				workerPool!.workerHealth[i] = WorkerHealth.ERROR;
				console.error(`Failed to initialize worker ${i}:`, result.reason);
			}
		});

		const successfulWorkers = workerPool.workers.filter(
			(worker) => worker !== (null as unknown as Worker)
		).length;
		debugLog(
			`Worker pool initialized with ${successfulWorkers}/${maxWorkers} workers (${initialWorkers} eagerly)`
		);

		performanceMonitor.stopTimer(timerId);

		// Start health checks and dynamic scaling
		startBackgroundProcesses(healthCheckInterval);
	} catch (error) {
		performanceMonitor.stopTimer(timerId, { error: String(error) });
		throw error;
	}
}

/**
 * Warm up workers by pre-initializing a minimum pool
 * This reduces latency on first use by having workers ready
 */
export async function warmUpWorkers(config?: WorkerPoolConfig): Promise<void> {
	// If worker pool already exists, skip warm-up
	if (workerPool) {
		return;
	}

	const { coreCount } = getDeviceCapabilities();

	// Calculate warm-up worker count based on device
	const warmUpWorkers = Math.max(1, Math.floor(coreCount / 2));

	debugLog(`Warming up worker pool with ${warmUpWorkers} workers...`);

	// Start pool with warmUpWorkers for faster startup
	const warmUpConfig: WorkerPoolConfig = {
		...config,
		maxWorkers: warmUpWorkers,
		minWorkers: warmUpWorkers,
		taskComplexityBasedScaling: true,
		healthCheckInterval: config?.healthCheckInterval ?? 30000
	};

	try {
		await initializeWorkerPool(warmUpConfig);
		debugLog(`Worker pool warmed up with ${warmUpWorkers} workers ready`);
	} catch (error) {
		console.error('Worker warm-up failed:', error);
		// Non-critical error - workers will be initialized on first use
	}
}

/**
 * Start background processes for health checks, dynamic scaling, and task timeout monitoring
 */
function startBackgroundProcesses(healthCheckInterval: number): void {
	if (!workerPool) return;

	// Health check interval
	workerPool.healthCheckInterval = setInterval(() => {
		performHealthChecks();
	}, healthCheckInterval);

	// Dynamic scaling interval - adjust worker count based on load
	workerPool.scalingInterval = setInterval(() => {
		performDynamicScaling();
	}, 15000); // Every 15 seconds for faster warm-up

	// Task timeout monitoring
	setInterval(() => {
		if (!workerPool) return;
		const now = Date.now();
		for (const [taskId, task] of workerPool.activeTasks.entries()) {
			if (now - task.timestamp > TASK_TIMEOUT_MS) {
				console.error(`Task ${taskId} timed out after ${TASK_TIMEOUT_MS}ms`);
				if (task.assignedWorker !== undefined) {
					handleWorkerFailure(task.assignedWorker, 'Task timeout');
				}
				if (task._reject) {
					task._reject(new Error('Task timeout'));
				}
				workerPool.activeTasks.delete(taskId);
			}
		}

		// Drain detection: if all workers are in ERROR state and queue has items, reject everything
		const allError =
			workerPool.workers.length > 0 &&
			workerPool.workers.every(
				(_, i) =>
					workerPool!.workerHealth[i] === WorkerHealth.ERROR ||
					workerPool!.workers[i] === (null as unknown as Worker)
			);
		if (allError && workerPool.taskQueue.length > 0) {
			console.error('All workers failed; draining task queue');
			for (const task of workerPool.taskQueue) {
				if (task._reject) {
					task._reject(new Error('All workers failed'));
				}
			}
			workerPool.taskQueue = [];
		}
	}, 30000); // Check every 30 seconds

	debugLog(
		'Background processes started: health checks, dynamic scaling, and timeout monitoring enabled'
	);
}

/**
 * Perform health checks on all workers
 */
function performHealthChecks(): void {
	if (!workerPool) return;

	debugLog('Running health checks on all workers');

	for (let i = 0; i < workerPool.workers.length; i++) {
		if (!workerPool.workers[i] || workerPool.workerHealth[i] === WorkerHealth.ERROR) {
			continue;
		}

		// Never run ping-based health checks while a worker is actively running a task.
		// Generation is CPU-heavy and may not be able to service pings promptly, which led to
		// false "unresponsive" detections and mid-generation worker restarts.
		const isBusy = !workerPool.workerStatus[i];
		if (isBusy) {
			// Even while busy, check for degraded workers that have been active too long.
			// This prevents hung workers from going undetected during large generations.
			const lastActivity = workerPool.workerStats[i].lastActivity;
			const activeDuration = Date.now() - lastActivity;
			if (activeDuration > 300000) {
				// Worker has been continuously active for >5 minutes — mark as degraded
				if (workerPool.workerHealth[i] !== WorkerHealth.DEGRADED) {
					workerPool.workerHealth[i] = WorkerHealth.DEGRADED;
					debugLog(
						`Worker ${i} marked DEGRADED (active for ${(activeDuration / 1000).toFixed(0)}s without completion)`
					);
				}
			}
			continue;
		}

		// Reset DEGRADED status when worker becomes idle and passes health check
		if (workerPool.workerHealth[i] === WorkerHealth.DEGRADED) {
			debugLog(`Worker ${i} recovered from DEGRADED state`);
			workerPool.workerHealth[i] = WorkerHealth.HEALTHY;
		}

		checkWorkerHealth(i);
	}
}
export function postMessageToPool<T>(message: GenerationWorkerMessage): Promise<T> {
	const timerId = performanceMonitor.startTimer('worker.postMessageToPool', message.type);
	debugLog('WorkerPool: postMessageToPool called with message:', message);
	if (!workerPool) {
		throw new Error('Worker pool not initialized. Call initializeWorkerPool() first.');
	}

	performanceMonitor.stopTimer(timerId);
	return new Promise<T>((resolve, reject) => {
		const taskId = `${Date.now()}-${Math.random()}`;

		// Calculate task complexity
		let complexity = TaskComplexity.MEDIUM; // Default

		// Narrow the message type to extract payload fields for complexity calculation.
		// The TS union excludes 'start' but it can arrive at runtime, so narrowing is needed.
		const msg = message as { type: string; payload?: Record<string, unknown> };
		if (msg.type === 'start' && msg.payload) {
			const p = msg.payload as {
				layers: unknown[];
				collectionSize: number;
				outputSize: { width: number; height: number };
			};
			complexity = calculateTaskComplexity(p.layers, p.collectionSize, p.outputSize);
		} else if (msg.type === 'batch' && msg.payload) {
			const p = msg.payload as {
				layers: unknown[];
				solutions: unknown[];
				outputSize: { width: number; height: number };
			};
			complexity = calculateTaskComplexity(p.layers, p.solutions.length, p.outputSize);
		}

		const task: WorkerTask<T> = {
			id: taskId,
			message,
			resolve,
			reject,
			timestamp: Date.now(),
			complexity,
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
 * Terminate all workers in the pool and cleanup background processes.
 * Returns a Promise that resolves after all workers are terminated and tasks rejected.
 */
export async function terminateWorkerPool(): Promise<void> {
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

	debugLog('Worker pool terminated');
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
export { calculateTaskComplexity, getDeviceCapabilities, TaskComplexity, WorkerHealth };

/**
 * Get optimal worker count based on collection size
 * Dynamic worker scaling for different collection sizes
 */
export function getOptimalWorkerCount(collectionSize: number): number {
	if (collectionSize > 50000) {
		// XL collections: Use fewer workers to prevent memory issues
		return Math.min(4, navigator.hardwareConcurrency - 1);
	} else if (collectionSize > 10000) {
		// Large collections: Moderate worker count
		return Math.min(6, navigator.hardwareConcurrency);
	} else if (collectionSize > 5000) {
		// Medium collections: Standard worker count
		return Math.min(8, navigator.hardwareConcurrency);
	} else {
		// Small collections: More workers for speed
		return Math.min(10, navigator.hardwareConcurrency + 1);
	}
}
