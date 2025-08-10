import type { TransferrableLayer } from '../domain/project.domain';

export type GenerationWorkerMessage =
	| {
			type: 'start';
			payload: {
				layers: TransferrableLayer[];
				collectionSize: number;
				outputSize: { width: number; height: number };
				projectName: string;
				projectDescription: string;
			};
	  }
	| {
			type: 'cancel';
	  };

// Re-export the worker pool functions for backward compatibility
export {
	initializeWorkerPool,
	postMessageToPool,
	terminateWorkerPool,
	getWorkerPoolStatus
} from './worker.pool';
