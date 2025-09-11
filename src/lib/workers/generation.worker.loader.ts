import type { GenerationWorkerMessage } from '$lib/types/worker-messages';

// Export the worker pool functions for backward compatibility
export {
	initializeWorkerPool,
	postMessageToPool,
	terminateWorkerPool,
	getWorkerPoolStatus
} from './worker.pool';

// Export the GenerationWorkerMessage type
export type { GenerationWorkerMessage };
