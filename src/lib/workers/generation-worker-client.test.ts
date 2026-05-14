import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import type { TransferrableLayer, TransferrableTrait } from '$lib/types/worker-messages';

// Mock dependencies before importing the module under test
vi.mock('./pool', () => ({
	initializeWorkerPool: vi.fn().mockResolvedValue(undefined),
	setMessageCallback: vi.fn(),
	terminateWorkerPool: vi.fn().mockResolvedValue(undefined),
	getWorkerPoolStatus: vi.fn().mockReturnValue({
		totalWorkers: 2,
		availableWorkers: 2,
		queuedTasks: 0,
		activeTasks: 0
	}),
	postMessageToPool: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('./trait-batch-scheduler', () => {
	const mockScheduleBatches = vi.fn().mockResolvedValue(undefined);
	class MockTraitBatchScheduler {
		scheduleBatches = mockScheduleBatches;
	}
	return {
		TraitBatchScheduler: MockTraitBatchScheduler,
		__mockScheduleBatches: mockScheduleBatches
	};
});

vi.mock('$lib/services/export.service', () => ({
	startStreamingZip: vi.fn(),
	addStreamingChunk: vi.fn(),
	finalizeStreamingZip: vi.fn().mockResolvedValue(undefined),
	cancelStreamingZip: vi.fn()
}));

import {
	solveOnMainThread,
	runGeneration,
	type GenerationConfig,
	type GenerationCallbacks
} from './generation.orchestrator';
import { setFeatureFlags } from '$lib/config/feature-flags';

function makeLayer(id: string, name: string, traits: TransferrableTrait[]): TransferrableLayer {
	return {
		id: id as TransferrableLayer['id'],
		name,
		order: 0,
		traits: traits.map((t) => ({
			...t,
			imageData: new ArrayBuffer(4)
		}))
	};
}

function makeTrait(id: string, name: string): TransferrableTrait {
	return {
		id: id as TransferrableTrait['id'],
		name,
		imageData: new ArrayBuffer(4),
		rarityWeight: 1,
		type: 'normal'
	};
}

describe('solveOnMainThread', () => {
	it('produces exactly collectionSize unique solutions for simple layers', async () => {
		const layers = [
			makeLayer('L1', 'BG', [makeTrait('T1', 'Red'), makeTrait('T2', 'Blue')]),
			makeLayer('L2', 'Eyes', [makeTrait('T3', 'Open'), makeTrait('T4', 'Closed')])
		];

		const solutions = await solveOnMainThread(layers, 4);

		expect(solutions.length).toBe(4);
		const seen = new Set<string>();
		for (const sol of solutions) {
			const key = sol.traits.map((t) => `${t.layerId}:${t.trait.id}`).join('|');
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			expect(sol.traits.length).toBe(2);
		}
	});

	it('throws when collectionSize exceeds possible combinations', async () => {
		const layers = [makeLayer('L1', 'BG', [makeTrait('T1', 'Red')])];
		await expect(solveOnMainThread(layers, 10)).rejects.toThrow(
			/Exhausted all possible valid unique combinations/
		);
	});

	it('handles single layer with multiple traits', async () => {
		const layers = [
			makeLayer('L1', 'BG', [
				makeTrait('T1', 'Red'),
				makeTrait('T2', 'Blue'),
				makeTrait('T3', 'Green')
			])
		];
		const solutions = await solveOnMainThread(layers, 3);
		expect(solutions.length).toBe(3);
		const ids = solutions.map((s) => s.traits[0].trait.id).sort();
		expect(ids).toEqual(['T1', 'T2', 'T3']);
	});

	it('handles empty layers gracefully', async () => {
		const layers: TransferrableLayer[] = [];
		await expect(solveOnMainThread(layers, 0)).resolves.toEqual([]);
	});

	it('returns 1 solution for collectionSize 1', async () => {
		const layers = [makeLayer('L1', 'BG', [makeTrait('T1', 'Red')])];
		const solutions = await solveOnMainThread(layers, 1);
		expect(solutions.length).toBe(1);
		expect(solutions[0].traits[0].trait.id).toBe('T1');
	});
});

describe('runGeneration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setFeatureFlags({ enableStreamingStorage: false });
	});

	function noopCallbacks(): GenerationCallbacks {
		return {
			onProgress: vi.fn(),
			onPreview: vi.fn(),
			onComplete: vi.fn(),
			onError: vi.fn(),
			onCancelled: vi.fn()
		};
	}

	it('calls initializeWorkerPool on start', async () => {
		const { initializeWorkerPool, getWorkerPoolStatus } = await import('./pool');
		(getWorkerPoolStatus as ReturnType<typeof vi.fn>).mockReturnValue(null);

		const config: GenerationConfig = {
			layers: [makeLayer('L1', 'BG', [makeTrait('T1', 'Red')])],
			collectionSize: 1,
			outputSize: { width: 100, height: 100 },
			projectName: 'test',
			projectDescription: 'desc'
		};

		await runGeneration(config, noopCallbacks());
		expect(initializeWorkerPool).toHaveBeenCalled();
	});

	it('calls onError when collectionSize exceeds possible combinations', async () => {
		const callbacks = noopCallbacks();

		const config: GenerationConfig = {
			layers: [makeLayer('L1', 'BG', [makeTrait('T1', 'Red')])],
			collectionSize: 999,
			outputSize: { width: 100, height: 100 },
			projectName: 'test',
			projectDescription: 'desc'
		};

		// runGeneration wraps operations in recoverableWorkerOperation which
		// retries then throws after exhausting attempts
		try {
			await runGeneration(config, callbacks);
		} catch {
			// Expected — retry wrapper exhausted
		}

		expect(callbacks.onError).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining('Exhausted')
			})
		);
	});
});
