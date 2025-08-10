// src/lib/workers/worker.pool.ts

import type { GenerationWorkerMessage } from './generation.worker.loader';

// Worker pool configuration
interface WorkerPoolConfig {
  maxWorkers?: number;
  maxConcurrentTasks?: number;
}

// Task interface
interface WorkerTask {
  id: string;
  message: GenerationWorkerMessage;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
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

/**
 * Get device capabilities to determine optimal worker count
 */
function getDeviceCapabilities() {
  const coreCount = navigator.hardwareConcurrency || 4;
  let memoryGB = 8;
  if ('deviceMemory' in navigator) {
    // @ts-ignore - deviceMemory not in all browsers
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
  
  const { type } = event.data;
  
  // For progress and other non-terminal messages, just forward them
  if (type !== 'complete' && type !== 'error' && type !== 'cancelled') {
    // Forward to any listeners (we might need a better event system for this)
    return;
  }
  
  // Mark worker as available when task completes
  if (workerPool) {
    workerPool.workerStatus[workerIndex] = true;
  }
  
  // Process next task if available
  processNextTask();
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
    const task: WorkerTask = { id: taskId, message, resolve, reject };
    
    // Add to queue
    if (workerPool) {
      workerPool.taskQueue.push(task);
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
  
  const availableWorkers = workerPool.workerStatus.filter(status => status).length;
  
  return {
    totalWorkers: workerPool.workers.length,
    availableWorkers,
    queuedTasks: workerPool.taskQueue.length,
    activeTasks: workerPool.activeTasks.size
  };
}