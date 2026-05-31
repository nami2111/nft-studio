/**
 * Generation Orchestrator
 *
 * Single entry point for the entire generation pipeline:
 *   1. Validate & prepare layers
 *   2. Solve CSP (unique trait combinations)
 *   3. Schedule batches → Worker Pool
 *   4. Stream results → ZIP export
 *
 * Consumed by GenerationForm.svelte via simple callbacks.
 */

import type { Layer, StrictPairConfig } from '$lib/types/layer';
import type {
	CancelledMessage,
	CompleteMessage,
	ErrorMessage,
	PreviewMessage,
	ProgressMessage,
	TransferrableLayer,
	TransferrableTrait
} from '$lib/types/worker-messages';
import { MetadataStandard } from '$lib/domain/metadata/strategies';
import { prepareLayersForWorker } from '$lib/domain/project.domain';
import { performanceMonitor } from '$lib/utils/performance-monitor';
import { withRetry } from '$lib/utils/error-handler';
import { CSPSolver } from './csp-solver';
import { TraitBatchScheduler } from './trait-batch-scheduler';
import {
	initializeWorkerPool,
	setMessageCallback,
	terminateWorkerPool,
	getWorkerPoolStatus
} from './pool';
import { addStreamingChunk } from '$lib/services/export.service';
import { isFlagEnabled } from '$lib/config/feature-flags';
import { streamBatch } from '$lib/utils/streaming-storage';
import { createResultStreamer, type ResultStreamer } from './result-streamer';

// ─── Public interface ─────────────────────────────────────────

export interface GenerationCallbacks {
	/** Called on every worker progress update */
	onProgress: (msg: ProgressMessage) => void;
	/** Called when live previews are available */
	onPreview: (previews: { index: number; url: string }[]) => void;
	/** Called when generation finishes (images & metadata are already streamed to ZIP) */
	onComplete: (result: {
		images: { name: string; imageData: ArrayBuffer }[];
		metadata: { name: string; data: Record<string, unknown> }[];
	}) => void;
	/** Called on unrecoverable error */
	onError: (error: Error) => void;
	/** Called when user cancels */
	onCancelled: () => void;
}

export interface GenerationConfig {
	layers: Layer[];
	collectionSize: number;
	outputSize: { width: number; height: number };
	projectName: string;
	projectDescription: string;
	metadataStandard?: MetadataStandard;
	strictPairConfig?: StrictPairConfig;
	extraData?: Record<string, unknown>;
}

// ─── Session encapsulation ────────────────────────────────────

/**
 * Per-generation session state. Replaces the previous module-level globals
 * so cleanup is concentrated in one place. Single-session today —
 * enabling true concurrent sessions requires worker pool messages to
 * carry a session ID (deferred).
 */
class GenerationSession {
	readonly id: string;
	readonly projectName: string;
	readonly callbacks: GenerationCallbacks;
	readonly useStreamingStorage: boolean;
	streamer: ResultStreamer | null = null;

	constructor(config: GenerationConfig, callbacks: GenerationCallbacks) {
		this.id = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.projectName = config.projectName || 'collection';
		this.callbacks = callbacks;
		this.useStreamingStorage = isFlagEnabled('enableStreamingStorage');
	}

	get storageSessionId(): string {
		return this.id;
	}

	cancelStreamer(): void {
		if (this.streamer) {
			this.streamer.cancel();
			this.streamer = null;
		}
	}
}

/** Currently active session — null when not generating */
let _activeSession: GenerationSession | null = null;

// Bridge from pool → orchestrator
setMessageCallback((data) => {
	if (_activeSession) {
		routePoolMessage(data, _activeSession);
	}
});

// ─── Public API ───────────────────────────────────────────────

/**
 * Run the full generation pipeline.
 *
 * Call this once per generation session. The orchestrator handles
 * layer preparation, CSP solving, batch dispatch, ZIP streaming,
 * and routes all progress/completion/error events to the callbacks.
 */
