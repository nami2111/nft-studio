/**
 * Durable storage for gallery collections.
 * Uses the shared storage backend (OPFS or legacy adapter).
 */

import { getStorageBackend } from '$lib/storage/backend';
import {
	getStorageEstimate as getBrowserStorageEstimate,
	requestPersistentStorageOnce
} from '$lib/storage/capabilities';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import type { GalleryCollection, GalleryItem } from '$lib/types/gallery';
import { productionMonitor } from '$lib/monitoring/performance-monitor';

interface GalleryIndex {
	collectionIds: string[];
	updatedAt: number;
}

interface GalleryItemLookup {
	collectionId: string;
	updatedAt: number;
}

type StoredGalleryItem = Omit<
	GalleryItem,
	'generatedAt' | 'imageData' | 'imageUrl' | 'isBlobUrl'
> & {
	generatedAt: string | Date;
	imageData?: never;
};

type StoredGalleryCollection = Omit<GalleryCollection, 'generatedAt' | 'items'> & {
	generatedAt: string | Date;
	items: StoredGalleryItem[];
};

async function getGalleryStorageBackend(): Promise<ObjectStorageBackend> {
	return getStorageBackend();
}

function serializeCollection(collection: GalleryCollection): StoredGalleryCollection {
	return {
		id: collection.id,
		name: collection.name,
		description: collection.description,
		projectName: collection.projectName,
		generatedAt:
			collection.generatedAt instanceof Date
				? collection.generatedAt.toISOString()
				: collection.generatedAt,
		totalSupply: collection.totalSupply,
		items: collection.items.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			imageFormat: item.imageFormat,
			metadata: JSON.parse(JSON.stringify(item.metadata)),
			rarityScore: item.rarityScore,
			rarityRank: item.rarityRank,
			collectionId: item.collectionId,
			generatedAt:
				item.generatedAt instanceof Date ? item.generatedAt.toISOString() : item.generatedAt
		}))
	};
}

function hydrateCollection(stored: StoredGalleryCollection): GalleryCollection {
	return {
		id: stored.id,
		name: stored.name,
		description: stored.description,
		projectName: stored.projectName,
		generatedAt: stored.generatedAt ? new Date(stored.generatedAt) : new Date(),
		items: stored.items.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			imageFormat: item.imageFormat,
			metadata: item.metadata,
			rarityScore: item.rarityScore,
			rarityRank: item.rarityRank,
			collectionId: item.collectionId,
			generatedAt: item.generatedAt ? new Date(item.generatedAt) : new Date(),
			imageData: new ArrayBuffer(0)
		})),
		totalSupply: stored.totalSupply
	};
}

function recordGalleryQuery(operation: string, startTime: number): void {
	const duration = Date.now() - startTime;
	productionMonitor.recordDatabaseQuery(operation, duration);
}

async function readGalleryIndex(backend: ObjectStorageBackend): Promise<GalleryIndex> {
	return (
		(await backend.json.readJson<GalleryIndex>(storagePaths.galleryIndex())) ?? {
			collectionIds: [],
			updatedAt: Date.now()
		}
	);
}

async function writeGalleryIndex(
	backend: ObjectStorageBackend,
	collectionIds: string[]
): Promise<void> {
	await backend.json.writeJson(storagePaths.galleryIndex(), {
		collectionIds: Array.from(new Set(collectionIds)),
		updatedAt: Date.now()
	} satisfies GalleryIndex);
}

async function addCollectionToIndex(
	backend: ObjectStorageBackend,
	collectionId: string
): Promise<void> {
	const index = await readGalleryIndex(backend);
	await writeGalleryIndex(backend, [...index.collectionIds, collectionId]);
}

async function listGalleryCollectionIds(backend: ObjectStorageBackend): Promise<string[]> {
	return await backend.binary.list(storagePaths.galleryCollectionsRoot());
}

async function writeItemLookup(
	backend: ObjectStorageBackend,
	itemId: string,
	collectionId: string
): Promise<void> {
	await backend.json.writeJson(storagePaths.galleryItemLookup(itemId), {
		collectionId,
		updatedAt: Date.now()
	} satisfies GalleryItemLookup);
}

async function removeItemLookup(backend: ObjectStorageBackend, itemId: string): Promise<void> {
	await backend.json.removeJson(storagePaths.galleryItemLookup(itemId));
}

async function readItemLookup(
	backend: ObjectStorageBackend,
	itemId: string
): Promise<string | null> {
	const lookup = await backend.json.readJson<GalleryItemLookup>(
		storagePaths.galleryItemLookup(itemId)
	);
	return lookup?.collectionId ?? null;
}

async function findCollectionIdForItem(
	backend: ObjectStorageBackend,
	itemId: string
): Promise<string | null> {
	const lookup = await readItemLookup(backend, itemId);
	if (lookup) {
		return lookup;
	}

	const index = await readGalleryIndex(backend);

	for (const collectionId of index.collectionIds) {
		const collection = await backend.json.readJson<StoredGalleryCollection>(
			storagePaths.galleryCollectionManifest(collectionId)
		);

		if (collection?.items.some((item) => item.id === itemId)) {
			return collectionId;
		}
	}

	const collectionIds = await listGalleryCollectionIds(backend);
	for (const collectionId of collectionIds) {
		const collection = await backend.json.readJson<StoredGalleryCollection>(
			storagePaths.galleryCollectionManifest(collectionId)
		);

		if (collection?.items.some((item) => item.id === itemId)) {
			return collectionId;
		}
	}

	return null;
}

