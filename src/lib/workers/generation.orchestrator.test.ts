import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { runGeneration, cancelGeneration, parseIndexFromName } from './generation.orchestrator';
import type { GenerationConfig, GenerationCallbacks } from './generation.orchestrator';
import { createResultStreamer, type ResultStreamer } from './result-streamer';
import * as pool from './pool';
import * as projectDomain from '$lib/domain/project.domain';
import { CSPSolver } from './csp-solver';
import { addStreamingChunk } from '$lib/services/export.service';
import { streamBatch } from '$lib/utils/streaming-storage';
import { setFeatureFlags, resetFeatureFlags } from '$lib/config/feature-flags';
import { unsafeCreateLayerId, unsafeCreateTraitId } from '$lib/types/ids';
import type { Layer } from '$lib/types/layer';

vi.mock('./pool');
vi.mock('$lib/domain/project.domain');
vi.mock('./csp-solver');
vi.mock('$lib/services/export.service', () => ({
	addStreamingChunk: vi.fn()
}));
vi.mock('$lib/utils/streaming-storage', () => ({
	streamBatch: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('./result-streamer', () => ({
	createResultStreamer: vi.fn(() => ({
		mode: 'zip-stream',
		sessionId: 'test-session',
		start: vi.fn(),
		finalize: vi.fn().mockResolvedValue(undefined),
		cancel: vi.fn()
	}))
}));

describe('generation.orchestrator', () => {
	let mockCallbacks: GenerationCallbacks;
	let mockConfig: GenerationConfig;
	let mockLayers: Layer[];

	// The orchestrator registers its pool→session bridge with `setMessageCallback`
	// exactly once at module load. Capture that reference before any test clears
	// mocks, then drive it directly to simulate worker messages.
	let poolBridge: (data: unknown) => void;

	beforeAll(() => {
		poolBridge = vi.mocked(pool.setMessageCallback).mock.calls[0]?.[0] as (data: unknown) => void;
	});

	beforeEach(() => {
		mockCallbacks = {
			onProgress: vi.fn(),
			onPreview: vi.fn(),
			onComplete: vi.fn(),
			onError: vi.fn(),
			onCancelled: vi.fn()
		};

		mockLayers = [
			{
				id: unsafeCreateLayerId('layer-1'),
				name: 'Background',
				order: 0,
				traits: [
					{
						id: unsafeCreateTraitId('trait-1'),
						name: 'Blue',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					},
					{
						id: unsafeCreateTraitId('trait-2'),
						name: 'Red',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					}
				]
			},
			{
				id: unsafeCreateLayerId('layer-2'),
				name: 'Character',
				order: 1,
				traits: [
					{
						id: unsafeCreateTraitId('trait-3'),
						name: 'Cat',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					},
					{
						id: unsafeCreateTraitId('trait-4'),
						name: 'Dog',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					}
				]
			}
		];

		mockConfig = {
			layers: mockLayers,
			collectionSize: 4,
			outputSize: { width: 500, height: 500 },
			projectName: 'Test Collection',
			projectDescription: 'Test Description'
		};

		vi.mocked(pool.getWorkerPoolStatus).mockReturnValue({
			totalWorkers: 4,
			availableWorkers: 4,
			queuedTasks: 0,
			activeTasks: 0,
			workerHealth: [],
			workerStats: [],
			complexityBreakdown: { low: 0, medium: 0, high: 0, veryHigh: 0 }
		});

		vi.mocked(projectDomain.prepareLayersForWorker).mockResolvedValue([
			{
				id: unsafeCreateLayerId('layer-1'),
				name: 'Background',
				order: 0,
				traits: [
					{
						id: unsafeCreateTraitId('trait-1'),
						name: 'Blue',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					},
					{
						id: unsafeCreateTraitId('trait-2'),
						name: 'Red',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					}
				]
			},
			{
				id: unsafeCreateLayerId('layer-2'),
				name: 'Character',
				order: 1,
				traits: [
					{
						id: unsafeCreateTraitId('trait-3'),
						name: 'Cat',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					},
					{
						id: unsafeCreateTraitId('trait-4'),
						name: 'Dog',
						imageData: new ArrayBuffer(100),
						rarityWeight: 5
					}
				]
			}
		]);

		const mockSolution = new Map<string, any>();
		mockSolution.set(unsafeCreateLayerId('layer-1'), {
			id: unsafeCreateTraitId('trait-1'),
			name: 'Blue',
			imageData: new ArrayBuffer(100),
			rarityWeight: 5
		});
		mockSolution.set(unsafeCreateLayerId('layer-2'), {
			id: unsafeCreateTraitId('trait-3'),
			name: 'Cat',
			imageData: new ArrayBuffer(100),
			rarityWeight: 5
		});

		vi.mocked(CSPSolver.prototype.solve).mockReturnValue(mockSolution);

		vi.mocked(pool.postMessageToPool).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
		resetFeatureFlags();
	});

	/** Build a mock streamer with the requested mode (default zip-stream). */
	function mockStreamer(
		overrides: Partial<Pick<ResultStreamer, 'mode'>> & {
			finalize?: ReturnType<typeof vi.fn>;
			cancel?: ReturnType<typeof vi.fn>;
		} = {}
	): ResultStreamer {
		return {
			mode: 'zip-stream',
			sessionId: 'test-session',
			start: vi.fn(),
			finalize: vi.fn().mockResolvedValue(undefined),
			cancel: vi.fn(),
			...overrides
		} as unknown as ResultStreamer;
	}

	describe('runGeneration', () => {
		it('runs happy path: prepares layers, solves CSP, dispatches tasks', async () => {
			const promise = runGeneration(mockConfig, mockCallbacks);

			// Simulate worker completion
			setTimeout(() => {
				const messageCallback = vi.mocked(pool.setMessageCallback).mock.calls[0]?.[0];
				if (messageCallback) {
					messageCallback({
						type: 'complete',
						taskId: 'test-task-id' as any,
						payload: { images: [], metadata: [] }
					});
				}
			}, 10);

			await promise;

			expect(projectDomain.prepareLayersForWorker).toHaveBeenCalledWith(mockLayers);
			expect(CSPSolver.prototype.solve).toHaveBeenCalled();
			expect(pool.postMessageToPool).toHaveBeenCalled();
			expect(mockCallbacks.onComplete).toHaveBeenCalledTimes(1);
		});

		it('initializes worker pool if not running', async () => {
			vi.mocked(pool.getWorkerPoolStatus).mockReturnValue(null);

			const promise = runGeneration(mockConfig, mockCallbacks);

			setTimeout(() => {
				const messageCallback = vi.mocked(pool.setMessageCallback).mock.calls[0]?.[0];
				if (messageCallback) {
					messageCallback({
						type: 'complete',
						taskId: 'test-task-id' as any,
						payload: { images: [], metadata: [] }
					});
				}
			}, 10);

			await promise;

			expect(pool.initializeWorkerPool).toHaveBeenCalled();
		});

		it('reinitializes pool if worker count too low', async () => {
			vi.mocked(pool.getWorkerPoolStatus).mockReturnValue({
				totalWorkers: 1,
				availableWorkers: 1,
				queuedTasks: 0,
				activeTasks: 0,
				workerHealth: [],
				workerStats: [],
				complexityBreakdown: { low: 0, medium: 0, high: 0, veryHigh: 0 }
			});

			const promise = runGeneration(mockConfig, mockCallbacks);

			setTimeout(() => {
				const messageCallback = vi.mocked(pool.setMessageCallback).mock.calls[0]?.[0];
				if (messageCallback) {
					messageCallback({
						type: 'complete',
						taskId: 'test-task-id' as any,
						payload: { images: [], metadata: [] }
					});
				}
			}, 10);

			await promise;

			expect(pool.terminateWorkerPool).toHaveBeenCalled();
			expect(pool.initializeWorkerPool).toHaveBeenCalled();
		});
	});

	describe('parseIndexFromName', () => {
		it('parses trailing one-based indexes from generated filenames', () => {
			expect(parseIndexFromName('42.png')).toBe(41);
			expect(parseIndexFromName('item-42.png')).toBe(41);
			expect(parseIndexFromName('collection_0007.webp')).toBe(6);
		});

		it('falls back to 0 when no positive trailing index exists', () => {
			expect(parseIndexFromName(undefined)).toBe(0);
			expect(parseIndexFromName('item-final.png')).toBe(0);
			expect(parseIndexFromName('0.png')).toBe(0);
		});
	});

	describe('pool message routing (completion ownership)', () => {
		it('streams a chunked worker complete with isChunk but never fires user onComplete', async () => {
			// Disable streaming storage so the zip-stream branch (addStreamingChunk) is exercised.
			setFeatureFlags({ enableStreamingStorage: false });
			// Hold finalize open so we can observe the mid-run chunk before completion.
			let resolveFinalize!: () => void;
			const streamer = mockStreamer({
				mode: 'zip-stream',
				finalize: vi.fn(
					() =>
						new Promise<void>((r) => {
							resolveFinalize = r;
						})
				)
			});
			vi.mocked(createResultStreamer).mockReturnValue(streamer);

			const promise = runGeneration(mockConfig, mockCallbacks);

			// Mid-run: worker sends a chunked complete with images. Must be streamed, not completed.
			await vi.waitFor(() => expect(streamer.start).toHaveBeenCalled());
			poolBridge({
				type: 'complete',
				taskId: 'test-task-id' as any,
				payload: {
					images: [{ name: '42.png', imageData: new ArrayBuffer(4) }],
					metadata: [],
					isChunk: true,
					generatedCount: 4,
					totalCount: 4
				}
			});

			expect(addStreamingChunk).toHaveBeenCalledTimes(1);
			expect(mockCallbacks.onComplete).not.toHaveBeenCalled();

			// Release finalize so the run completes and fires onComplete exactly once.
			resolveFinalize();
			await promise;

			expect(mockCallbacks.onComplete).toHaveBeenCalledTimes(1);
		});

		it('streams an intermediate chunk message without firing onComplete', async () => {
			setFeatureFlags({ enableStreamingStorage: false });
			let resolveFinalize!: () => void;
			const streamer = mockStreamer({
				mode: 'zip-stream',
				finalize: vi.fn(
					() =>
						new Promise<void>((r) => {
							resolveFinalize = r;
						})
				)
			});
			vi.mocked(createResultStreamer).mockReturnValue(streamer);

			const promise = runGeneration(mockConfig, mockCallbacks);

			await vi.waitFor(() => expect(streamer.start).toHaveBeenCalled());
			poolBridge({
				type: 'chunk',
				taskId: 'test-task-id' as any,
				payload: {
					images: [{ name: '1.png', imageData: new ArrayBuffer(4) }],
					metadata: [],
					generatedCount: 1,
					totalCount: 4
				}
			});

			expect(addStreamingChunk).toHaveBeenCalledTimes(1);
			expect(mockCallbacks.onComplete).not.toHaveBeenCalled();

			resolveFinalize();
			await promise;

			expect(mockCallbacks.onComplete).toHaveBeenCalledTimes(1);
		});

		it('routes chunk messages to streamBatch when streaming storage is enabled', async () => {
			setFeatureFlags({ enableStreamingStorage: true });
			let resolveFinalize!: () => void;
			const streamer = mockStreamer({
				mode: 'storage-stream',
				finalize: vi.fn(
					() =>
						new Promise<void>((r) => {
							resolveFinalize = r;
						})
				)
			});
			vi.mocked(createResultStreamer).mockReturnValue(streamer);

			const promise = runGeneration(mockConfig, mockCallbacks);

			await vi.waitFor(() => expect(streamer.start).toHaveBeenCalled());
			poolBridge({
				type: 'chunk',
				taskId: 'test-task-id' as any,
				payload: {
					images: [{ name: '3.png', imageData: new ArrayBuffer(4) }],
					metadata: [],
					generatedCount: 3,
					totalCount: 4
				}
			});

			expect(streamBatch).toHaveBeenCalledWith(
				expect.any(String),
				2,
				expect.arrayContaining([expect.objectContaining({ name: '3.png' })]),
				expect.any(Array)
			);
			expect(addStreamingChunk).not.toHaveBeenCalled();

			resolveFinalize();
			await promise;
		});
	});

	describe('cancelGeneration', () => {
		it('terminates pool', () => {
			cancelGeneration();
			expect(pool.terminateWorkerPool).toHaveBeenCalled();
		});

		it('cancels the active session streamer and fires onCancelled exactly once', async () => {
			// Keep finalize pending so the session stays active until we cancel.
			let resolveFinalize!: () => void;
			const streamer = mockStreamer({
				finalize: vi.fn(
					() =>
						new Promise<void>((r) => {
							resolveFinalize = r;
						})
				)
			});
			vi.mocked(createResultStreamer).mockReturnValue(streamer);

			const promise = runGeneration(mockConfig, mockCallbacks);
			await vi.waitFor(() => expect(streamer.start).toHaveBeenCalled());

			await cancelGeneration();

			expect(streamer.cancel).toHaveBeenCalled();
			expect(mockCallbacks.onCancelled).toHaveBeenCalledTimes(1);

			// Release the held run. Cancellation must not turn into completion or error.
			resolveFinalize();
			await promise;

			expect(mockCallbacks.onComplete).not.toHaveBeenCalled();
			expect(mockCallbacks.onError).not.toHaveBeenCalled();
		});

		it('swallows worker-pool termination errors after cancellation', async () => {
			let rejectPoolTask!: (error: Error) => void;
			vi.mocked(pool.postMessageToPool).mockImplementation(
				() =>
					new Promise((_, reject) => {
						rejectPoolTask = reject;
					})
			);

			const promise = runGeneration(mockConfig, mockCallbacks);
			await vi.waitFor(() => expect(pool.postMessageToPool).toHaveBeenCalled());

			await cancelGeneration();
			rejectPoolTask(new Error('Worker pool terminated'));
			await promise;

			expect(mockCallbacks.onCancelled).toHaveBeenCalledTimes(1);
			expect(mockCallbacks.onComplete).not.toHaveBeenCalled();
			expect(mockCallbacks.onError).not.toHaveBeenCalled();
		});
	});
});
