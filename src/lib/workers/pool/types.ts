import type { WorkerPoolDispatchMessage } from '$lib/types/worker-messages';

// Task complexity levels
export enum TaskComplexity {
	LOW = 1,
	MEDIUM = 2,
	HIGH = 3,
	VERY_HIGH = 4
}

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
	taskComplexityBasedScaling?: boolean;
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
	complexity: TaskComplexity;
	estimatedDuration?: number;
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