async function removeStaleItemImages(
	backend: ObjectStorageBackend,
	collectionId: string,
	itemIds: Set<string>
): Promise<void> {
	const storedImageNames = await backend.binary.list(
		storagePaths.galleryCollectionItemsRoot(collectionId)
	);

	await Promise.all(
		storedImageNames.map((fileName) => {
			if (!fileName.endsWith('.bin')) return Promise.resolve();

			const itemId = fileName.slice(0, -'.bin'.length);
			if (itemIds.has(itemId)) return Promise.resolve();

			return Promise.all([
				backend.binary.remove(storagePaths.galleryItemImage(collectionId, itemId)),
				removeItemLookup(backend, itemId)
			]).then(() => undefined);
		})
	);
}

/**
 * Save a collection to durable gallery storage.
 */
export async function saveCollection(collection: GalleryCollection): Promise<void> {
	const startTime = Date.now();

	try {
		const backend = await getGalleryStorageBackend();
		const storedCollection = serializeCollection(collection);
		const itemIds = new Set(storedCollection.items.map((item) => item.id));

		await Promise.all(
			collection.items.map(async (item) => {
				if (item.imageData instanceof ArrayBuffer && item.imageData.byteLength > 0) {
					await backend.binary.write(
						storagePaths.galleryItemImage(collection.id, item.id),
						item.imageData
					);
					await writeItemLookup(backend, item.id, collection.id);
				}
			})
		);

		await removeStaleItemImages(backend, collection.id, itemIds);
		await backend.json.writeJson(
			storagePaths.galleryCollectionManifest(collection.id),
			storedCollection
		);
		await addCollectionToIndex(backend, collection.id);
		void requestPersistentStorageOnce('gallery-import');
	} finally {
		recordGalleryQuery('saveCollection', startTime);
	}
}

/**
 * Save a single item image to durable gallery storage.
 */
export async function saveItemImage(
	itemId: string,
	collectionId: string,
	imageData: ArrayBuffer
): Promise<void> {
	const backend = await getGalleryStorageBackend();

	await backend.binary.write(storagePaths.galleryItemImage(collectionId, itemId), imageData);
	await writeItemLookup(backend, itemId, collectionId);
	void requestPersistentStorageOnce('gallery-import');
}

/**
 * Get a single item image from durable gallery storage.
 */
export async function getItemImage(itemId: string): Promise<ArrayBuffer | null> {
	const backend = await getGalleryStorageBackend();

	const collectionId = await findCollectionIdForItem(backend, itemId);
	if (!collectionId) {
		return null;
	}

	return backend.binary.read(storagePaths.galleryItemImage(collectionId, itemId));
}

/**
 * Get all collections from durable gallery storage.
 */
export async function getAllCollections(): Promise<GalleryCollection[]> {
	const startTime = Date.now();

	try {
		const backend = await getGalleryStorageBackend();
		const index = await readGalleryIndex(backend);

		const collections = await Promise.all(
			index.collectionIds.map(async (collectionId) => {
				const stored = await backend.json.readJson<StoredGalleryCollection>(
					storagePaths.galleryCollectionManifest(collectionId)
				);
				return stored ? hydrateCollection(stored) : null;
			})
		);

		const hydratedCollections = collections.filter(
			(collection): collection is GalleryCollection => collection !== null
		);
		if (hydratedCollections.length !== index.collectionIds.length) {
			await writeGalleryIndex(
				backend,
				hydratedCollections.map((collection) => collection.id)
			);
		}

		return hydratedCollections;
	} finally {
		recordGalleryQuery('getAllCollections', startTime);
	}
}

/**
 * Delete a collection from durable gallery storage.
 */
export async function deleteCollection(id: string): Promise<void> {
	const startTime = Date.now();

	try {
		const backend = await getGalleryStorageBackend();

		const collection = await backend.json.readJson<StoredGalleryCollection>(
			storagePaths.galleryCollectionManifest(id)
		);
		if (collection) {
			await Promise.all(collection.items.map((item) => removeItemLookup(backend, item.id)));
		}
		await backend.binary.removeTree(storagePaths.galleryCollectionRoot(id));
		const index = await readGalleryIndex(backend);
		await writeGalleryIndex(
			backend,
			index.collectionIds.filter((collectionId) => collectionId !== id)
		);
	} finally {
		recordGalleryQuery('deleteCollection', startTime);
	}
}

/**
 * Clear all collections from durable gallery storage.
 */
export async function clearAllCollections(): Promise<void> {
	const startTime = Date.now();

	try {
		const backend = await getGalleryStorageBackend();

		const index = await readGalleryIndex(backend);
		await Promise.all(
			index.collectionIds.map(async (collectionId) => {
				const manifest = await backend.json.readJson<StoredGalleryCollection>(
					storagePaths.galleryCollectionManifest(collectionId)
				);
				await Promise.all(manifest?.items.map((item) => removeItemLookup(backend, item.id)) ?? []);
			})
		);
		await backend.binary.removeTree(storagePaths.galleryRoot());
	} finally {
		recordGalleryQuery('clearAllCollections', startTime);
	}
}

/**
 * Get storage estimate.
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
	const estimate = await getBrowserStorageEstimate();
	return {
		usage: estimate.usage,
		quota: estimate.quota
	};
}
