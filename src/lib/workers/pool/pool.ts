import { performanceMonitor } from '$lib/utils/performance-monitor';
import type {
	ErrorMessage,
	OutgoingWorkerMessage,
	PoolForwardedWorkerMessage,
	WorkerPoolDispatchMessage
} from '$lib/types/worker-messages';
import {
	workerPool,
	setWorkerPool,
	messageCallback,
	debugLog,
	getDeviceCapabilities,
	setMessageCallback
} from './state';
import { safeStructuredClone } from './sanitize';
import type { WorkerPoolConfig, WorkerTask, WorkerPool as WorkerPoolType } from './types';
import { TaskComplexity, WorkerHealth, TASK_TIMEOUT_MS } from './types';

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

	let complexityScore = 0;
	if (collectionSize <= 100) complexityScore += 1;
	else if (collectionSize <= 1000) complexityScore += 2;
	else if (collectionSize <= 5000) complexityScore += 3;
	else complexityScore += 4;

	if (layerCount <= 3) complexityScore += 1;
	else if (layerCount <= 10) complexityScore += 2;
	else if (layerCount <= 20) complexityScore += 3;
	else complexityScore += 4;

	if (totalPixels <= 250000) complexityScore += 1;
	else if (totalPixels <= 1000000) complexityScore += 2;
	else if (totalPixels <= 2250000) complexityScore += 3;
	else complexityScore += 4;

	const avgScore = complexityScore / 3;
	if (avgScore <= 1.5) return TaskComplexity.LOW;
	if (avgScore <= 2.5) return TaskComplexity.MEDIUM;
	if (avgScore <= 3.5) return TaskComplexity.HIGH;
	return TaskComplexity.VERY_HIGH;
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
	if (workerIndex < 0 || workerIndex >= workerPool.workerStats.length) return;

	const stats = workerPool.workerStats[workerIndex];
	stats.taskCount++;
	stats.lastActivity = Date.now();
	if (stats.averageTaskTime === 0) {
		stats.averageTaskTime = taskDuration;
	} else {
		stats.averageTaskTime = stats.averageTaskTime * 0.7 + taskDuration * 0.3;
	}
}

/**
 * Find the least loaded worker using O(1) task count lookup
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
 * Resolve task from pool by taskId.
 * All task-related messages now have required taskId field.
 */
function resolveTask(taskId: string): WorkerTask | undefined {
	return workerPool!.activeTasks.get(taskId);
}

/**
 * Finalize a completed/errored/cancelled task: resolve the promise, update stats, clean up.
 */
function finalizeTask(
	task: WorkerTask,
	type: string,
	data: OutgoingWorkerMessage,
	workerIndex: number
): void {
	if (type === 'complete') {
		task.resolve(data);
		updateWorkerPerformance(workerIndex, task.complexity, Date.now() - task.timestamp);
	} else if (type === 'error') {
		task.reject(new Error((data as ErrorMessage).payload?.message || 'Worker error'));
		if (workerIndex >= 0 && workerIndex < workerPool!.workerStats.length) {
			workerPool!.workerStats[workerIndex].errorCount++;
		}
	} else if (type === 'cancelled') {
		task.reject(new Error('Generation cancelled'));
	}
	workerPool!.activeTasks.delete(task.id);
	if (workerIndex >= 0 && workerIndex < workerPool!.workerTaskCount.length) {
		workerPool!.workerTaskCount[workerIndex]--;
	}
}

/**
 * Handle messages from workers with performance tracking
 */
