// src/lib/workers/generation.worker.client.ts

import type {
	TransferrableLayer,
	CompleteMessage,
	ErrorMessage,
	CancelledMessage,
	ProgressMessage,
	PreviewMessage
} from '$lib/types/worker-messages';
import type { GenerationWorkerMessage } from './generation.worker.loader';
import {
	postMessageToPool,
	initializeWorkerPool,
	terminateWorkerPool,
	setMessageCallback
} from './worker.pool';

// Worker pool will be initialized on demand

// Callback for handling messages from workers
let messageHandler:
	| ((
			data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	  ) => void)
	| null = null;

// Set up message callback
setMessageCallback((data) => {
	if (messageHandler) {
		messageHandler(data);
	}
});

export function startGeneration(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	onMessage?: (
		data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	) => void
): void {
	// Initialize worker pool on demand
	initializeWorkerPool();

	// Set message handler for this generation session
	messageHandler = onMessage || null;

	const message: GenerationWorkerMessage = {
		type: 'start',
		payload: {
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription
		}
		// Don't include callback in the message - it will be handled separately
		// onMessage callback is handled by the global message handler
	};

	// Post message to worker pool instead of single worker
	postMessageToPool(message).catch((error) => {
		// Handle any errors that might occur during message posting
		if (messageHandler) {
			messageHandler({
				type: 'error',
				payload: {
					message: error instanceof Error ? error.message : 'Failed to start generation'
				}
			});
		}
	});
}

export function cancelGeneration(): void {
	// Terminate all workers in the pool
	terminateWorkerPool();

	// Re-initialize for future use
	initializeWorkerPool();
}
