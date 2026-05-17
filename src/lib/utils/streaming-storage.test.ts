import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { setStorageBackendForTesting } from '$lib/storage/backend';
import { createMemoryStorageBackend } from '$lib/storage/memory';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import {
	clearSession,
	iterateBySize,
	streamBatch,
	waitForSessionWrites
} from './streaming-storage';

function buffer(bytes: number, fill = 1): ArrayBuffer {
	return new Uint8Array(Array.from({ length: bytes }, () => fill)).buffer;
}

describe('streaming storage', () => {
	let backend: ObjectStorageBackend;

	beforeEach(() => {
		backend = createMemoryStorageBackend();
		setStorageBackendForTesting(backend);
	});

	afterEach(async () => {
		setStorageBackendForTesting(null);
	});

	it('streams images and metadata in index order', async () => {
		await streamBatch(
			'session-a',
			2,
			[
				{ name: '3.png', imageData: buffer(3, 3) },
				{ name: '4.png', imageData: buffer(4, 4) }
			],
			[
				{ name: '3.json', data: { id: 3 } },
				{ name: '4.json', data: { id: 4 } }
			]
		);
		await streamBatch(
			'session-a',
			0,
			[
				{ name: '1.png', imageData: buffer(1, 1) },
				{ name: '2.png', imageData: buffer(2, 2) }
			],
			[
				{ name: '1.json', data: { id: 1 } },
				{ name: '2.json', data: { id: 2 } }
			]
		);

		const batches: Array<{ imageNames: string[]; metadataNames: string[] }> = [];
		await iterateBySize('session-a', 100, async (batch) => {
			batches.push({
				imageNames: batch.images.map((img) => img.name),
				metadataNames: batch.metadata.map((meta) => meta.name)
			});
		});

		expect(batches).toEqual([
			{
				imageNames: ['1.png', '2.png', '3.png', '4.png'],
				metadataNames: ['1.json', '2.json', '3.json', '4.json']
			}
		]);
	});

	it('splits batches by target byte size', async () => {
		await streamBatch(
			'session-b',
			0,
			[
				{ name: '1.png', imageData: buffer(4) },
				{ name: '2.png', imageData: buffer(4) },
				{ name: '3.png', imageData: buffer(4) }
			],
			[]
		);

		const batches: Array<{ count: number; total: number; names: string[] }> = [];
		await iterateBySize('session-b', 8, async (batch, _batchIndex, total) => {
			batches.push({
				count: batch.images.length,
				total,
				names: batch.images.map((img) => img.name)
			});
		});

		expect(batches).toEqual([
			{ count: 2, total: 2, names: ['1.png', '2.png'] },
			{ count: 1, total: 2, names: ['3.png'] }
		]);
	});

	it('tolerates missing metadata records', async () => {
		await streamBatch(
			'session-c',
			0,
			[
				{ name: '1.png', imageData: buffer(2) },
				{ name: '2.png', imageData: buffer(2) }
			],
			[{ name: '1.json', data: { id: 1 } }]
		);

		const batches: Array<{ imageNames: string[]; metadataNames: string[] }> = [];
		await iterateBySize('session-c', 100, async (batch) => {
			batches.push({
				imageNames: batch.images.map((img) => img.name),
				metadataNames: batch.metadata.map((meta) => meta.name)
			});
		});

		expect(batches).toEqual([{ imageNames: ['1.png', '2.png'], metadataNames: ['1.json'] }]);
	});

	it('clears a session tree', async () => {
		await streamBatch(
			'session-d',
			0,
			[{ name: '1.png', imageData: buffer(2) }],
			[{ name: '1.json', data: { id: 1 } }]
		);
		await waitForSessionWrites('session-d');

		expect(await backend.binary.exists(storagePaths.generationImage('session-d', 0))).toBe(true);
		expect(await backend.json.readJson(storagePaths.generationMetadata('session-d', 0))).toEqual({
			name: '1.json',
			data: { id: 1 }
		});

		await clearSession('session-d');

		expect(await backend.binary.exists(storagePaths.generationImage('session-d', 0))).toBe(false);
		expect(await backend.json.readJson(storagePaths.generationMetadata('session-d', 0))).toBeNull();
		expect(
			await backend.json.readJson(storagePaths.generationSessionManifest('session-d'))
		).toBeNull();
	});
});
