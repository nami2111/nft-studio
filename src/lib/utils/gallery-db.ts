/**
 * IndexedDB storage for gallery collections
 * Supports large collections (10K+ items) that exceed localStorage quota
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { GalleryCollection } from '$lib/types/gallery';
import { productionMonitor } from '$lib/monitoring/performance-monitor';
import { getStorageEstimate as getBrowserStorageEstimate } from '$lib/storage/capabilities';

const DB_NAME = 'gnstudio-gallery';
const DB_VERSION = 3; // Bumped to add gallery-images store
const COLLECTIONS_STORE = 'collections';
const GALLERY_IMAGES_STORE = 'gallery-images';

let dbInstance: IDBPDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initGalleryDB(): Promise<IDBPDatabase> {
	if (dbInstance) {
		return dbInstance;
	}

	dbInstance = await openDB(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion) {
			// Create collections store
			if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
				const store = db.createObjectStore(COLLECTIONS_STORE, {
					keyPath: 'id'
				});
				// Add indices for common query patterns
				store.createIndex('name', 'name', { unique: false });
				store.createIndex('generatedAt', 'generatedAt', { unique: false });
				store.createIndex('projectName', 'projectName', { unique: false });
				store.createIndex('totalSupply', 'totalSupply', { unique: false });
			}

			// Add gallery-images store in version 3
			if (oldVersion < 3 && !db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
				const imageStore = db.createObjectStore(GALLERY_IMAGES_STORE, { keyPath: 'itemId' });
				imageStore.createIndex('collectionId', 'collectionId', { unique: false });
			}
		}
	});

	return dbInstance;
}

/**
 * Save a collection to IndexedDB
 */
export async function saveCollection(collection: GalleryCollection): Promise<void> {
	const startTime = Date.now();
	const db = await initGalleryDB();

	// Deep serialization to ensure all data is cloneable
	// This handles Date objects, nested objects, and any non-serializable properties
	const collectionToStore = {
		id: collection.id,
		name: collection.name,
		description: collection.description,
		projectName: collection.projectName,
		generatedAt:
			collection.generatedAt instanceof Date
				? collection.generatedAt.toISOString()
				: collection.generatedAt,
		totalSupply: collection.totalSupply,
		// Store items without imageData - metadata only
		// Deep serialize metadata to remove any non-serializable properties
		items: collection.items.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			// Deep clone and serialize metadata
			metadata: JSON.parse(JSON.stringify(item.metadata)),
			rarityScore: item.rarityScore,
			rarityRank: item.rarityRank,
			collectionId: item.collectionId,
			generatedAt:
				item.generatedAt instanceof Date ? item.generatedAt.toISOString() : item.generatedAt
			// imageData excluded to save space (stored separately in gallery-images store)
		}))
	};

	await db.put(COLLECTIONS_STORE, collectionToStore);

	// Also save each item's imageData to the gallery-images store
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

	// Record database query performance
	const duration = Date.now() - startTime;
	productionMonitor.recordDatabaseQuery('saveCollection', duration);
}

/**
 * Save a single item image to IndexedDB (used during streaming import).
 */
export async function saveItemImage(
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
 * Get a single item image from IndexedDB (on-demand fetch).
 */
export async function getItemImage(itemId: string): Promise<ArrayBuffer | null> {
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
 * Get all collections from IndexedDB (metadata only, no image hydration).
 */
export async function getAllCollections(): Promise<GalleryCollection[]> {
	const startTime = Date.now();
	const db = await initGalleryDB();
	const storedCollections = await db.getAll(COLLECTIONS_STORE);

	const duration = Date.now() - startTime;
	productionMonitor.recordDatabaseQuery('getAllCollections', duration);

	const collections = storedCollections.map((stored) => ({
		...stored,
		generatedAt: stored.generatedAt ? new Date(stored.generatedAt) : new Date(),
		items: stored.items.map((item: Record<string, unknown> & { generatedAt?: string | Date }) => ({
			...item,
			generatedAt: item.generatedAt ? new Date(item.generatedAt) : new Date(),
			imageData: new ArrayBuffer(0) // Placeholder, image fetched on demand via getItemImage
		}))
	})) as GalleryCollection[];

	return collections;
}

/**
 * Delete a collection from IndexedDB
 */
export async function deleteCollection(id: string): Promise<void> {
	const startTime = Date.now();
	const db = await initGalleryDB();

	// Also delete associated gallery-images
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

	// Record database query performance
	const duration = Date.now() - startTime;
	productionMonitor.recordDatabaseQuery('deleteCollection', duration);
}

/**
 * Clear all collections from IndexedDB
 */
export async function clearAllCollections(): Promise<void> {
	const startTime = Date.now();
	const db = await initGalleryDB();
	await db.clear(COLLECTIONS_STORE);

	if (db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
		await db.clear(GALLERY_IMAGES_STORE);
	}

	// Record database query performance
	const duration = Date.now() - startTime;
	productionMonitor.recordDatabaseQuery('clearAllCollections', duration);
}

/**
 * Get storage estimate (how much space is being used)
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
	const estimate = await getBrowserStorageEstimate();
	return {
		usage: estimate.usage,
		quota: estimate.quota
	};
}
