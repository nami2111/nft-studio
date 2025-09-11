// src/lib/domain/worker.service.ts

import type { Layer } from '$lib/types/layer';
import type { CompleteMessage, ErrorMessage, CancelledMessage } from '$lib/types/worker-messages';
import {
	startGeneration as startWorkerGeneration,
	cancelGeneration as cancelWorkerGeneration
} from '$lib/workers/generation.worker.client';
import { prepareLayersForWorker } from '$lib/domain/project.domain';

/**
 * Domain service for worker-related operations
 */

export async function startGeneration(
	layers: Layer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	onMessage?: (data: CompleteMessage | ErrorMessage | CancelledMessage) => void
): Promise<void> {
	try {
		// Validate layers before starting generation
		const transferrableLayers = await prepareLayersForWorker(layers);

		// Start generation using the worker client
		startWorkerGeneration(
			transferrableLayers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription,
			onMessage
		);
	} catch (error) {
		// Handle any preparation errors
		if (onMessage) {
			onMessage({
				type: 'error',
				payload: {
					message: error instanceof Error ? error.message : 'Failed to start generation'
				}
			});
		}
		throw error;
	}
}

export function cancelGeneration(): void {
	cancelWorkerGeneration();
}
