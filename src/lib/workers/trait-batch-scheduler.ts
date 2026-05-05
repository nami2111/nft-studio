/**
 * Trait batch scheduler — dispatches pre-solved trait combinations
 * to the worker pool for image rendering.
 *
 * Extracted from generation.worker.client.ts to separate orchestration concern.
 */

import type {
	BatchMessage,
	InitLayersMessage,
	BatchRefMessage,
	CancelledMessage,
	CompleteMessage,
	ErrorMessage,
	PreviewMessage,
	ProgressMessage,
	TransferrableLayer
} from '$lib/types/worker-messages';
import { isFlagEnabled } from '$lib/config/feature-flags';
import { getWorkerPoolStatus, postMessageToPool } from './worker.pool';

export interface BatchConfig {
	layers: TransferrableLayer[];
	collectionSize: number;
	outputSize: { width: number; height: number };
	projectName: string;
	projectDescription: string;
	metadataStandard?: import('$lib/domain/metadata/metadata.strategy').MetadataStandard;
	extraData?: Record<string, unknown>;
	onMessage?: (
		data: CompleteMessage | ErrorMessage | CancelledMessage | ProgressMessage | PreviewMessage
	) => void;
}

export interface Solution {
	index: number;
	traits: {
		layerId: string;
		trait: import('$lib/types/worker-messages').TransferrableTrait;
	}[];
}

function calculateAdaptiveBatchSize(
	collectionSize: number,
	workerCount: number,
	outputSize: { width: number; height: number }
): number {
	const base = collectionSize > 10000 ? 80 : collectionSize > 1000 ? 50 : 25;
	const byWorkers = Math.ceil(collectionSize / Math.max(1, workerCount * 2));
	let size = Math.max(10, Math.min(150, Math.min(base, byWorkers)));
	// Reduce batch size for high-resolution images
	if (outputSize.width * outputSize.height > 2_000_000) {
		size = Math.max(10, Math.floor(size / 2));
	}
	return size;
}

/**
 * Schedules pre-computed trait solutions as batches dispatched to the worker pool.
 */
export class TraitBatchScheduler {
	private config: BatchConfig;

	constructor(config: BatchConfig) {
		this.config = config;
	}

	/**
	 * Chunk solutions into batches and dispatch them to the worker pool.
	 * Resolves when all batches complete.
	 */
	async scheduleBatches(solutions: Solution[], batchSize = 50): Promise<void> {
		const {
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription,
			metadataStandard,
			extraData
		} = this.config;

		const effectiveBatchSize = isFlagEnabled('enableAdaptiveBatchSize')
			? calculateAdaptiveBatchSize(
					collectionSize,
					getWorkerPoolStatus()?.totalWorkers || navigator.hardwareConcurrency || 4,
					outputSize
				)
			: batchSize;

		const useLayerRef = isFlagEnabled('enableLayerRef');

		// If using layer references, send init-layers once before any batch-ref messages
		if (useLayerRef) {
			const initMessage: InitLayersMessage = {
				type: 'init-layers',
				payload: { layers }
			};
			await postMessageToPool(initMessage);
		}

		const totalBatches = Math.ceil(solutions.length / effectiveBatchSize);
		const batchPromises: Promise<unknown>[] = [];

		if (import.meta.env.DEV)
			console.log(
				`📦 Distributing ${totalBatches} batches to worker pool (batchSize=${effectiveBatchSize}, layerRef=${useLayerRef})...`
			);

		for (let b = 0; b < totalBatches; b++) {
			const batchSolutions = solutions.slice(b * effectiveBatchSize, (b + 1) * effectiveBatchSize);

			if (useLayerRef) {
				const message: BatchRefMessage = {
					type: 'batch-ref',
					payload: {
						solutions: batchSolutions.map((s) => ({
							index: s.index,
							traitRefs: s.traits.map((t) => ({
								layerId: t.layerId,
								traitId: t.trait.id
							}))
						})),
						collectionSize,
						outputSize,
						projectName,
						projectDescription,
						metadataStandard,
						extraData
					}
				};
				batchPromises.push(postMessageToPool(message));
			} else {
				const message: BatchMessage = {
					type: 'batch',
					payload: {
						solutions: batchSolutions,
						layers,
						collectionSize,
						outputSize,
						projectName,
						projectDescription,
						metadataStandard,
						extraData
					}
				};
				batchPromises.push(postMessageToPool(message));
			}
		}

		await Promise.all(batchPromises);

		// Send completion message to the UI
		if (this.config.onMessage) {
			this.config.onMessage({
				type: 'complete',
				payload: {
					images: [],
					metadata: [],
					generatedCount: collectionSize,
					totalCount: collectionSize
				}
			} as CompleteMessage);
		}
	}
}
