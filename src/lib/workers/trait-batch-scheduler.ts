/**
 * Trait batch scheduler — dispatches pre-solved trait combinations
 * to the worker pool for image rendering.
 *
 * Extracted from generation.worker.client.ts to separate orchestration concern.
 */

import type {
	BatchMessage,
	CancelledMessage,
	CompleteMessage,
	ErrorMessage,
	PreviewMessage,
	ProgressMessage,
	TransferrableLayer,
} from "$lib/types/worker-messages";
import { postMessageToPool } from "./worker.pool";

export interface BatchConfig {
	layers: TransferrableLayer[];
	collectionSize: number;
	outputSize: { width: number; height: number };
	projectName: string;
	projectDescription: string;
	metadataStandard?: import("$lib/domain/metadata/metadata.strategy").MetadataStandard;
	extraData?: Record<string, unknown>;
	onMessage?: (
		data:
			| CompleteMessage
			| ErrorMessage
			| CancelledMessage
			| ProgressMessage
			| PreviewMessage,
	) => void;
}

export interface Solution {
	index: number;
	traits: {
		layerId: string;
		trait: import("$lib/types/worker-messages").TransferrableTrait;
	}[];
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
			extraData,
		} = this.config;

		const totalBatches = Math.ceil(solutions.length / batchSize);
		const batchPromises: Promise<unknown>[] = [];

		console.log(`📦 Distributing ${totalBatches} batches to worker pool...`);

		for (let b = 0; b < totalBatches; b++) {
			const batchSolutions = solutions.slice(
				b * batchSize,
				(b + 1) * batchSize,
			);

			const message: BatchMessage = {
				type: "batch",
				payload: {
					solutions: batchSolutions,
					layers,
					collectionSize,
					outputSize,
					projectName,
					projectDescription,
					metadataStandard,
					extraData,
				},
			};

			batchPromises.push(postMessageToPool(message));
		}

		await Promise.all(batchPromises);

		// Send completion message to the UI
		if (this.config.onMessage) {
			this.config.onMessage({
				type: "complete",
				payload: {
					images: [],
					metadata: [],
					generatedCount: collectionSize,
					totalCount: collectionSize,
				},
			} as CompleteMessage);
		}
	}
}
