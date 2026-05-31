import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runGeneration, cancelGeneration } from './generation.orchestrator';
import type { GenerationConfig, GenerationCallbacks } from './generation.orchestrator';
import * as pool from './pool';
import * as projectDomain from '$lib/domain/project.domain';
import { CSPSolver } from './csp-solver';
import { unsafeCreateLayerId, unsafeCreateTraitId } from '$lib/types/ids';
import type { Layer } from '$lib/types/layer';

vi.mock('./pool');
vi.mock('$lib/domain/project.domain');
vi.mock('./csp-solver');
vi.mock('./result-streamer', () => ({
	createResultStreamer: vi.fn(() => ({
		start: vi.fn().mockResolvedValue(undefined),
		addResult: vi.fn(),
		finalize: vi.fn().mockResolvedValue({ images: [], metadata: [] }),
		cancel: vi.fn()
	}))
}));

describe('generation.orchestrator', () => {
	let mockCallbacks: GenerationCallbacks;
	let mockConfig: GenerationConfig;
	let mockLayers: Layer[];

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
	});

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
			expect(mockCallbacks.onComplete).toHaveBeenCalled();
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

	describe('cancelGeneration', () => {
		it('terminates pool', () => {
			cancelGeneration();
			expect(pool.terminateWorkerPool).toHaveBeenCalled();
		});
	});
});
