import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { setStorageBackendForTesting } from '$lib/storage/backend';
import { createMemoryStorageBackend } from '$lib/storage/memory';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import type { GalleryCollection, GalleryItem } from '$lib/types/gallery';
import {
	clearAllCollections,
	deleteCollection,
	getAllCollections,
	getItemImage,
	saveCollection,
	saveItemImage
} from './gallery-storage';

function buffer(values: number[]): ArrayBuffer {
	return new Uint8Array(values).buffer;
}

function bytes(data: ArrayBuffer | null): number[] | null {
	return data ? Array.from(new Uint8Array(data)) : null;
}

function createItem(
	id: string,
	collectionId: string,
	values: number[],
	overrides: Partial<GalleryItem> = {}
): GalleryItem {
	return {
		id,
		name: id,
		description: `${id} description`,
		imageData: buffer(values),
		imageFormat: 'png',
		metadata: {
			traits: [{ layer: 'Background', trait: 'Blue', rarity: 25 }]
		},
		rarityScore: 10,
		rarityRank: 1,
		collectionId,
		generatedAt: new Date('2024-01-02T00:00:00.000Z'),
		...overrides
	};
}

function createCollection(
	id = 'collection-a',
	items: GalleryItem[] = [createItem('item-a', id, [1, 2, 3])]
): GalleryCollection {
	return {
		id,
		name: 'Collection A',
		description: 'A stored gallery collection',
		projectName: 'Project A',
		items,
		generatedAt: new Date('2024-01-01T00:00:00.000Z'),
		totalSupply: items.length
	};
}

describe('gallery storage', () => {
	let backend: ObjectStorageBackend;

	beforeEach(() => {
		backend = createMemoryStorageBackend();
		setStorageBackendForTesting(backend);
	});

	afterEach(() => {
		setStorageBackendForTesting(null);
	});

	it('saves and loads collection metadata without retaining image buffers in manifests', async () => {
		const collection = createCollection();

		await saveCollection(collection);

		const manifest = await backend.json.readJson<Record<string, unknown>>(
			storagePaths.galleryCollectionManifest(collection.id)
		);
		const manifestItems = manifest?.items as Array<Record<string, unknown>>;
		expect(manifestItems[0].imageData).toBeUndefined();
		expect(manifestItems[0].imageUrl).toBeUndefined();
		expect(manifestItems[0].isBlobUrl).toBeUndefined();

		const loaded = await getAllCollections();
		expect(loaded).toHaveLength(1);
		expect(loaded[0].id).toBe(collection.id);
		expect(loaded[0].generatedAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
		expect(loaded[0].items[0].generatedAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
		expect(loaded[0].items[0].imageData).toBeInstanceOf(ArrayBuffer);
		expect((loaded[0].items[0].imageData as ArrayBuffer).byteLength).toBe(0);
	});

	it('fetches collection images through the durable item lookup', async () => {
		const collection = createCollection();

		await saveCollection(collection);

		expect(bytes(await getItemImage('item-a'))).toEqual([1, 2, 3]);
		expect(await backend.json.readJson(storagePaths.galleryItemLookup('item-a'))).toMatchObject({
			collectionId: collection.id
		});
	});

	it('fetches streamed images before a collection manifest exists', async () => {
		await saveItemImage('item-streamed', 'collection-streamed', buffer([4, 5, 6]));

		expect(bytes(await getItemImage('item-streamed'))).toEqual([4, 5, 6]);
		expect(
			await backend.json.readJson(storagePaths.galleryItemLookup('item-streamed'))
		).toMatchObject({
			collectionId: 'collection-streamed'
		});
	});

	it('removes stale item images when a collection is rewritten', async () => {
		const itemA = createItem('item-a', 'collection-a', [1]);
		const itemB = createItem('item-b', 'collection-a', [2]);

		await saveCollection(createCollection('collection-a', [itemA, itemB]));
		await saveCollection(
			createCollection('collection-a', [
				{
					...itemA,
					imageData: new ArrayBuffer(0)
				}
			])
		);

		expect(
			await backend.binary.exists(storagePaths.galleryItemImage('collection-a', 'item-a'))
		).toBe(true);
		expect(
			await backend.binary.exists(storagePaths.galleryItemImage('collection-a', 'item-b'))
		).toBe(false);
		expect(await backend.json.readJson(storagePaths.galleryItemLookup('item-b'))).toBeNull();
		expect((await getAllCollections())[0].items.map((item) => item.id)).toEqual(['item-a']);
	});

	it('deletes a collection tree and its index entries', async () => {
		const collection = createCollection();

		await saveCollection(collection);
		await deleteCollection(collection.id);

		expect(
			await backend.json.readJson(storagePaths.galleryCollectionManifest(collection.id))
		).toBeNull();
		expect(
			await backend.binary.exists(storagePaths.galleryItemImage(collection.id, 'item-a'))
		).toBe(false);
		expect(await backend.json.readJson(storagePaths.galleryItemLookup('item-a'))).toBeNull();
		expect(await getAllCollections()).toEqual([]);
	});

	it('clears all gallery data', async () => {
		await saveCollection(createCollection('collection-a'));
		await saveCollection(
			createCollection('collection-b', [createItem('item-b', 'collection-b', [7, 8, 9])])
		);

		await clearAllCollections();

		expect(await backend.json.readJson(storagePaths.galleryIndex())).toBeNull();
		expect(await backend.json.readJson(storagePaths.galleryItemLookup('item-a'))).toBeNull();
		expect(await backend.json.readJson(storagePaths.galleryItemLookup('item-b'))).toBeNull();
		expect(await backend.binary.list(storagePaths.galleryRoot())).toEqual([]);
		expect(await getAllCollections()).toEqual([]);
	});
});
