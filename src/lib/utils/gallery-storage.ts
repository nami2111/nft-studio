/**
 * Durable storage for gallery collections.
 * Uses the shared storage backend for OPFS-capable browsers and falls back to legacy storage.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { getStorageBackend } from '$lib/storage/backend';
import {
	getStorageEstimate as getBrowserStorageEstimate,
	requestPersistentStorageOnce
} from '$lib/storage/capabilities';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import type { GalleryCollection, GalleryItem } from '$lib/types/gallery';
import { productionMonitor } from '$lib/monitoring/performance-monitor';

const DB_NAME = 'gnstudio-gallery';
const DB_VERSION = 3;
const COLLECTIONS_STORE = 'collections';
const GALLERY_IMAGES_STORE = 'gallery-images';

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

let dbInstance: IDBPDatabase | null = null;

/**
 * Initialize the legacy gallery database.
 */
export async function initGalleryDB(): Promise<IDBPDatabase> {
	if (dbInstance) {
		return dbInstance;
	}

	dbInstance = await openDB(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion) {
			if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
				const store = db.createObjectStore(COLLECTIONS_STORE, {
					keyPath: 'id'
				});
				store.createIndex('name', 'name', { unique: false });
				store.createIndex('generatedAt', 'generatedAt', { unique: false });
				store.createIndex('projectName', 'projectName', { unique: false });
				store.createIndex('totalSupply', 'totalSupply', { unique: false });
			}

			if (oldVersion < 3 && !db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
				const imageStore = db.createObjectStore(GALLERY_IMAGES_STORE, { keyPath: 'itemId' });
				imageStore.createIndex('collectionId', 'collectionId', { unique: false });
			}
		}
	});

	return dbInstance;
}

