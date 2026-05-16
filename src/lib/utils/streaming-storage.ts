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
 * Iterate over image+metadata batches capped by total byte size.
 * Reads items sequentially, measuring actual sizes, and flushes when targetBytes is reached.
 * Only holds one batch in memory at a time (~500MB max), never loads all records upfront.
 */
export async function iterateBySize(
	sessionId: string,
	targetBytes: number,
	callback: (
		batch: { images: StreamedImage[]; metadata: StreamedMetadata[] },
		batchIndex: number,
		totalBatches: number
	) => Promise<void>
): Promise<void> {
	const db = await initDB();
	const imagePrefix = `${sessionId}-img-`;

	const allImageKeys = (await db.getAllKeys(IMAGES_STORE)).filter(
		(k): k is string => typeof k === 'string' && k.startsWith(imagePrefix)
	);

	console.log(`🔍 iterateBySize: Found ${allImageKeys.length} image keys for session ${sessionId}`);

	const indices = allImageKeys
		.map((k) => parseInt(k.replace(imagePrefix, ''), 10))
		.sort((a, b) => a - b);

	if (indices.length === 0) {
		console.warn(`⚠️ iterateBySize: No items found for session ${sessionId}`);
		return;
	}

	// First pass: measure sizes without loading full imageData into memory
	// Read keys only, then probe sizes in small chunks to avoid IndexedDB limits
	const sizes: number[] = new Array(indices.length);
	const chunkSize = 20;

	for (let offset = 0; offset < indices.length; offset += chunkSize) {
		const chunk = indices.slice(offset, offset + chunkSize);
		const chunkKeys = chunk.map((idx) => imageKey(sessionId, idx));

		const results = await Promise.all(
			chunkKeys.map(async (k) => {
				const record = (await db.get(IMAGES_STORE, k)) as
					| { name: string; imageData: ArrayBuffer }
					| undefined;
				return record?.imageData?.byteLength || 0;
			})
		);

		for (let i = 0; i < chunk.length; i++) {
			sizes[offset + i] = results[i];
		}
	}

	const totalSize = sizes.reduce((sum, s) => sum + s, 0);
	const estimatedBatches = Math.max(1, Math.ceil(totalSize / targetBytes));

	console.log(
		`📊 iterateBySize: ${indices.length} items, ${(totalSize / 1024 / 1024).toFixed(1)}MB total, ~${estimatedBatches} batches at ${(targetBytes / 1024 / 1024).toFixed(0)}MB each`
	);

	// Second pass: accumulate by actual size, flush when target reached
	const batchIndices: number[] = [];
	let batchBytes = 0;
	let batchIndex = 0;

	const flushBatch = async (): Promise<void> => {
		if (batchIndices.length === 0) return;

		const images: StreamedImage[] = [];
		const metadata: StreamedMetadata[] = [];

		for (const idx of batchIndices) {
			const [imgRecord, metaRecord] = await Promise.all([
				db.get(IMAGES_STORE, imageKey(sessionId, idx)) as Promise<
					{ name: string; imageData: ArrayBuffer } | undefined
				>,
				db.get(METADATA_STORE, metadataKey(sessionId, idx)) as Promise<
					{ name: string; data: Record<string, unknown> } | undefined
				>
			]);

			if (imgRecord) {
				images.push({ name: imgRecord.name, imageData: imgRecord.imageData });
			}
			if (metaRecord) {
				metadata.push({ name: metaRecord.name, data: metaRecord.data });
			}
		}

		const totalImageBytes = images.reduce((sum, img) => sum + (img.imageData?.byteLength || 0), 0);

		await callback({ images, metadata }, batchIndex, estimatedBatches);
		batchIndex++;
		batchIndices.length = 0;
		batchBytes = 0;
	};

	for (let i = 0; i < indices.length; i++) {
		const idx = indices[i];
		const itemSize = sizes[i];

		if (batchBytes + itemSize > targetBytes && batchIndices.length > 0) {
			await flushBatch();
		}

		batchIndices.push(idx);
		batchBytes += itemSize;
	}

	if (batchIndices.length > 0) {
		await flushBatch();
	}

	console.log(
		`✅ iterateBySize complete: ${batchIndex} batches processed for session ${sessionId}`
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
