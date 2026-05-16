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
 * Stream images and metadata in bulk (more efficient than individual puts).
 */
export async function streamBatch(
	sessionId: string,
	startIndex: number,
	images: StreamedImage[],
	metadata: StreamedMetadata[]
): Promise<void> {
	// Validate image data before storing
	const emptyImages = images.filter((img) => !img.imageData || img.imageData.byteLength === 0);
	if (emptyImages.length > 0) {
		console.error(
			`❌ streamBatch: ${emptyImages.length} images have empty data at startIndex=${startIndex}:`,
			emptyImages.map((img) => img.name)
		);
	}

	const imageRecords = images.map((img, i) => ({
		key: imageKey(sessionId, startIndex + i),
		name: img.name,
		imageData: img.imageData.slice()
	}));
	const metadataRecords = metadata.map((meta, i) => ({
		key: metadataKey(sessionId, startIndex + i),
		name: meta.name,
		data: structuredClone(meta.data)
	}));

	const db = await initDB();
	const tx = db.transaction([IMAGES_STORE, METADATA_STORE], 'readwrite');
	const imageStore = tx.objectStore(IMAGES_STORE);
	const metaStore = tx.objectStore(METADATA_STORE);

	for (const record of imageRecords) {
		imageStore.put(record);
	}

	for (const record of metadataRecords) {
		metaStore.put(record);
	}

	await tx.done;
}

/**
 * Iterate over paired image+metadata batches in index order.
 * Invokes callback with each batch for streaming into ZIP.
 */
export async function iterateItems(
	sessionId: string,
	callback: (
		batch: { images: StreamedImage[]; metadata: StreamedMetadata[] },
		startIndex: number
	) => Promise<void>,
	batchSize = 50
): Promise<void> {
	const db = await initDB();
	const imagePrefix = `${sessionId}-img-`;
	const metaPrefix = `${sessionId}-meta-`;

	const imageKeys = (await db.getAllKeys(IMAGES_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(imagePrefix)
	);

	console.log(`🔍 iterateItems: Found ${imageKeys.length} image keys for session ${sessionId}`);

	imageKeys.sort((a, b) => {
		const indexA = parseInt(a.replace(imagePrefix, ''), 10);
		const indexB = parseInt(b.replace(imagePrefix, ''), 10);
		return indexA - indexB;
	});

	let totalProcessed = 0;
	for (let i = 0; i < imageKeys.length; i += batchSize) {
		const batchImageKeys = imageKeys.slice(i, i + batchSize);
		const batchMetaKeys = batchImageKeys.map((k) => metaPrefix + k.replace(imagePrefix, ''));

		const [imageRecords, metaRecords] = await Promise.all([
			Promise.all(
				batchImageKeys.map(
					async (k) =>
						(await db.get(IMAGES_STORE, k)) as { key: string; name: string; imageData: ArrayBuffer }
				)
			),
			Promise.all(
				batchMetaKeys.map(
					async (k) =>
						(await db.get(METADATA_STORE, k)) as {
							key: string;
							name: string;
							data: Record<string, unknown>;
						}
				)
			)
		]);

		const missingImages = imageRecords.filter((r) => r === undefined).length;
		const missingMetadata = metaRecords.filter((r) => r === undefined).length;
		if (missingImages > 0 || missingMetadata > 0) {
			console.warn(
				`⚠️ iterateItems batch ${i}: ${missingImages} missing images, ${missingMetadata} missing metadata`
			);
		}

		const images = imageRecords.map((r) => ({ name: r.name, imageData: r.imageData }));
		const metadata = metaRecords.map((r) => ({ name: r.name, data: r.data }));
		const startIndex = parseInt(batchImageKeys[0].replace(imagePrefix, ''), 10);

		// Validate image data sizes
		const emptyImages = images.filter((img) => !img.imageData || img.imageData.byteLength === 0);
		if (emptyImages.length > 0) {
			console.error(
				`❌ iterateItems batch ${i}: ${emptyImages.length} images have empty data:`,
				emptyImages.map((img) => img.name)
			);
		}
		const totalImageBytes = images.reduce((sum, img) => sum + (img.imageData?.byteLength || 0), 0);
		if (import.meta.env.DEV) {
			console.log(
				`📦 iterateItems batch: startIndex=${startIndex}, images=${images.length}, totalImageBytes=${(totalImageBytes / 1024 / 1024).toFixed(1)}MB, totalProcessed=${totalProcessed}`
			);
		}

		totalProcessed += images.length;

		await callback({ images, metadata }, startIndex);
	}

	console.log(
		`✅ iterateItems complete: Total ${totalProcessed} items processed for session ${sessionId}`
	);
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

	if (allImageKeys.length === 0 && allMetaKeys.length === 0) return;

	const tx = db.transaction([IMAGES_STORE, METADATA_STORE], 'readwrite');
	for (const key of allImageKeys) tx.objectStore(IMAGES_STORE).delete(key);
	for (const key of allMetaKeys) tx.objectStore(METADATA_STORE).delete(key);
	await tx.done;
}
