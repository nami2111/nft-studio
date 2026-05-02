import type { StrictPairConfig } from "$lib/types/layer";
import type {
	CancelledMessage,
	CompleteMessage,
	ErrorMessage,
	PreviewMessage,
	ProgressMessage,
	TransferrableLayer,
	TransferrableTrait,
} from "$lib/types/worker-messages";
import { performanceMonitor } from "$lib/utils/performance-monitor";
import { CSPSolver } from "./csp-solver";
import { TraitBatchScheduler } from "./trait-batch-scheduler";
import {
	initializeWorkerPool,
	setMessageCallback,
	terminateWorkerPool,
} from "./worker.pool";

// Worker pool will be initialized on demand

// Callback for handling messages from workers
let messageHandler:
	| ((
			data:
				| CompleteMessage
				| ErrorMessage
				| CancelledMessage
				| ProgressMessage
				| PreviewMessage,
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
	metadataStandard?: import("$lib/domain/metadata/metadata.strategy").MetadataStandard,
	strictPairConfig?: StrictPairConfig,
	extraData?: Record<string, unknown>,
	onMessage?: (
		data:
			| CompleteMessage
			| ErrorMessage
			| CancelledMessage
			| ProgressMessage
			| PreviewMessage,
	) => void,
): Promise<void> {
	const timerId = performanceMonitor.startTimer("generation.startGeneration");

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
					id: "__global__",
					layerIds: layers.map((l) => l.id),
					active: true,
					description: "Global Uniqueness",
				},
			];
		}

		const solver = new CSPSolver(
			layers,
			usedCombinations,
			activeStrictPairConfig,
		);
		const solutions: {
			index: number;
			traits: { layerId: string; trait: TransferrableTrait }[];
		}[] = [];

		console.log(`🚀 Pre-solving ${collectionSize} unique combinations...`);
		const preSolveTimer = performanceMonitor.startTimer("generation.preSolve");

		for (let i = 0; i < collectionSize; i++) {
			const solutionMap = solver.solve();
			if (!solutionMap) {
				throw new Error(
					`Exhausted all possible valid unique combinations at item ${i + 1}.`,
				);
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
						order: layer?.order || 0,
					};
				})
				.sort((a, b) => a.order - b.order)
				.map(({ layerId, trait }) => ({ layerId, trait }));

			if (sortedTraits.length === 0) {
				console.error(
					`❌ Item ${i}: Solver returned Map but mapped traits are empty!`,
				);
			}

			solutions.push({
				index: i,
				traits: sortedTraits,
			});
		}

		performanceMonitor.stopTimer(preSolveTimer);
		console.log(`✅ Pre-solved ${solutions.length} combinations.`);

		// 2. Schedule solved traits as batches to the worker pool for rendering
		const scheduler = new TraitBatchScheduler({
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription,
			metadataStandard,
			extraData,
			onMessage: messageHandler
				? (data) => {
						if (messageHandler) messageHandler(data);
					}
				: undefined,
		});
		await scheduler.scheduleBatches(solutions);

		performanceMonitor.stopTimer(timerId);
	} catch (error) {
		performanceMonitor.stopTimer(timerId, { error: String(error) });
		console.error("Generation failure:", error);
		if (messageHandler) {
			messageHandler({
				type: "error",
				payload: {
					message:
						error instanceof Error
							? error.message
							: "Failed to generate collection",
				},
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
