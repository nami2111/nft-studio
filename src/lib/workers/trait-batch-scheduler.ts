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
import { getWorkerPoolStatus, postMessageToPool } from './pool';

const BATCH_CONFIG = {
	WINDOW_SIZE: 4,
	DEFAULT_BATCH_SIZE: 50,
	ADAPTIVE: {
		LARGE_THRESHOLD: 10000,
		MEDIUM_THRESHOLD: 1000,
		LARGE_BASE: 80,
		MEDIUM_BASE: 50,
		SMALL_BASE: 25,
		MIN_SIZE: 10,
		MAX_SIZE: 150,
		HIGH_RES_PIXEL_THRESHOLD: 2_000_000,
		RESOLUTION_REDUCTION_FACTOR: 2,
		DEFAULT_CONCURRENCY: 4
	}
} as const;

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

/** Strip imageData from layers payload — workers only need layer names for metadata, never access trait buffers from the layers array. */
function stripImageDataFromLayers(
	layers: import('$lib/types/worker-messages').TransferrableLayer[]
): import('$lib/types/worker-messages').TransferrableLayer[] {
	return layers.map((layer) => ({
		...layer,
		traits: layer.traits.map((trait) => {
			const { imageData: _, ...meta } = trait;
			return meta as import('$lib/types/worker-messages').TransferrableTrait;
		})
	}));
}

function calculateAdaptiveBatchSize(
	collectionSize: number,
	workerCount: number,
	outputSize: { width: number; height: number }
): number {
	const { ADAPTIVE } = BATCH_CONFIG;
	const base =
		collectionSize > ADAPTIVE.LARGE_THRESHOLD
			? ADAPTIVE.LARGE_BASE
			: collectionSize > ADAPTIVE.MEDIUM_THRESHOLD
				? ADAPTIVE.MEDIUM_BASE
				: ADAPTIVE.SMALL_BASE;
	const byWorkers = Math.ceil(collectionSize / Math.max(1, workerCount * 2));
	let size = Math.max(ADAPTIVE.MIN_SIZE, Math.min(ADAPTIVE.MAX_SIZE, Math.min(base, byWorkers)));
	// Reduce batch size for high-resolution images
	if (outputSize.width * outputSize.height > ADAPTIVE.HIGH_RES_PIXEL_THRESHOLD) {
		size = Math.max(ADAPTIVE.MIN_SIZE, Math.floor(size / ADAPTIVE.RESOLUTION_REDUCTION_FACTOR));
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
	async scheduleBatches(
		solutions: Solution[],
		batchSize = BATCH_CONFIG.DEFAULT_BATCH_SIZE
	): Promise<void> {
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
					getWorkerPoolStatus()?.totalWorkers ||
						navigator.hardwareConcurrency ||
						BATCH_CONFIG.ADAPTIVE.DEFAULT_CONCURRENCY,
					outputSize
				)
			: batchSize;

		const useLayerRef = isFlagEnabled('enableLayerRef');

		// If using layer references, send init-layers to ALL workers before any batch-ref messages.
		// This populates layer/trait maps on every worker so batch-ref can land on any of them.
		if (useLayerRef) {
			const initMessage: InitLayersMessage = {
				type: 'init-layers',
				payload: { layers }
			};
			const workerCount =
				getWorkerPoolStatus()?.totalWorkers ||
				navigator.hardwareConcurrency ||
				BATCH_CONFIG.ADAPTIVE.DEFAULT_CONCURRENCY;
			await Promise.all(Array.from({ length: workerCount }, () => postMessageToPool(initMessage)));
		}

		const totalBatches = Math.ceil(solutions.length / effectiveBatchSize);

		if (import.meta.env.DEV)
			console.log(
				`📦 Distributing ${totalBatches} batches to worker pool (batchSize=${effectiveBatchSize}, layerRef=${useLayerRef})...`
			);

		// FIND-3: Process batches in windows to prevent unbounded queue growth.
		// Each window awaits completion before dispatching the next window,
		// allowing solution data from processed batches to be GC'd.
		for (let b = 0; b < totalBatches; b += BATCH_CONFIG.WINDOW_SIZE) {
			const windowPromises: Promise<unknown>[] = [];
			const windowEnd = Math.min(b + BATCH_CONFIG.WINDOW_SIZE, totalBatches);

			for (let w = b; w < windowEnd; w++) {
				const batchSolutions = solutions.slice(
					w * effectiveBatchSize,
					(w + 1) * effectiveBatchSize
				);

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
					windowPromises.push(postMessageToPool(message));
				} else {
					const message: BatchMessage = {
						type: 'batch',
						payload: {
							solutions: batchSolutions,
							layers: stripImageDataFromLayers(layers),
							collectionSize,
							outputSize,
							projectName,
							projectDescription,
							metadataStandard,
							extraData
						}
					};
					windowPromises.push(postMessageToPool(message));
				}
			}

			await Promise.all(windowPromises);
		}

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
