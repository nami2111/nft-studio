/**
 * Trait batch scheduler — dispatches pre-solved trait combinations
 * to the worker pool for image rendering via layer-ref mode.
 *
 * Layers (with image data) are initialized in each worker once through
 * `init-layers`; batches then carry only lightweight trait references
 * (`batch-ref`), so trait image buffers are not re-sent per batch.
 */

import type { BatchRefMessage, TransferrableLayer } from '$lib/types/worker-messages';
import { getWorkerPoolStatus, postMessageToPool, registerLayersPayload } from './pool';

const BATCH_CONFIG = {
	WINDOW_SIZE: 4,
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
 * Schedules pre-computed trait solutions as ref-batches dispatched to the worker pool.
 */
export class TraitBatchScheduler {
	private config: BatchConfig;

	constructor(config: BatchConfig) {
		this.config = config;
	}

	/**
	 * Initialize layer refs in every worker, then chunk solutions into
	 * ref-batches and dispatch them to the worker pool.
	 * Resolves when all batches complete.
	 */
	async scheduleBatches(solutions: Solution[]): Promise<void> {
		const {
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription,
			metadataStandard,
			extraData
		} = this.config;

		const workerCount =
			getWorkerPoolStatus()?.totalWorkers ||
			navigator.hardwareConcurrency ||
			BATCH_CONFIG.ADAPTIVE.DEFAULT_CONCURRENCY;
		const effectiveBatchSize = calculateAdaptiveBatchSize(collectionSize, workerCount, outputSize);

		const totalBatches = Math.ceil(solutions.length / effectiveBatchSize);
		const windowSize = getWorkerPoolStatus()?.totalWorkers || BATCH_CONFIG.WINDOW_SIZE;

		if (import.meta.env.DEV)
			console.log(
				`📦 [ref-mode] init ${workerCount} workers, dispatch ${totalBatches} ref-batches (batchSize=${effectiveBatchSize}, window=${windowSize})...`
			);

		// Initialize the layer/trait reference maps in every worker before any
		// batch dispatches — one full-layer send (incl. imageData) per worker.
		const initTasks = registerLayersPayload({ layers });
		await Promise.all(initTasks);

		// FIND-3: Process batches in windows to prevent unbounded queue growth.
		// Each window awaits completion before dispatching the next window,
		// allowing solution data from processed windows to be GC'd.
		for (let b = 0; b < totalBatches; b += windowSize) {
			const windowPromises: Promise<unknown>[] = [];
			const windowEnd = Math.min(b + windowSize, totalBatches);

			for (let w = b; w < windowEnd; w++) {
				const batchSolutions = solutions.slice(
					w * effectiveBatchSize,
					(w + 1) * effectiveBatchSize
				);

				const message: BatchRefMessage = {
					type: 'batch-ref',
					payload: {
						solutions: batchSolutions.map((s) => ({
							index: s.index,
							traitRefs: s.traits.map((t) => ({ layerId: t.layerId, traitId: t.trait.id }))
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
			}

			await Promise.all(windowPromises);
		}
	}
}