function handleWorkerMessage(event: MessageEvent, workerIndex: number): void {
	if (!workerPool) return;

	const data = event.data as OutgoingWorkerMessage;
	const { type } = data;

	// Control messages without taskId
	if (type === 'ready' || type === 'pingResponse') return;
	if (!type) return;

	if (workerIndex >= 0 && workerIndex < workerPool.workerStats.length) {
		workerPool.workerStats[workerIndex].lastActivity = Date.now();
		if (workerPool.workerHealth[workerIndex] === WorkerHealth.UNRESPONSIVE) {
			workerPool.workerHealth[workerIndex] = WorkerHealth.HEALTHY;
		}
	}

	// Task-related messages have required taskId
	if (
		type === 'progress' ||
		type === 'complete' ||
		type === 'error' ||
		type === 'cancelled' ||
		type === 'preview' ||
		type === 'chunk'
	) {
		const taskId = data.taskId;

		// Forward to orchestrator callback (except internal init-layers tasks)
		if (messageCallback) {
			let isInternal = false;
			if (workerPool.activeTasks.has(taskId)) {
				const task = workerPool.activeTasks.get(taskId);
				isInternal = task?.message?.type === 'init-layers';
			}
			if (!isInternal) {
				messageCallback(data as PoolForwardedWorkerMessage);
			}
		}

		// Preview messages don't finalize tasks
		if (type === 'preview') return;

		// Finalize task on completion/error/cancellation
		if (type === 'complete' || type === 'error' || type === 'cancelled') {
			const task = resolveTask(taskId);
			if (task) {
				finalizeTask(task, type, data, workerIndex);
			} else {
				console.warn(`[pool] Received ${type} for unknown taskId: ${taskId}`);
			}
			workerPool.workerStatus[workerIndex] = true;
			processNextTask();
		}
	}
}

/**
 * Create a new worker with initialization timeout
 */
