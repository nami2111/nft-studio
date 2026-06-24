import type { WorkerPoolDispatchMessage } from '$lib/types/worker-messages';

// Worker health status
export enum WorkerHealth {
	HEALTHY = 'healthy',
	UNRESPONSIVE = 'unresponsive',
	ERROR = 'error',
	DEGRADED = 'degraded',
	REMOVED = 'removed'
}

// Worker pool configuration
export interface WorkerPoolConfig {
	maxWorkers?: number;
	maxConcurrentTasks?: number;
	workerInitializationTimeout?: number;
	minWorkers?: number;
	healthCheckInterval?: number;
	maxRestarts?: number;
}

// Task interface
export interface WorkerTask<T = unknown> {
	id: string;
	message: WorkerPoolDispatchMessage;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
	assignedWorker?: number;
	timestamp: number;
}

// Worker pool interface
export interface WorkerPool {
	workers: Worker[];
	taskQueue: WorkerTask[];
	activeTasks: Map<string, WorkerTask>;
	workerStatus: boolean[];
	workerHealth: WorkerHealth[];
	workerTaskCount: number[];
	workerStats: {
		startTime: number;
		taskCount: number;
		errorCount: number;
		averageTaskTime: number;
		lastActivity: number;
		restartCount: number;
	}[];
	config: WorkerPoolConfig;
	workerInitializationPromises: Promise<void>[];
	healthCheckInterval: ReturnType<typeof setInterval> | null;
	scalingInterval: ReturnType<typeof setInterval> | null;
}

export const TASK_TIMEOUT_MS = 120000; // 2 minutes
