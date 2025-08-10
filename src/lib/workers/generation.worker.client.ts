// src/lib/workers/generation.worker.client.ts

import type { TransferrableLayer } from '../domain/project.domain';
import type { GenerationWorkerMessage } from './generation.worker.loader';
import { postMessageToPool, initializeWorkerPool, terminateWorkerPool } from './worker.pool';

// Initialize worker pool on first import
initializeWorkerPool();

export async function startGeneration(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string
): Promise<void> {
	const message: GenerationWorkerMessage = {
		type: 'start',
		payload: {
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription
		}
	};

	// Post message to worker pool instead of single worker
	return postMessageToPool(message);
}

export function cancelGeneration(): void {
	// Terminate all workers in the pool
	terminateWorkerPool();

	// Re-initialize for future use
	initializeWorkerPool();
}
