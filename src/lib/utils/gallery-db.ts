/**
 * IndexedDB storage for gallery collections
 * Supports large collections (10K+ NFTs) that exceed localStorage quota
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { GalleryCollection } from '$lib/types/gallery';

const DB_NAME = 'nft-studio-gallery';
const DB_VERSION = 1;
const COLLECTIONS_STORE = 'collections';

let dbInstance: IDBPDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initGalleryDB(): Promise<IDBPDatabase> {
	if (dbInstance) {
		return dbInstance;
	}

	dbInstance = await openDB(DB_NAME, DB_VERSION, {
		upgrade(db) {
			// Create collections store
			if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
				const store = db.createObjectStore(COLLECTIONS_STORE, {
					keyPath: 'id'
				});
				store.createIndex('name', 'name', { unique: false });
				store.createIndex('generatedAt', 'generatedAt', { unique: false });
			}
		}
	});

	return dbInstance;
}

/**
 * Save a collection to IndexedDB
 */
export async function saveCollection(collection: GalleryCollection): Promise<void> {
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
		// Store NFTs without imageData - metadata only
		// Deep serialize metadata to remove any non-serializable properties
		nfts: collection.nfts.map((nft) => ({
			id: nft.id,
			name: nft.name,
			description: nft.description,
			// Deep clone and serialize metadata
			metadata: JSON.parse(JSON.stringify(nft.metadata)),
			rarityScore: nft.rarityScore,
			rarityRank: nft.rarityRank,
			collectionId: nft.collectionId,
			generatedAt: nft.generatedAt instanceof Date ? nft.generatedAt.toISOString() : nft.generatedAt
			// imageData excluded to save space
		}))
	};

	await db.put(COLLECTIONS_STORE, collectionToStore);
}

/**
 * Get a collection from IndexedDB by ID
 */
export async function getCollection(id: string): Promise<GalleryCollection | undefined> {
	const db = await initGalleryDB();
	const stored = await db.get(COLLECTIONS_STORE, id);

	if (!stored) {
		return undefined;
	}

	// Restore the collection, converting ISO strings back to Date objects
	// imageData will need to be reloaded from the original source (ZIP file or generation cache)
	return {
		...stored,
		generatedAt: stored.generatedAt ? new Date(stored.generatedAt) : new Date(),
		nfts: stored.nfts.map((nft: any) => ({
			...nft,
			generatedAt: nft.generatedAt ? new Date(nft.generatedAt) : new Date(),
			imageData: new ArrayBuffer(0) // Empty buffer, will be filled from cache if available
		}))
	} as GalleryCollection;
}

/**
 * Get all collections from IndexedDB
 */
export async function getAllCollections(): Promise<GalleryCollection[]> {
	const db = await initGalleryDB();
	const storedCollections = await db.getAll(COLLECTIONS_STORE);

	return storedCollections.map((stored) => ({
		...stored,
		generatedAt: stored.generatedAt ? new Date(stored.generatedAt) : new Date(),
		nfts: stored.nfts.map((nft: any) => ({
			...nft,
			generatedAt: nft.generatedAt ? new Date(nft.generatedAt) : new Date(),
			imageData: new ArrayBuffer(0) // Empty buffer, will be filled from cache if available
		}))
	})) as GalleryCollection[];
}

/**
 * Delete a collection from IndexedDB
 */
export async function deleteCollection(id: string): Promise<void> {
	const db = await initGalleryDB();
	await db.delete(COLLECTIONS_STORE, id);
}

/**
 * Clear all collections from IndexedDB
 */
export async function clearAllCollections(): Promise<void> {
	const db = await initGalleryDB();
	await db.clear(COLLECTIONS_STORE);
}

/**
 * Get storage estimate (how much space is being used)
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
	if ('storage' in navigator && 'estimate' in navigator.storage) {
		const estimate = await navigator.storage.estimate();
		return {
			usage: estimate.usage || 0,
			quota: estimate.quota || 0
		};
	}
	return { usage: 0, quota: 0 };
}
