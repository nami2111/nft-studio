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
import { generationState } from '$lib/stores/generation-progress.svelte';

/**
 * Domain service for worker-related operations with persistent state integration
 */

export async function startGeneration(
	layers: Layer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	metadataStandard?: import('$lib/domain/metadata/metadata.strategy').MetadataStandard,
	strictPairConfig?: StrictPairConfig,
	extraData?: Record<string, unknown>,
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

			// Create enhanced message handler that synchronizes with persistent store
			const enhancedMessageHandler = (
				data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
			) => {
				// Forward to original handler
				if (onMessage) {
					onMessage(data);
				}

				// Synchronize specific state with persistent store
				switch (data.type) {
					case 'progress':
						// Progress is already handled by the persistent store in the component
						break;
					case 'complete':
						// Images and metadata are handled by the persistent store in the component
						break;
					case 'error':
						// Error is handled by the persistent store in the component
						break;
				}
			};

			// Start generation using the worker client with state awareness
			return new Promise<void>((resolve, reject) => {
				const cleanup = () => {
					// Cleanup function to cancel generation if promise is rejected
					try {
						cancelWorkerGeneration();
					} catch {
						// Ignore cleanup errors
					}
				};

				startWorkerGeneration(
					transferrableLayers,
					collectionSize,
					outputSize,
					projectName,
					projectDescription,
					metadataStandard,
					strictPairConfig,
					extraData,
					enhancedMessageHandler
				)
					.then(resolve)
					.catch((error) => {
						cleanup();
						reject(error);
					});
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

/**
 * Cancel generation and clean up resources
 */
export function cancelGeneration(): void {
	console.log('🛑 Cancelling generation');

	// Mark as cancelled in persistent state
	generationState.error = 'Generation cancelled by user';

	cancelWorkerGeneration();
}
