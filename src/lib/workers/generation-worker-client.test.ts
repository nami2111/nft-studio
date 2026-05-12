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

// Streamlined mock: TraitBatchScheduler is imported in the client but we want to
// intercept its scheduleBatches. We mock the constructor + method via module mocking.
vi.mock('./trait-batch-scheduler', () => {
	const mockScheduleBatches = vi.fn().mockResolvedValue(undefined);
	return {
		TraitBatchScheduler: vi.fn().mockImplementation(() => ({
			scheduleBatches: mockScheduleBatches
		})),
		__mockScheduleBatches: mockScheduleBatches
	};
});

import { solveOnMainThread, startGeneration } from './generation.worker.client';
import { setFeatureFlags } from '$lib/config/feature-flags';

function makeLayer(id: string, name: string, traits: TransferrableTrait[]): TransferrableLayer {
	return {
		id,
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
		id,
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
		// All should have unique trait combinations
		const seen = new Set<string>();
		for (const sol of solutions) {
			const key = sol.traits.map((t) => `${t.layerId}:${t.trait.id}`).join('|');
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			// Each solution should have 2 traits (one per layer)
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
		// CSP solver needs at least one layer with traits to produce solutions
		await expect(solveOnMainThread(layers, 0)).resolves.toEqual([]);
	});

	it('returns 1 solution for collectionSize 1', async () => {
		const layers = [makeLayer('L1', 'BG', [makeTrait('T1', 'Red')])];

		const solutions = await solveOnMainThread(layers, 1);
		expect(solutions.length).toBe(1);
		expect(solutions[0].traits[0].trait.id).toBe('T1');
	});
});

describe('startGeneration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Force main thread solving for test environment (Worker constructor unavailable)
		setFeatureFlags({ enableWorkerCspSolver: false });
	});

	it('calls initializeWorkerPool on start', async () => {
		const { initializeWorkerPool } = await import('./pool');

		const layers = [makeLayer('L1', 'BG', [makeTrait('T1', 'Red')])];

		// startGeneration will call solveOnMainThread (via worker fallback)
		// then scheduleBatches. Since we mock postMessageToPool already,
		// the scheduler will work, but the actual CSP solver is real.
		// For 1 layer × 1 trait, there's only 1 unique combination so it works.
		await startGeneration(layers, 1, { width: 100, height: 100 }, 'test', 'desc');

		expect(initializeWorkerPool).toHaveBeenCalled();
	});

	it('handles generation errors by calling messageHandler with error', async () => {
		const layers = [makeLayer('L1', 'BG', [makeTrait('T1', 'Red')])];

		const onMessage = vi.fn();

		// Request more solutions than possible — should trigger error path
		await startGeneration(
			layers,
			999,
			{ width: 100, height: 100 },
			'test',
			'desc',
			undefined,
			undefined,
			undefined,
			onMessage
		);

		expect(onMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'error',
				payload: expect.objectContaining({
					message: expect.stringContaining('Exhausted')
				})
			})
		);
	});
});
