import type { StrictPairConfig } from '$lib/types/layer';
import type {
	CancelledMessage,
	CompleteMessage,
	ErrorMessage,
	PreviewMessage,
	ProgressMessage,
	TransferrableLayer,
	TransferrableTrait
} from '$lib/types/worker-messages';
import { isFlagEnabled } from '$lib/config/feature-flags';
import { performanceMonitor } from '$lib/utils/performance-monitor';
import { CSPSolver } from './csp-solver';
import { TraitBatchScheduler } from './trait-batch-scheduler';
import { initializeWorkerPool, setMessageCallback, terminateWorkerPool } from './worker.pool';

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

function stripLayersForSolver(
	layers: TransferrableLayer[]
): { id: string; name: string; order: number; isOptional?: boolean; traits: unknown[] }[] {
	return layers.map((layer) => ({
		id: layer.id,
		name: layer.name,
		order: layer.order,
		isOptional: layer.isOptional,
		traits: layer.traits.map((trait) => ({
			id: trait.id,
			name: trait.name,
			rarityWeight: trait.rarityWeight,
			type: trait.type,
			rulerRules: trait.rulerRules
		}))
	}));
}

async function solveOnMainThread(
	layers: TransferrableLayer[],
	collectionSize: number,
	strictPairConfig?: StrictPairConfig
): Promise<{ index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[]> {
	const usedCombinations = new Map<string, Set<bigint>>();

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
	const solutions: { index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[] =
		[];

	if (import.meta.env.DEV) console.log(`🚀 Pre-solving ${collectionSize} unique combinations...`);
	const preSolveTimer = performanceMonitor.startTimer('generation.preSolve');

	for (let i = 0; i < collectionSize; i++) {
		const solutionMap = solver.solve();
		if (!solutionMap) {
			throw new Error(`Exhausted all possible valid unique combinations at item ${i + 1}.`);
		}

		solver.markCombinationAsUsed();

		const sortedTraits = Array.from(solutionMap.entries())
			.map(([layerId, trait]) => {
				const layer = layers.find((l) => l.id === layerId);
				return {
					layerId,
					trait: {
						id: trait.id,
						name: trait.name,
						imageData: trait.imageData,
						rarityWeight: trait.rarityWeight,
						type: trait.type,
						rulerRules: trait.rulerRules
							? trait.rulerRules.map((r) => ({
									layerId: r.layerId,
									allowedTraitIds: [...r.allowedTraitIds],
									forbiddenTraitIds: [...r.forbiddenTraitIds]
								}))
							: undefined
					},
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
	if (import.meta.env.DEV) console.log(`✅ Pre-solved ${solutions.length} combinations.`);
	return solutions;
}

async function solveInWorker(
	layers: TransferrableLayer[],
	collectionSize: number,
	strictPairConfig?: StrictPairConfig
): Promise<{ index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[]> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./csp-solver.worker.ts', import.meta.url), {
			type: 'module'
		});

		const solutions: { index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[] =
			[];
		const strippedLayers = stripLayersForSolver(layers);

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

		worker.postMessage({
			type: 'solve',
			payload: {
				layers: strippedLayers,
				collectionSize,
				strictPairConfig: activeStrictPairConfig
			}
		});

		worker.onmessage = (e: MessageEvent) => {
			const data = e.data;
			if (data.type === 'chunk') {
				for (const s of data.payload.solutions as {
					index: number;
					traits: { layerId: string; traitId: string; traitName: string }[];
				}[]) {
					const resolvedTraits = s.traits.map((t) => {
						const layer = layers.find((l) => l.id === t.layerId);
						const trait = layer?.traits.find((tr) => tr.id === t.traitId);
						return {
							layerId: t.layerId,
							trait: trait
								? {
										id: trait.id,
										name: trait.name,
										imageData: trait.imageData,
										rarityWeight: trait.rarityWeight,
										type: trait.type,
										rulerRules: trait.rulerRules
											? trait.rulerRules.map((r) => ({
													layerId: r.layerId,
													allowedTraitIds: [...r.allowedTraitIds],
													forbiddenTraitIds: [...r.forbiddenTraitIds]
												}))
											: undefined
									}
								: ({ id: t.traitId, name: t.traitName } as TransferrableTrait)
						};
					});
					solutions.push({ index: s.index, traits: resolvedTraits });
				}
			} else if (data.type === 'complete') {
				worker.terminate();
				resolve(solutions);
			} else if (data.type === 'error') {
				worker.terminate();
				reject(new Error(data.payload?.message || 'Solver worker error'));
			} else if (data.type === 'cancelled') {
				worker.terminate();
				reject(new Error('Solver cancelled'));
			}
		};

		worker.onerror = (err) => {
			worker.terminate();
			reject(new Error(err.message || 'Solver worker failed'));
		};
	});
}

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
		let solutions: { index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[];

		if (isFlagEnabled('enableWorkerCspSolver')) {
			try {
				solutions = await solveInWorker(layers, collectionSize, strictPairConfig);
			} catch (workerError) {
				console.warn('CSP solver worker failed, falling back to main thread:', workerError);
				solutions = await solveOnMainThread(layers, collectionSize, strictPairConfig);
			}
		} else {
			solutions = await solveOnMainThread(layers, collectionSize, strictPairConfig);
		}

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
				: undefined
		});
		await scheduler.scheduleBatches(solutions);

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

export async function cancelGeneration(): Promise<void> {
	// Terminate all workers in the pool and await cleanup
	await terminateWorkerPool();

	// Re-initialize for future use
	await initializeWorkerPool();
}
