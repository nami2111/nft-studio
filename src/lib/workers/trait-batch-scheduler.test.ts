/**
 * TraitBatchScheduler — ref-mode tests.
 *
 * Core behavior change introduced with #1: layers are initialized once per
 * worker via registerLayersPayload, and batches are dispatched as
 * `batch-ref` carrying only trait refs (no imageData) instead of full
 * `batch` payloads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraitBatchScheduler } from './trait-batch-scheduler';
import type { BatchRefMessage, TransferrableLayer } from '$lib/types/worker-messages';
import { unsafeCreateLayerId, unsafeCreateTraitId } from '$lib/types/ids';
import * as pool from './pool';

vi.mock('./pool');

function makeLayers(): TransferrableLayer[] {
	return [
		{
			id: unsafeCreateLayerId('layer-1'),
			name: 'Background',
			order: 0,
			traits: [
				{
					id: unsafeCreateTraitId('trait-1'),
					name: 'Blue',
					imageData: new ArrayBuffer(8),
					rarityWeight: 5
				},
				{
					id: unsafeCreateTraitId('trait-2'),
					name: 'Red',
					imageData: new ArrayBuffer(8),
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
					imageData: new ArrayBuffer(8),
					rarityWeight: 5
				},
				{
					id: unsafeCreateTraitId('trait-4'),
					name: 'Dog',
					imageData: new ArrayBuffer(8),
					rarityWeight: 5
				}
			]
		}
	];
}

function makeSolutions(count: number) {
	const layers = makeLayers();
	const solutions = [];
	for (let i = 0; i < count; i++) {
		solutions.push({
			index: i,
			traits: layers.map((layer) => ({
				layerId: layer.id,
				trait: layer.traits[i % layer.traits.length]!
			}))
		});
	}
	return solutions;
}

describe('TraitBatchScheduler', () => {
	const workerCount = 2;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(pool.getWorkerPoolStatus).mockReturnValue({
			totalWorkers: workerCount,
			availableWorkers: workerCount,
			queuedTasks: 0,
			activeTasks: 0,
			workerHealth: [],
			workerStats: []
		});
		vi.mocked(pool.registerLayersPayload).mockReturnValue([Promise.resolve(), Promise.resolve()]);
		vi.mocked(pool.postMessageToPool).mockResolvedValue(undefined);
	});

	it('registers full layers once before dispatching any ref-batch', async () => {
		const scheduler = new TraitBatchScheduler({
			layers: makeLayers(),
			collectionSize: 4,
			outputSize: { width: 100, height: 100 },
			projectName: 'Test',
			projectDescription: 'Test'
		});

		await scheduler.scheduleBatches(makeSolutions(4));

		expect(pool.registerLayersPayload).toHaveBeenCalledTimes(1);
		const payload = vi.mocked(pool.registerLayersPayload).mock.calls[0]![0];
		// Layers carry imageData so workers can build their reference maps.
		expect(payload.layers[0].traits[0]).toHaveProperty('imageData');

		// registerLayersPayload must run before any batch is dispatched.
		const initOrder = vi.mocked(pool.registerLayersPayload).mock.invocationCallOrder[0]!;
		const batchOrder = vi.mocked(pool.postMessageToPool).mock.invocationCallOrder[0]!;
		expect(initOrder).toBeLessThan(batchOrder);
	});

	it('dispatches batch-ref messages carrying trait refs only (no imageData)', async () => {
		const scheduler = new TraitBatchScheduler({
			layers: makeLayers(),
			collectionSize: 4,
			outputSize: { width: 100, height: 100 },
			projectName: 'Test',
			projectDescription: 'Test'
		});

		await scheduler.scheduleBatches(makeSolutions(4));

		const calls = vi.mocked(pool.postMessageToPool).mock.calls;
		expect(calls.length).toBeGreaterThan(0);

		for (const [message] of calls) {
			expect(message.type).toBe('batch-ref');
			const payload = (message as BatchRefMessage).payload;

			for (const solution of payload.solutions) {
				// Every solution trait is a lightweight ref, never a buffer.
				expect(solution.traitRefs.length).toBe(2);
				for (const ref of solution.traitRefs) {
					expect(ref).toEqual({ layerId: expect.any(String), traitId: expect.any(String) });
					expect(ref).not.toHaveProperty('imageData');
				}
			}
		}
	});
});