export async function runGeneration(
	config: GenerationConfig,
	callbacks: GenerationCallbacks
): Promise<void> {
	return withRetry(
		async () => {
			const timerId = performanceMonitor.startTimer('generation.runGeneration');

			// 1 ─ Prepare layers for workers
			const transferrableLayers = await withRetry(
				async () => prepareLayersForWorker(config.layers),
				'file',
				{
					operation: 'prepareLayersForWorker',
					enableRetry: true,
					retryConfig: { maxAttempts: 3, initialDelayMs: 1000, backoffFactor: 2 }
				}
			);

			// 2 ─ Ensure worker pool has proper capacity
			const poolStatus = getWorkerPoolStatus();
			if (!poolStatus) {
				await initializeWorkerPool();
			} else if (poolStatus.totalWorkers < 2) {
				await terminateWorkerPool();
				await initializeWorkerPool();
			}

			// 3 ─ Set up session
			const session = new GenerationSession(config, callbacks);
			_activeSession = session;

			// 4 ─ Create result streamer (handles ZIP vs storage branching internally)
			const streamer = createResultStreamer({
				sessionId: session.id,
				projectName: session.projectName,
				collectionSize: config.collectionSize,
				onProgress: (event) => {
					callbacks.onProgress({
						type: 'progress',
						payload: {
							generatedCount: config.collectionSize,
							totalCount: config.collectionSize,
							statusText: event.message
						}
					});
				}
			});
			streamer.start();
			session.streamer = streamer;

			try {
				// 5 ─ Solve CSP (main-thread; single worker fallback omitted — main thread is fast enough)
				const solutions = await solveOnMainThread(
					transferrableLayers,
					config.collectionSize,
					config.strictPairConfig
				);

				// 6 ─ Schedule batches to worker pool
				const scheduler = new TraitBatchScheduler({
					layers: transferrableLayers,
					collectionSize: config.collectionSize,
					outputSize: config.outputSize,
					projectName: config.projectName,
					projectDescription: config.projectDescription,
					metadataStandard: config.metadataStandard,
					extraData: config.extraData
				});
				await scheduler.scheduleBatches(solutions);

				// 7 ─ Finalize via streamer
				await streamer.finalize();
				session.streamer = null;

				// 8 ─ Done
				performanceMonitor.stopTimer(timerId);
				callbacks.onComplete({ images: [], metadata: [] });
			} catch (error) {
				// Clean up streamer on error
				session.cancelStreamer();
				performanceMonitor.stopTimer(timerId, { error: String(error) });

				// Notify callbacks before re-throwing for retry
				const err = error instanceof Error ? error : new Error(String(error));
				callbacks.onError(err);
				throw err;
			} finally {
				_activeSession = null;
			}
		},
		'worker',
		{
			operation: 'runGeneration',
			enableRetry: true,
			retryConfig: {
				maxAttempts: 2,
				initialDelayMs: 3000,
				maxDelayMs: 10000,
				backoffFactor: 2,
				jitter: true
			},
			title: 'Generation Failed',
			description:
				'Failed to start generation. This may be due to memory limitations or worker initialization issues.'
		}
	);
}

/**
 * Cancel an in-progress generation. Terminates the worker pool
 * and re-initializes it for future use.
 */
export async function cancelGeneration(): Promise<void> {
	if (_activeSession) {
		_activeSession.cancelStreamer();
		_activeSession.callbacks.onCancelled();
		_activeSession = null;
	}

	await terminateWorkerPool();
	await initializeWorkerPool();
}

// ─── CSP Solving ──────────────────────────────────────────────

/**
 * Solve CSP on the main thread with periodic UI yield.
 * Exported for testing.
 */
export async function solveOnMainThread(
	layers: TransferrableLayer[],
	collectionSize: number,
	strictPairConfig?: StrictPairConfig
): Promise<{ index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[]> {
	const usedCombinations = new Map<string, Set<bigint | string>>();

	const activeConfig = strictPairConfig?.enabled
		? { ...strictPairConfig }
		: {
				enabled: true,
				layerCombinations: [
					{
						id: '__global__',
						layerIds: layers.map((l) => l.id),
						active: true,
						description: 'Global Uniqueness'
					}
				]
			};

	const solver = new CSPSolver(layers, usedCombinations, activeConfig);
	const solutions: { index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[] =
		[];

	const preSolveTimer = performanceMonitor.startTimer('generation.preSolve');

	for (let i = 0; i < collectionSize; i++) {
		if (i % 50 === 0) {
			if (_activeSession) {
				_activeSession.callbacks.onProgress({
					type: 'progress',
					payload: {
						generatedCount: i,
						totalCount: collectionSize,
						statusText: `Solving trait combinations (${i}/${collectionSize})...`
					}
				});
			}
			if (collectionSize >= 200) {
				await new Promise((r) => setTimeout(r, 0));
			}
		}

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
					trait: cloneTraitForSolution(trait),
					order: layer?.order || 0
				};
			})
			.sort((a, b) => a.order - b.order)
			.map(({ layerId, trait }) => ({ layerId, trait }));

		solutions.push({ index: i, traits: sortedTraits });
	}

	performanceMonitor.stopTimer(preSolveTimer);
	return solutions;
}

