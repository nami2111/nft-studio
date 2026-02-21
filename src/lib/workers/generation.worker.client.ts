import type {
	TransferrableLayer,
	TransferrableTrait,
	CompleteMessage,
	ErrorMessage,
	CancelledMessage,
	ProgressMessage,
	PreviewMessage,
	BatchMessage
} from '$lib/types/worker-messages';
import type { StrictPairConfig } from '$lib/types/layer';
import {
	postMessageToPool,
	initializeWorkerPool,
	terminateWorkerPool,
	setMessageCallback
} from './worker.pool';
import { performanceMonitor } from '$lib/utils/performance-monitor';
import { CSPSolver } from './csp-solver';
import { type TaskId } from '$lib/types/ids';

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

export async function startGeneration(
	layers: TransferrableLayer[],
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
	const timerId = performanceMonitor.startTimer('generation.startGeneration');

	// Initialize worker pool on demand and wait for it to be ready
	await initializeWorkerPool();

	// Set message handler for this generation session
	messageHandler = onMessage || null;

	try {
		// 1. Solve for the entire collection upfront on the main thread
		// This is fast and ensures absolute uniqueness across parallel workers
		const usedCombinations = new Map<string, Set<bigint>>();

		// Ensure we have at least a global uniqueness rule
		const activeStrictPairConfig = strictPairConfig
			? { ...strictPairConfig }
			: { enabled: true, layerCombinations: [] };
		if (
			!activeStrictPairConfig.layerCombinations ||
			activeStrictPairConfig.layerCombinations.length === 0
		) {
			activeStrictPairConfig.enabled = true;
			activeStrictPairConfig.layerCombinations = [
				{
					id: '__global__',
					layerIds: layers.map((l) => l.id),
					active: true,
					description: 'Global Uniqueness'
				}
			];
		}

		const solver = new CSPSolver(layers, usedCombinations, activeStrictPairConfig);
		const solutions: { index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[] = [];

		console.log(`🚀 Pre-solving ${collectionSize} unique combinations...`);
		const preSolveTimer = performanceMonitor.startTimer('generation.preSolve');

		for (let i = 0; i < collectionSize; i++) {
			const solutionMap = await solver.solve();
			if (!solutionMap) {
				throw new Error(`Exhausted all possible valid unique combinations at item ${i + 1}.`);
			}

			// Record for next iteration's uniqueness check
			solver.markCombinationAsUsed();

			// Map and sort traits by layer order for correct rendering
			// CLONE trais to ensure no reactive proxy leakage
			const sortedTraits = Array.from(solutionMap.entries())
				.map(([layerId, trait]) => {
					const layer = layers.find((l) => l.id === layerId);
					return {
						layerId,
						trait: { ...trait }, // Shallow clone the trait object
						order: layer?.order || 0
					};
				})
				.sort((a, b) => a.order - b.order)
				.map(({ layerId, trait }) => ({ layerId, trait }));

			if (sortedTraits.length === 0) {
				console.error(`❌ Item ${i}: Solver returned Map but mapped traits are empty!`);
			}

			solutions.push({
				index: i,
				traits: sortedTraits
			});
		}

		performanceMonitor.stopTimer(preSolveTimer);
		console.log(`✅ Pre-solved ${solutions.length} combinations.`);

		// 2. Chunk the solutions into batches and send to the pool
		const BATCH_SIZE = 50;
		const totalBatches = Math.ceil(solutions.length / BATCH_SIZE);
		const batchPromises: Promise<any>[] = [];

		console.log(`📦 Distributing ${totalBatches} batches to worker pool...`);

		for (let b = 0; b < totalBatches; b++) {
			const batchSolutions = solutions.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

			const message: BatchMessage = {
				type: 'batch',
				// taskId will be assigned by workerPool.postMessageToPool
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

		// Wait for all batches to complete
		await Promise.all(batchPromises);

		// Send a final completion message to the UI
		if (messageHandler) {
			messageHandler({
				type: 'complete',
				payload: {
					images: [],
					metadata: [],
					generatedCount: collectionSize,
					totalCount: collectionSize
				}
			} as CompleteMessage);
		}

		performanceMonitor.stopTimer(timerId);
	} catch (error) {
		performanceMonitor.stopTimer(timerId, { error: String(error) });
		console.error('Generation failure:', error);
		if (messageHandler) {
			messageHandler({
				type: 'error',
				payload: {
					message: error instanceof Error ? error.message : 'Failed to generate collection'
				}
			});
		}
	}
}

export function cancelGeneration(): void {
	// Terminate all workers in the pool
	terminateWorkerPool();

	// Re-initialize for future use
	initializeWorkerPool();
}
