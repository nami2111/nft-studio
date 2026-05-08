/**
 * IndexedDB streaming helper for generation images and metadata.
 * Used when enableStreamingStorage is true to avoid unbounded in-memory accumulation.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'gnstudio-generation';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';
const METADATA_STORE = 'metadata';

let dbInstance: IDBPDatabase | null = null;

async function initDB(): Promise<IDBPDatabase> {
	if (dbInstance) return dbInstance;
	dbInstance = await openDB(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(IMAGES_STORE)) {
				db.createObjectStore(IMAGES_STORE, { keyPath: 'key' });
			}
			if (!db.objectStoreNames.contains(METADATA_STORE)) {
				db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
			}
		}
	});
	return dbInstance;
}

function imageKey(sessionId: string, index: number): string {
	return `${sessionId}-img-${index}`;
}

function metadataKey(sessionId: string, index: number): string {
	return `${sessionId}-meta-${index}`;
}

export interface StreamedImage {
	name: string;
	imageData: ArrayBuffer;
}

export interface StreamedMetadata {
	name: string;
	data: Record<string, unknown>;
}

/**
 * Stream a single generated image to IndexedDB.
 */
export async function streamImage(
	sessionId: string,
	index: number,
	name: string,
	imageData: ArrayBuffer
): Promise<void> {
	const db = await initDB();
	await db.put(IMAGES_STORE, { key: imageKey(sessionId, index), name, imageData });
}

/**
 * Stream a single metadata object to IndexedDB.
 */
export async function streamMetadata(
	sessionId: string,
	index: number,
	name: string,
	data: Record<string, unknown>
): Promise<void> {
	const db = await initDB();
	await db.put(METADATA_STORE, { key: metadataKey(sessionId, index), name, data });
}

/**
 * Stream images and metadata in bulk (more efficient than individual puts).
 */
export async function streamBatch(
	sessionId: string,
	startIndex: number,
	images: StreamedImage[],
	metadata: StreamedMetadata[]
): Promise<void> {
	const db = await initDB();
	const tx = db.transaction([IMAGES_STORE, METADATA_STORE], 'readwrite');
	const imageStore = tx.objectStore(IMAGES_STORE);
	const metaStore = tx.objectStore(METADATA_STORE);

	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		const meta = metadata[i];
		imageStore.put({
			key: imageKey(sessionId, startIndex + i),
			name: img.name,
			imageData: img.imageData
		});
		if (meta) {
			metaStore.put({
				key: metadataKey(sessionId, startIndex + i),
				name: meta.name,
				data: meta.data
			});
		}
	}

	await tx.done;
}

/**
 * Get the total count of streamed images for a session.
 */
export async function getImageCount(sessionId: string): Promise<number> {
	const db = await initDB();
	const keys = await db.getAllKeys(IMAGES_STORE);
	const prefix = `${sessionId}-img-`;
	return keys.filter((k) => typeof k === 'string' && k.startsWith(prefix)).length;
}

/**
 * Iterate over all images for a session in index order, invoking a callback for each batch.
 */
export async function iterateImages(
	sessionId: string,
	callback: (images: StreamedImage[], startIndex: number) => void | Promise<void>,
	batchSize = 100
): Promise<void> {
	const db = await initDB();
	const prefix = `${sessionId}-img-`;
	const keys = (await db.getAllKeys(IMAGES_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(prefix)
	);

	// Sort by numeric index extracted from key
	keys.sort((a, b) => {
		const indexA = parseInt(a.replace(prefix, ''), 10);
		const indexB = parseInt(b.replace(prefix, ''), 10);
		return indexA - indexB;
	});

	for (let i = 0; i < keys.length; i += batchSize) {
		const batchKeys = keys.slice(i, i + batchSize);
		const batch = await Promise.all(
			batchKeys.map(async (key) => {
				const record = await db.get(IMAGES_STORE, key);
				return record as { key: string; name: string; imageData: ArrayBuffer };
			})
		);
		const images = batch.map((r) => ({ name: r.name, imageData: r.imageData }));
		const startIndex = parseInt(batchKeys[0].replace(prefix, ''), 10);
		await callback(images, startIndex);
	}
}

/**
 * Get all metadata for a session as a single array.
 */
export async function getAllMetadata(sessionId: string): Promise<StreamedMetadata[]> {
	const out: StreamedMetadata[] = [];
	await iterateMetadata(sessionId, (batch) => {
		out.push(...batch);
	});
	return out;
}

/**
 * Iterate over all metadata for a session in index order, invoking a callback for each batch.
 */
export async function iterateMetadata(
	sessionId: string,
	callback: (metadata: StreamedMetadata[], startIndex: number) => void | Promise<void>,
	batchSize = 100
): Promise<void> {
	const db = await initDB();
	const prefix = `${sessionId}-meta-`;
	const keys = (await db.getAllKeys(METADATA_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(prefix)
	);

	keys.sort((a, b) => {
		const indexA = parseInt(a.replace(prefix, ''), 10);
		const indexB = parseInt(b.replace(prefix, ''), 10);
		return indexA - indexB;
	});

	for (let i = 0; i < keys.length; i += batchSize) {
		const batchKeys = keys.slice(i, i + batchSize);
		const batch = await Promise.all(
			batchKeys.map(async (key) => {
				const record = await db.get(METADATA_STORE, key);
				return record as { key: string; name: string; data: Record<string, unknown> };
			})
		);
		const metadata = batch.map((r) => ({ name: r.name, data: r.data }));
		const startIndex = parseInt(batchKeys[0].replace(prefix, ''), 10);
		await callback(metadata, startIndex);
	}
}

/**
 * Clear all data for a generation session.
 */
export async function clearSession(sessionId: string): Promise<void> {
	const db = await initDB();
	const imagePrefix = `${sessionId}-img-`;
	const metaPrefix = `${sessionId}-meta-`;

	const allImageKeys = (await db.getAllKeys(IMAGES_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(imagePrefix)
	);
	const allMetaKeys = (await db.getAllKeys(METADATA_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(metaPrefix)
	);

	const tx = db.transaction([IMAGES_STORE, METADATA_STORE], 'readwrite');
	for (const key of allImageKeys) tx.objectStore(IMAGES_STORE).delete(key);
	for (const key of allMetaKeys) tx.objectStore(METADATA_STORE).delete(key);
	await tx.done;
}

/**
 * Get total storage bytes used by a session (approximate).
 */
export async function getSessionStorageSize(sessionId: string): Promise<number> {
	const db = await initDB();
	const imagePrefix = `${sessionId}-img-`;
	const metaPrefix = `${sessionId}-meta-`;

	const imageKeys = (await db.getAllKeys(IMAGES_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(imagePrefix)
	);
	const metaKeys = (await db.getAllKeys(METADATA_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(metaPrefix)
	);

	let total = 0;
	for (const key of imageKeys) {
		const record = await db.get(IMAGES_STORE, key);
		if (record?.imageData?.byteLength) total += record.imageData.byteLength;
	}
	for (const key of metaKeys) {
		const record = await db.get(METADATA_STORE, key);
		if (record?.data) total += JSON.stringify(record.data).length * 2;
	}
	return total;
}
