// src/lib/domain/worker.service.ts

import type { Layer } from '$lib/types/layer';
import type {
	CompleteMessage,
	ErrorMessage,
	CancelledMessage,
	ProgressMessage,
	PreviewMessage
} from '$lib/types/worker-messages';
import type { StrictPairConfig } from '$lib/types/layer';
import {
	startGeneration as startWorkerGeneration,
	cancelGeneration as cancelWorkerGeneration
} from '$lib/workers/generation.worker.client';
import { prepareLayersForWorker } from '$lib/domain/project.domain';
import { recoverableWorkerOperation, recoverableFileOperation } from '$lib/utils/error-handler';

/**
 * Domain service for worker-related operations
 */

export async function startGeneration(
	layers: Layer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	strictPairConfig?: StrictPairConfig,
	onMessage?: (
		data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	) => void
): Promise<void> {
	return recoverableWorkerOperation(
		async () => {
			// Validate layers before starting generation (with error recovery)
			const transferrableLayers = await recoverableFileOperation(
				async () => prepareLayersForWorker(layers),
				{
					operation: 'prepareLayersForWorker',
					enableRetry: true,
					retryConfig: {
						maxAttempts: 3,
						initialDelayMs: 1000,
						backoffFactor: 2
					}
				}
			);

			// Start generation using the worker client (with error recovery)
			return new Promise<void>(async (resolve, reject) => {
				const cleanup = () => {
					// Cleanup function to cancel generation if promise is rejected
					try {
						cancelWorkerGeneration();
					} catch {
						// Ignore cleanup errors
					}
				};

				try {
					await startWorkerGeneration(
						transferrableLayers,
						collectionSize,
						outputSize,
						projectName,
						projectDescription,
						strictPairConfig,
						(message) => {
							if (onMessage) {
								onMessage(message);
							}

							// Handle completion or cancellation
							if (message.type === 'complete') {
								resolve();
							} else if (message.type === 'error') {
								cleanup();
								reject(new Error(message.payload.message));
							} else if (message.type === 'cancelled') {
								cleanup();
								reject(new Error('Generation was cancelled'));
							}
						}
					);
				} catch (error) {
					cleanup();
					reject(error);
				}
			});
		},
		{
			operation: 'startGeneration',
			enableRetry: true,
			retryConfig: {
				maxAttempts: 2, // Generation is expensive, limit retries
				initialDelayMs: 3000,
				maxDelayMs: 10000,
				backoffFactor: 2,
				jitter: true
			},
			title: 'Generation Failed',
			description:
				'Failed to start NFT generation. This may be due to memory limitations or worker initialization issues.'
		}
	);
}

export function cancelGeneration(): void {
	cancelWorkerGeneration();
}