function cloneTraitForSolution(trait: TransferrableTrait): TransferrableTrait {
	return {
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
	};
}

// ─── Pool Message Routing ─────────────────────────────────────

/**
 * Parse the 0-based index from a generated image filename (e.g. "42.png" → 41).
 */
function parseIndexFromName(name: string | undefined): number {
	if (!name) return 0;
	const num = parseInt(name, 10);
	return Number.isNaN(num) ? 0 : num - 1;
}

/**
 * Route a message from the worker pool to the appropriate callback.
 * Handles ZIP streaming for chunk messages internally.
 */
/** All messages the pool forwards to us, including chunk which isn't in the formal union */
type PoolForwardedMessage =
	| CompleteMessage
	| ErrorMessage
	| CancelledMessage
	| ProgressMessage
	| PreviewMessage
	| {
			type: 'chunk';
			payload: {
				images: { name: string; imageData: ArrayBuffer }[];
				metadata: { name: string; data: Record<string, unknown> }[];
			};
	  };

function routePoolMessage(data: PoolForwardedMessage, session: GenerationSession): void {
	const callbacks = session.callbacks;
	switch (data.type) {
		case 'progress':
			callbacks.onProgress(data);
			break;

		case 'preview': {
			const { payload } = data as PreviewMessage;
			const previews: { index: number; url: string }[] = [];
			for (let j = 0; j < payload.indexes.length; j++) {
				const blob = new Blob([payload.previewData[j]], { type: 'image/png' });
				previews.push({ index: payload.indexes[j], url: URL.createObjectURL(blob) });
			}
			callbacks.onPreview(previews);
			break;
		}

		case 'chunk': {
			// Intermediate chunk from worker — stream directly to ZIP or storage.
			const msg = data;
			if (session.useStreamingStorage) {
				const firstIdx = parseIndexFromName(msg.payload.images[0]?.name);
				streamBatch(
					session.storageSessionId,
					firstIdx,
					msg.payload.images.map((img) => ({ name: img.name, imageData: img.imageData })),
					msg.payload.metadata || []
				).catch((err) => {
					console.warn('Storage stream failed:', err);
				});
			} else if (msg.payload.images.length > 0 && session.streamer?.mode === 'zip-stream') {
				addStreamingChunk(
					msg.payload.images.map((img) => ({ name: img.name, data: img.imageData })),
					(msg.payload.metadata || []) as unknown as {
						name: string;
						data: Record<string, unknown>;
					}[]
				);
				// Clear arrays so caller can free references
				msg.payload.images.length = 0;
			}
			break;
		}

		case 'complete': {
			// Final complete from a batch — stream remaining to ZIP or storage.
			const msg = data as CompleteMessage;
			if (msg.payload.images && msg.payload.images.length > 0) {
				if (session.useStreamingStorage) {
					const firstIdx = parseIndexFromName(msg.payload.images[0]?.name);
					streamBatch(
						session.storageSessionId,
						firstIdx,
						msg.payload.images.map((img) => ({ name: img.name, imageData: img.imageData })),
						(msg.payload.metadata || []) as unknown as {
							name: string;
							data: Record<string, unknown>;
						}[]
					).catch((err) => {
						console.warn('Storage stream failed:', err);
					});
				} else if (session.streamer?.mode === 'zip-stream' && msg.payload.isChunk) {
					addStreamingChunk(
						msg.payload.images.map((img) => ({ name: img.name, data: img.imageData })),
						(msg.payload.metadata || []) as unknown as {
							name: string;
							data: Record<string, unknown>;
						}[]
					);
					msg.payload.images.length = 0;
				}
			}
			if (!msg.payload.isChunk) {
				callbacks.onComplete({
					images: msg.payload.images || [],
					metadata: (msg.payload.metadata || []) as unknown as {
						name: string;
						data: Record<string, unknown>;
					}[]
				});
			}
			break;
		}

		case 'error':
			session.cancelStreamer();
			callbacks.onError(new Error(data.payload.message));
			break;

		case 'cancelled':
			session.cancelStreamer();
			callbacks.onCancelled();
			break;
	}
}