async function createWorker(timeoutMs: number = 5000): Promise<Worker> {
	return new Promise((resolve, reject) => {
		let worker: Worker;
		try {
			worker = new Worker(new URL('../generation.worker.ts', import.meta.url), {
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

		const timeoutId = setTimeout(() => {
			worker.terminate();
			reject(new Error('Worker initialization timeout'));
		}, timeoutMs);

		worker.onerror = (error: ErrorEvent) => {
			clearTimeout(timeoutId);
			// Log full error event for browser console inspection
			console.error('[pool] Worker error event:', {
				message: error.message,
				filename: error.filename,
				lineno: error.lineno,
				colno: error.colno,
				error: error.error,
				type: error.type
			});
			const detail = [
				error.message,
				error.filename ? `at ${error.filename}` : '',
				error.lineno != null ? `:${error.lineno}` : '',
				error.colno != null ? `:${error.colno}` : ''
			]
				.filter(Boolean)
				.join(' ');
			const errorMessage = detail || 'Unknown worker error (check browser console for details)';
			reject(new Error(`Worker error: ${errorMessage}`));
		};

		worker.onmessage = (e: MessageEvent) => {
			if (e.data?.type === 'ready') {
				clearTimeout(timeoutId);
				resolve(worker);
			}
		};

		worker.postMessage({ type: 'initialize' });
	});
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

		newWorker.onmessage = (e: MessageEvent) => {
			handleWorkerMessage(e, workerIndex);
		};

		processNextTask();
		debugLog(`Added worker ${workerIndex} successfully`);
	} catch (error) {
		console.error('Failed to add worker:', error);
	}
}

/**
 * Add new workers to the pool
 */
async function addWorkers(count: number): Promise<void> {
	if (!workerPool) return;
	const promises: Promise<void>[] = [];
	for (let i = 0; i < count; i++) {
		promises.push(addSingleWorker());
	}
	await Promise.allSettled(promises);
}

/**
 * Properly remove a worker with full cleanup
 */
function removeWorker(workerIndex: number): void {
	if (!workerPool) return;

	if (workerPool.workers[workerIndex]) {
		workerPool.workers[workerIndex].terminate();
		workerPool.workers[workerIndex] = null as unknown as Worker;
	}
	workerPool.workerStatus[workerIndex] = false;
	workerPool.workerHealth[workerIndex] = WorkerHealth.REMOVED;
	workerPool.workerTaskCount[workerIndex] = 0;

	const removedTasks: WorkerTask[] = [];
	workerPool.taskQueue = workerPool.taskQueue.filter((task) => {
		if (task.assignedWorker === workerIndex) {
			removedTasks.push(task);
			return false;
		}
		return true;
	});
	for (const task of removedTasks) {
		if (task.reject) task.reject(new Error('Task cancelled due to worker removal'));
		workerPool.activeTasks.delete(task.id);
	}
}

/**
 * Remove idle workers from the pool
 */
function removeIdleWorkers(count: number): void {
	if (!workerPool) return;
	let removedCount = 0;
	for (let i = workerPool.workers.length - 1; i >= 0 && removedCount < count; i--) {
		if (i < 0 || i >= workerPool.workerStats.length) continue;
		const isHealthy = workerPool.workerHealth[i] === WorkerHealth.HEALTHY;
		const lastActivity = workerPool.workerStats[i].lastActivity;
		const idleTime = Date.now() - lastActivity;
		const minWorkers = Math.max(2, Math.floor(workerPool.workers.length / 2));
		if (
			workerPool.workers.length - removedCount > minWorkers &&
			isHealthy &&
			workerPool.workerStatus[i] &&
			idleTime > 60000
		) {
			const hasActiveTasks = Array.from(workerPool.activeTasks.values()).some(
				(task) => task.assignedWorker === i
			);
			if (!hasActiveTasks) {
				removeWorker(i);
				removedCount++;
			}
		}
	}
}

/**
 * Perform health check on a specific worker
 */
function checkWorkerHealth(workerIndex: number): void {
	if (!workerPool || !workerPool.workers[workerIndex]) return;

	const workerHealth = workerPool.workerHealth[workerIndex];
	if (workerHealth === WorkerHealth.ERROR) return;

	try {
		const pingId = `ping-${Date.now()}-${workerIndex}`;
		const pingTimeout = setTimeout(() => {
			console.warn(`Worker ${workerIndex} unresponsive to health check`);
			workerPool!.workerHealth[workerIndex] = WorkerHealth.UNRESPONSIVE;
			handleWorkerFailure(workerIndex, 'Worker unresponsive');
		}, 10000);

		workerPool.workers[workerIndex].postMessage({ type: 'ping', pingId });

		const handlePingResponse = (event: MessageEvent) => {
			if (event.data?.pingResponse === pingId) {
				clearTimeout(pingTimeout);
				workerPool!.workers[workerIndex].removeEventListener('message', handlePingResponse);
				if (workerIndex >= 0 && workerIndex < workerPool!.workerStats.length) {
					if (workerPool!.workerHealth[workerIndex] === WorkerHealth.UNRESPONSIVE) {
						workerPool!.workerHealth[workerIndex] = WorkerHealth.HEALTHY;
						debugLog(`Worker ${workerIndex} recovered from unresponsive state`);
					}
					workerPool!.workerStats[workerIndex].lastActivity = Date.now();
				}
			}
		};
		workerPool.workers[workerIndex].addEventListener('message', handlePingResponse);
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
	if (workerIndex < 0 || workerIndex >= workerPool.workerStats.length) return;

	const workerStats = workerPool.workerStats[workerIndex];
	const maxRestarts = workerPool.config.maxRestarts || 3;
	console.error(
		`Worker ${workerIndex} failed: ${reason}. Restart count: ${workerStats.restartCount}`
	);

	if (workerStats.restartCount < maxRestarts) {
		workerStats.restartCount++;
		restartWorker(workerIndex).catch((error) => {
			console.error(`Failed to restart worker ${workerIndex}:`, error);
			if (workerPool && workerIndex >= 0 && workerIndex < workerPool.workerHealth.length) {
				workerPool.workerHealth[workerIndex] = WorkerHealth.ERROR;
				workerPool.workerStatus[workerIndex] = false;
			}
		});
	} else {
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
	const oldWorker = workerPool.workers[workerIndex];
	if (oldWorker) oldWorker.terminate();

	try {
		const newWorker = await createWorker(workerPool.config.workerInitializationTimeout || 10000);
		workerPool.workers[workerIndex] = newWorker;
		workerPool.workerStatus[workerIndex] = true;
		workerPool.workerHealth[workerIndex] = WorkerHealth.HEALTHY;
		newWorker.onmessage = (e: MessageEvent) => {
			handleWorkerMessage(e, workerIndex);
		};
		reassignWorkerTasks(workerIndex);
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
	for (const [taskId, task] of workerPool.activeTasks.entries()) {
		if (task.assignedWorker === failedWorkerIndex) {
			reassignedTasks.push(task);
			workerPool.activeTasks.delete(taskId);
		}
	}
	if (failedWorkerIndex >= 0 && failedWorkerIndex < workerPool.workerTaskCount.length) {
		workerPool.workerTaskCount[failedWorkerIndex] = 0;
	}
	reassignedTasks.forEach((task) => {
		task.timestamp = Date.now();
		workerPool!.taskQueue.unshift(task);
	});
	processNextTask();
}

/**
 * Perform health checks on all workers
 */
function performHealthChecks(): void {
	if (!workerPool) return;

	for (let i = 0; i < workerPool.workers.length; i++) {
		if (!workerPool.workers[i] || workerPool.workerHealth[i] === WorkerHealth.ERROR) continue;

		const isBusy = !workerPool.workerStatus[i];
		if (isBusy) {
			const lastActivity = workerPool.workerStats[i].lastActivity;
			const activeDuration = Date.now() - lastActivity;
			if (activeDuration > 300000) {
				if (workerPool.workerHealth[i] !== WorkerHealth.DEGRADED) {
					workerPool.workerHealth[i] = WorkerHealth.DEGRADED;
					debugLog(
						`Worker ${i} marked DEGRADED (active for ${(activeDuration / 1000).toFixed(0)}s without completion)`
					);
				}
			}
			continue;
		}

		if (workerPool.workerHealth[i] === WorkerHealth.DEGRADED) {
			workerPool.workerHealth[i] = WorkerHealth.HEALTHY;
		}
		checkWorkerHealth(i);
	}
}

/**
 * Dynamic scaling based on current load and complexity
 */
function performDynamicScaling(): void {
	if (!workerPool) return;

	const currentWorkerCount = workerPool.workers.filter(
		(w) => w !== (null as unknown as Worker)
	).length;
	const queueLength = workerPool.taskQueue.length;
	const activeTaskCount = workerPool.activeTasks.size;

	const configuredMaxWorkers = workerPool.config?.maxWorkers;
	const cores = navigator.hardwareConcurrency || 4;
	const memGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
	const maxWorkers =
		configuredMaxWorkers ?? Math.min(Math.max(1, cores - 1) + 2, memGB >= 16 ? 8 : 6);

	if (currentWorkerCount >= maxWorkers) return;

	const highQueueThreshold = 20;
	const lowQueueThreshold = 5;
	const lowActiveThreshold = 2;

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

	if (queueLength < lowQueueThreshold && activeTaskCount < lowActiveThreshold) {
		const workersToRemove = Math.min(2, currentWorkerCount - (workerPool.config.minWorkers || 1));
		if (workersToRemove > 0) removeIdleWorkers(workersToRemove);
	}
}

/**
 * Start background processes for health checks, dynamic scaling, and task timeout monitoring
 */
function startBackgroundProcesses(healthCheckInterval: number): void {
	if (!workerPool) return;

	workerPool.healthCheckInterval = setInterval(() => {
		performHealthChecks();
	}, healthCheckInterval);

	workerPool.scalingInterval = setInterval(() => {
		performDynamicScaling();
	}, 15000);

	setInterval(() => {
		if (!workerPool) return;
		const now = Date.now();
		for (const [taskId, task] of workerPool.activeTasks.entries()) {
			if (now - task.timestamp > TASK_TIMEOUT_MS) {
				console.error(`Task ${taskId} timed out after ${TASK_TIMEOUT_MS}ms`);
				if (task.assignedWorker !== undefined) {
					handleWorkerFailure(task.assignedWorker, 'Task timeout');
				}
				if (task.reject) task.reject(new Error('Task timeout'));
				workerPool.activeTasks.delete(taskId);
			}
		}

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
				if (task.reject) task.reject(new Error('All workers failed'));
			}
			workerPool.taskQueue = [];
		}
	}, 30000);
}

/**
 * Process the next task in the queue using work stealing
 */
function processNextTask(): void {
	if (!workerPool || workerPool.taskQueue.length === 0) return;

	const bestWorker = findBestWorkerForTask();
	if (bestWorker === null) return;

	const task = workerPool.taskQueue.shift();
	if (!task) return;

	task.assignedWorker = bestWorker;
	task.timestamp = Date.now();
	workerPool.activeTasks.set(task.id, task);
	workerPool.workerStatus[bestWorker] = false;
	workerPool.workerTaskCount[bestWorker]++;

	try {
		const baseMessage = { type: task.message.type, taskId: task.id };
		let messageToSend: { type: string; taskId: string; payload?: unknown };

		if ('payload' in task.message) {
			messageToSend = {
				...baseMessage,
				payload: safeStructuredClone(task.message.payload)
			};
		} else {
			messageToSend = baseMessage;
		}

		workerPool.workers[bestWorker].postMessage(messageToSend);
		performDynamicScaling();
	} catch (error) {
		console.error(`Failed to post message to worker ${bestWorker}:`, error);
		workerPool.workerStatus[bestWorker] = true;
		if (task.reject) task.reject(new Error('Failed to send task to worker'));
		workerPool.activeTasks.delete(task.id);
		processNextTask();
	}
}

// === Public API ===

export async function initializeWorkerPool(config?: WorkerPoolConfig): Promise<void> {
	const timerId = performanceMonitor.startTimer('worker.initializeWorkerPool');
	try {
		if (workerPool) {
			console.warn('Worker pool already initialized');
			return;
		}

		const { coreCount, memoryGB } = getDeviceCapabilities();

		const baseWorkers = Math.max(1, coreCount - 1);
		const maxWorkers = Math.min(config?.maxWorkers || baseWorkers + 2, memoryGB >= 16 ? 8 : 6);
		const minWorkers = Math.max(1, config?.minWorkers || Math.floor(maxWorkers / 2));
		const workerInitializationTimeout = config?.workerInitializationTimeout || 5000;
		const healthCheckInterval = config?.healthCheckInterval || 30000;

		const pool: WorkerPoolType = {
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

		setWorkerPool(pool);

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
				processNextTask();
			} else {
				workerPool!.workers[i] = null as unknown as Worker;
				workerPool!.workerStatus[i] = false;
				workerPool!.workerHealth[i] = WorkerHealth.ERROR;
				console.error(`Failed to initialize worker ${i}:`, result.reason);
			}
		});

		const successfulWorkers = workerPool!.workers.filter(
			(worker: Worker) => worker !== (null as unknown as Worker)
		).length;
		debugLog(`Worker pool initialized: ${successfulWorkers}/${maxWorkers} workers ready`);

		performanceMonitor.stopTimer(timerId);
		startBackgroundProcesses(healthCheckInterval);
	} catch (error) {
		performanceMonitor.stopTimer(timerId, { error: String(error) });
		throw error;
	}
}

export async function warmUpWorkers(config?: WorkerPoolConfig): Promise<void> {
	if (workerPool) return;

	const { coreCount } = getDeviceCapabilities();
	// Respect caller's maxWorkers if provided and reasonable,
	// otherwise compute a sensible default based on device cores.
	const requestedMax = config?.maxWorkers;
	const computedMax = Math.max(2, Math.floor(coreCount / 2) - 2);
	const warmUpCount =
		requestedMax != null && requestedMax > 0 ? Math.min(requestedMax, computedMax) : computedMax;
	debugLog(`Warming up worker pool with ${warmUpCount} workers...`);

	const warmUpConfig: WorkerPoolConfig = {
		...config,
		maxWorkers: warmUpCount,
		minWorkers: Math.max(1, Math.min(config?.minWorkers ?? warmUpCount, warmUpCount)),
		taskComplexityBasedScaling: true,
		healthCheckInterval: config?.healthCheckInterval ?? 30000
	};

	try {
		await initializeWorkerPool(warmUpConfig);
	} catch (error) {
		console.error('Worker warm-up failed:', error);
	}
}

export async function terminateWorkerPool(): Promise<void> {
	if (!workerPool) return;

	if (workerPool.healthCheckInterval) clearInterval(workerPool.healthCheckInterval);
	if (workerPool.scalingInterval) clearInterval(workerPool.scalingInterval);

	for (const worker of workerPool.workers) {
		if (worker) worker.terminate();
	}
	for (const task of workerPool.taskQueue) {
		task.reject(new Error('Worker pool terminated'));
	}
	for (const task of workerPool.activeTasks.values()) {
		task.reject(new Error('Worker pool terminated'));
	}

	setWorkerPool(null);
	debugLog('Worker pool terminated');
}

export function postMessageToPool<T>(message: WorkerPoolDispatchMessage): Promise<T> {
	const timerId = performanceMonitor.startTimer('worker.postMessageToPool', message.type);
	if (!workerPool) {
		throw new Error('Worker pool not initialized. Call initializeWorkerPool() first.');
	}
	performanceMonitor.stopTimer(timerId);

	return new Promise<T>((resolve, reject) => {
		const taskId = `${Date.now()}-${Math.random()}`;
		let complexity = TaskComplexity.MEDIUM;

		const msg = message as { type: string; payload?: Record<string, unknown> };
		if (msg.type === 'batch' && msg.payload) {
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
			complexity
		};

		if (workerPool) workerPool.taskQueue.push(task as unknown as WorkerTask);
		processNextTask();
	});
}

export function getWorkerPoolStatus(): ReturnType<typeof getPoolStatus> {
	return getPoolStatus();
}

function getPoolStatus(): {
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
	complexityBreakdown: { low: number; medium: number; high: number; veryHigh: number };
} | null {
	if (!workerPool) return null;

	const availableWorkers = workerPool.workerStatus.filter(
		(status, index) => workerPool!.workers[index] && status
	).length;

	const complexityBreakdown = { low: 0, medium: 0, high: 0, veryHigh: 0 };
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

export function cleanupOldTasks(thresholdMs: number = 3000): void {
	if (!workerPool) return;
	const now = Date.now();
	const threshold = now - thresholdMs;
	for (const [taskId, task] of workerPool.activeTasks.entries()) {
		if (task.timestamp < threshold) {
			console.warn(`Cleaning up old task ${taskId}`);
			workerPool.activeTasks.delete(taskId);
		}
	}
}

export function getOptimalWorkerCount(collectionSize: number): number {
	if (collectionSize > 50000) return Math.min(4, navigator.hardwareConcurrency - 1);
	else if (collectionSize > 10000) return Math.min(6, navigator.hardwareConcurrency);
	else if (collectionSize > 5000) return Math.min(8, navigator.hardwareConcurrency);
	else return Math.min(10, navigator.hardwareConcurrency + 1);
}

// Export for testing
export {
	calculateTaskComplexity,
	getDeviceCapabilities,
	TaskComplexity,
	WorkerHealth,
	handleWorkerFailure,
	reassignWorkerTasks,
	performDynamicScaling,
	processNextTask,
	addWorkers,
	removeIdleWorkers,
	restartWorker
};

export { setMessageCallback };