async function getGalleryStorageBackend(): Promise<ObjectStorageBackend | null> {
	const backend = await getStorageBackend();
	return backend.kind === 'indexeddb-legacy' ? null : backend;
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

		if (!backend) {
			await saveCollectionToLegacyStorage(collection);
			return;
		}

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

async function saveCollectionToLegacyStorage(collection: GalleryCollection): Promise<void> {
	const db = await initGalleryDB();
	const collectionToStore = serializeCollection(collection);

	await db.put(COLLECTIONS_STORE, collectionToStore);

	if (db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
		const tx = db.transaction(GALLERY_IMAGES_STORE, 'readwrite');
		const store = tx.objectStore(GALLERY_IMAGES_STORE);
		for (const item of collection.items) {
			if (item.imageData instanceof ArrayBuffer && item.imageData.byteLength > 0) {
				store.put({
					itemId: item.id,
					collectionId: collection.id,
					imageData: item.imageData
				});
			}
		}
		await tx.done;
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

	if (!backend) {
		await saveItemImageToLegacyStorage(itemId, collectionId, imageData);
		return;
	}

	await backend.binary.write(storagePaths.galleryItemImage(collectionId, itemId), imageData);
	await writeItemLookup(backend, itemId, collectionId);
	void requestPersistentStorageOnce('gallery-import');
}

async function saveItemImageToLegacyStorage(
	itemId: string,
	collectionId: string,
	imageData: ArrayBuffer
): Promise<void> {
	const db = await initGalleryDB();
	if (!db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) return;

	const tx = db.transaction(GALLERY_IMAGES_STORE, 'readwrite');
	const store = tx.objectStore(GALLERY_IMAGES_STORE);
	store.put({ itemId, collectionId, imageData });
	await tx.done;
}

/**
 * Get a single item image from durable gallery storage.
 */
export async function getItemImage(itemId: string): Promise<ArrayBuffer | null> {
	const backend = await getGalleryStorageBackend();

	if (!backend) {
		return getItemImageFromLegacyStorage(itemId);
	}

	const collectionId = await findCollectionIdForItem(backend, itemId);
	if (!collectionId) {
		return backend.kind === 'opfs' ? getItemImageFromLegacyStorage(itemId) : null;
	}

	const imageData = await backend.binary.read(storagePaths.galleryItemImage(collectionId, itemId));
	if (imageData || backend.kind !== 'opfs') {
		return imageData;
	}

	return getItemImageFromLegacyStorage(itemId);
}

async function getItemImageFromLegacyStorage(itemId: string): Promise<ArrayBuffer | null> {
	const db = await initGalleryDB();
	if (!db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
		return null;
	}

	const tx = db.transaction(GALLERY_IMAGES_STORE, 'readonly');
	const store = tx.objectStore(GALLERY_IMAGES_STORE);
	const record = await store.get(itemId);

	if (record?.imageData instanceof ArrayBuffer && record.imageData.byteLength > 0) {
		return record.imageData;
	}
	return null;
}

/**
 * Get all collections from durable gallery storage.
 */
export async function getAllCollections(): Promise<GalleryCollection[]> {
	const startTime = Date.now();

	try {
		const backend = await getGalleryStorageBackend();

		if (!backend) {
			return getAllCollectionsFromLegacyStorage();
		}

		const index = await readGalleryIndex(backend);
		if (backend.kind === 'opfs' && index.collectionIds.length === 0) {
			const collectionsFromTree = await getAllCollectionsFromOpfs(backend);
			if (collectionsFromTree.length > 0) {
				await writeGalleryIndex(
					backend,
					collectionsFromTree.map((collection) => collection.id)
				);
				return collectionsFromTree;
			}
			return getAllCollectionsFromLegacyStorage();
		}

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

async function getAllCollectionsFromOpfs(
	backend: ObjectStorageBackend
): Promise<GalleryCollection[]> {
	const collectionIds = await listGalleryCollectionIds(backend);

	const collections = await Promise.all(
		collectionIds.map(async (collectionId) => {
			const stored = await backend.json.readJson<StoredGalleryCollection>(
				storagePaths.galleryCollectionManifest(collectionId)
			);
			return stored ? hydrateCollection(stored) : null;
		})
	);

	return collections.filter((collection): collection is GalleryCollection => collection !== null);
}

async function getAllCollectionsFromLegacyStorage(): Promise<GalleryCollection[]> {
	const db = await initGalleryDB();
	const storedCollections = (await db.getAll(COLLECTIONS_STORE)) as StoredGalleryCollection[];

	return storedCollections.map(hydrateCollection);
}

/**
 * Delete a collection from durable gallery storage.
 */
export async function deleteCollection(id: string): Promise<void> {
	const startTime = Date.now();

	try {
		const backend = await getGalleryStorageBackend();

		if (!backend) {
			await deleteCollectionFromLegacyStorage(id);
			return;
		}

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
		if (backend.kind === 'opfs') {
			await deleteCollectionFromLegacyStorage(id);
		}
	} finally {
		recordGalleryQuery('deleteCollection', startTime);
	}
}

async function deleteCollectionFromLegacyStorage(id: string): Promise<void> {
	const db = await initGalleryDB();

	if (db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
		const tx = db.transaction(GALLERY_IMAGES_STORE, 'readwrite');
		const store = tx.objectStore(GALLERY_IMAGES_STORE);
		const index = store.index('collectionId');
		const keys = await index.getAllKeys(id);
		for (const key of keys) {
			store.delete(key);
		}
		await tx.done;
	}

	await db.delete(COLLECTIONS_STORE, id);
}

/**
 * Clear all collections from durable gallery storage.
 */
export async function clearAllCollections(): Promise<void> {
	const startTime = Date.now();

	try {
		const backend = await getGalleryStorageBackend();

		if (backend) {
			const index = await readGalleryIndex(backend);
			await Promise.all(
				index.collectionIds.map(async (collectionId) => {
					const manifest = await backend.json.readJson<StoredGalleryCollection>(
						storagePaths.galleryCollectionManifest(collectionId)
					);
					await Promise.all(
						manifest?.items.map((item) => removeItemLookup(backend, item.id)) ?? []
					);
				})
			);
			await backend.binary.removeTree(storagePaths.galleryRoot());
		}

		if (!backend || backend.kind === 'opfs') {
			await clearAllCollectionsFromLegacyStorage();
		}
	} finally {
		recordGalleryQuery('clearAllCollections', startTime);
	}
}

async function clearAllCollectionsFromLegacyStorage(): Promise<void> {
	const db = await initGalleryDB();
	await db.clear(COLLECTIONS_STORE);

	if (db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
		await db.clear(GALLERY_IMAGES_STORE);
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
