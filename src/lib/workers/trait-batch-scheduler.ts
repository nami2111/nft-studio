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

		if (import.meta.env.DEV)
			console.log(
				`📦 [ref-mode] init ${workerCount} workers, dispatch ${totalBatches} ref-batches (batchSize=${effectiveBatchSize})...`
			);

		// Initialize the layer/trait reference maps in every worker before any
		// batch dispatches — one full-layer send (incl. imageData) per worker.
		const initTasks = registerLayersPayload({ layers });
		await Promise.all(initTasks);

		// Ref-mode batches carry only tiny {layerId,traitId} refs (no image
		// buffers), so dispatch them ALL up front and let the pool's queue keep
		// every worker saturated. This replaces FIND-3's windowing, which bounded
		// cloned-buffer memory in the old full-batch mode — waiting on windows
		// here kept taskQueue ~0 and starved dynamic scaling (workers 4/8 unused).
		const batchPromises: Promise<unknown>[] = [];
		for (let b = 0; b < totalBatches; b++) {
			const batchSolutions = solutions.slice(
				b * effectiveBatchSize,
				(b + 1) * effectiveBatchSize
			);

			batchPromises.push(
				postMessageToPool({
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
				} as BatchRefMessage)
			);
		}

		await Promise.all(batchPromises);
	}
}
