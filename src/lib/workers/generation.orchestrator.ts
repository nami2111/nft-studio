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
import { recoverableWorkerOperation, recoverableFileOperation } from '$lib/utils/error-handler';
import { CSPSolver } from './csp-solver';
import { TraitBatchScheduler } from './trait-batch-scheduler';
import {
	initializeWorkerPool,
	setMessageCallback,
	terminateWorkerPool,
	getWorkerPoolStatus
} from './pool';
import {
	startStreamingZip,
	addStreamingChunk,
	finalizeStreamingZip,
	cancelStreamingZip,
	packageFromStorageBySize
} from '$lib/services/export.service';
import { isFlagEnabled } from '$lib/config/feature-flags';
import {
	streamBatch,
	clearSession,
	cleanupStaleGenerationSessions
} from '$lib/utils/streaming-storage';

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

// ─── Session-scoped mutable state ─────────────────────────────

/** Active ZIP streaming session ID — null when not streaming */
let _activeStreamingSession: string | null = null;
let _activeProjectName = 'collection';

/** Current message callback set via setMessageCallback so the pool can forward */
let _activeCallbacks: GenerationCallbacks | null = null;

/** Storage streaming state — used when enableStreamingStorage is on */
let _useStreamingStorage = false;
let _storageSessionId: string | null = null;

// Bridge from pool → orchestrator
setMessageCallback((data) => {
	if (_activeCallbacks) {
		routePoolMessage(data, _activeCallbacks);
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
	return recoverableWorkerOperation(
		async () => {
			const timerId = performanceMonitor.startTimer('generation.runGeneration');

			// 1 ─ Prepare layers for workers
			const transferrableLayers = await recoverableFileOperation(
				async () => prepareLayersForWorker(config.layers),
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
			const sessionId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			_activeCallbacks = callbacks;
			_activeProjectName = config.projectName || 'collection';
			_useStreamingStorage = isFlagEnabled('enableStreamingStorage');
			_storageSessionId = sessionId;
			if (_useStreamingStorage) {
				void cleanupStaleGenerationSessions({ activeSessionIds: [sessionId] });
			}

			// 4 ─ Start streaming ZIP unless storage-backed packaging is active.
			if (!_useStreamingStorage) {
				startStreamingZip(sessionId, _activeProjectName);
				_activeStreamingSession = sessionId;
			}

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

				// 7 ─ Finalize
				if (_useStreamingStorage) {
					callbacks.onProgress({
						type: 'progress',
						payload: {
							generatedCount: config.collectionSize,
							totalCount: config.collectionSize,
							statusText: 'Packaging from storage...'
						}
					});

					await packageFromStorageBySize(
						_storageSessionId!,
						_activeProjectName,
						500 * 1024 * 1024,
						async (progress) => {
							callbacks.onProgress({
								type: 'progress',
								payload: {
									generatedCount: config.collectionSize,
									totalCount: config.collectionSize,
									statusText: progress.message
								}
							});
						}
					);

					clearSession(_storageSessionId!).catch(() => {});
				} else {
					callbacks.onProgress({
						type: 'progress',
						payload: {
							generatedCount: config.collectionSize,
							totalCount: config.collectionSize,
							statusText: 'Finalizing ZIP...'
						}
					});

					await finalizeStreamingZip(_activeProjectName, (progress) => {
						callbacks.onProgress({
							type: 'progress',
							payload: {
								generatedCount: config.collectionSize,
								totalCount: config.collectionSize,
								statusText: progress.message
							}
						});
					});
					_activeStreamingSession = null;
				}

				// 8 ─ Done
				performanceMonitor.stopTimer(timerId);
				callbacks.onComplete({ images: [], metadata: [] });
			} catch (error) {
				// Clean up streaming on error
				if (_activeStreamingSession) {
					cancelStreamingZip();
					_activeStreamingSession = null;
				}
				if (_useStreamingStorage && _storageSessionId) {
					clearSession(_storageSessionId).catch(() => {});
				}
				performanceMonitor.stopTimer(timerId, { error: String(error) });

				// Notify callbacks before re-throwing for retry
				const err = error instanceof Error ? error : new Error(String(error));
				callbacks.onError(err);
				throw err;
			} finally {
				_activeCallbacks = null;
				_useStreamingStorage = false;
				_storageSessionId = null;
			}
		},
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
	if (_activeStreamingSession) {
		cancelStreamingZip();
		_activeStreamingSession = null;
	}
	if (_useStreamingStorage && _storageSessionId) {
		clearSession(_storageSessionId).catch(() => {});
	}

	if (_activeCallbacks) {
		_activeCallbacks.onCancelled();
	}

	await terminateWorkerPool();
	_activeCallbacks = null;

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
			if (_activeCallbacks) {
				_activeCallbacks.onProgress({
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

function routePoolMessage(data: PoolForwardedMessage, callbacks: GenerationCallbacks): void {
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
			if (_useStreamingStorage && _storageSessionId) {
				const firstIdx = parseIndexFromName(msg.payload.images[0]?.name);
				streamBatch(
					_storageSessionId,
					firstIdx,
					msg.payload.images.map((img) => ({ name: img.name, imageData: img.imageData })),
					msg.payload.metadata || []
				).catch((err) => {
					console.warn('Storage stream failed:', err);
				});
			} else if (msg.payload.images.length > 0 && _activeStreamingSession) {
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
				if (_useStreamingStorage && _storageSessionId) {
					const firstIdx = parseIndexFromName(msg.payload.images[0]?.name);
					streamBatch(
						_storageSessionId,
						firstIdx,
						msg.payload.images.map((img) => ({ name: img.name, imageData: img.imageData })),
						(msg.payload.metadata || []) as unknown as {
							name: string;
							data: Record<string, unknown>;
						}[]
					).catch((err) => {
						console.warn('Storage stream failed:', err);
					});
				} else if (_activeStreamingSession && msg.payload.isChunk) {
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
			if (_activeStreamingSession) {
				cancelStreamingZip();
				_activeStreamingSession = null;
			}
			if (_useStreamingStorage && _storageSessionId) {
				clearSession(_storageSessionId).catch(() => {});
			}
			callbacks.onError(new Error(data.payload.message));
			break;

		case 'cancelled':
			if (_activeStreamingSession) {
				cancelStreamingZip();
				_activeStreamingSession = null;
			}
			if (_useStreamingStorage && _storageSessionId) {
				clearSession(_storageSessionId).catch(() => {});
			}
			callbacks.onCancelled();
			break;
	}
}
