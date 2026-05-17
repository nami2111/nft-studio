/**
 * Streaming helper for generation images and metadata.
 * Used when enableStreamingStorage is true to avoid unbounded in-memory accumulation.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { getStorageBackend } from '$lib/storage/backend';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';

const DB_NAME = 'gnstudio-generation';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';
const METADATA_STORE = 'metadata';

interface GenerationSessionManifestItem {
	index: number;
	imageName?: string;
	imageBytes: number;
	metadataName?: string;
}

interface GenerationSessionManifest {
	sessionId: string;
	createdAt: number;
	updatedAt: number;
	items: GenerationSessionManifestItem[];
}

let dbInstance: IDBPDatabase | null = null;
const sessionWriteQueues = new Map<string, Promise<void>>();

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

function cloneJson<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}

function enqueueSessionWrite(sessionId: string, operation: () => Promise<void>): Promise<void> {
	const previous = sessionWriteQueues.get(sessionId) ?? Promise.resolve();
	const queued = previous.catch(() => {}).then(operation);

	sessionWriteQueues.set(sessionId, queued);
	queued.then(
		() => {
			if (sessionWriteQueues.get(sessionId) === queued) {
				sessionWriteQueues.delete(sessionId);
			}
		},
		() => {
			if (sessionWriteQueues.get(sessionId) === queued) {
				sessionWriteQueues.delete(sessionId);
			}
		}
	);

	return queued;
}

export async function waitForSessionWrites(
	sessionId: string,
	options: { ignoreErrors?: boolean } = {}
): Promise<void> {
	const queued = sessionWriteQueues.get(sessionId);
	if (!queued) return;

	if (options.ignoreErrors) {
		await queued.catch(() => {});
		return;
	}

	await queued;
}

async function getGenerationStorageBackend(): Promise<ObjectStorageBackend | null> {
	const backend = await getStorageBackend();
	return backend.kind === 'indexeddb-legacy' ? null : backend;
}

function createEmptyManifest(sessionId: string): GenerationSessionManifest {
	const now = Date.now();
	return {
		sessionId,
		createdAt: now,
		updatedAt: now,
		items: []
	};
}

async function readSessionManifest(
	backend: ObjectStorageBackend,
	sessionId: string
): Promise<GenerationSessionManifest> {
	return (
		(await backend.json.readJson<GenerationSessionManifest>(
			storagePaths.generationSessionManifest(sessionId)
		)) ?? createEmptyManifest(sessionId)
	);
}

async function writeSessionManifest(
	backend: ObjectStorageBackend,
	manifest: GenerationSessionManifest
): Promise<void> {
	await backend.json.writeJson(storagePaths.generationSessionManifest(manifest.sessionId), {
		...manifest,
		items: [...manifest.items].sort((a, b) => a.index - b.index),
		updatedAt: Date.now()
	});
}

function mergeSessionManifest(
	manifest: GenerationSessionManifest,
	images: Array<{ index: number; name: string; bytes: number }>,
	metadata: Array<{ index: number; name: string }>
): GenerationSessionManifest {
	const items = new Map<number, GenerationSessionManifestItem>();

	for (const item of manifest.items) {
		items.set(item.index, { ...item });
	}

	for (const image of images) {
		const current = items.get(image.index) ?? { index: image.index, imageBytes: 0 };
		items.set(image.index, {
			...current,
			imageName: image.name,
			imageBytes: image.bytes
		});
	}

	for (const meta of metadata) {
		const current = items.get(meta.index) ?? { index: meta.index, imageBytes: 0 };
		items.set(meta.index, {
			...current,
			metadataName: meta.name
		});
	}

	return {
		...manifest,
		items: Array.from(items.values()).sort((a, b) => a.index - b.index)
	};
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
 * Stream images and metadata in bulk.
 */
export async function streamBatch(
	sessionId: string,
	startIndex: number,
	images: StreamedImage[],
	metadata: StreamedMetadata[]
): Promise<void> {
	const imageEntries = images.map((img, i) => ({
		index: startIndex + i,
		name: img.name,
		imageData: img.imageData.slice(0)
	}));
	const metadataEntries = metadata.map((meta, i) => ({
		index: startIndex + i,
		name: meta.name,
		data: cloneJson(meta.data)
	}));

	const emptyImages = imageEntries.filter(
		(img) => !img.imageData || img.imageData.byteLength === 0
	);
	if (emptyImages.length > 0) {
		console.error(
			`streamBatch: ${emptyImages.length} images have empty data at startIndex=${startIndex}:`,
			emptyImages.map((img) => img.name)
		);
	}

	return enqueueSessionWrite(sessionId, async () => {
		const backend = await getGenerationStorageBackend();

		if (!backend) {
			await streamBatchToIndexedDB(sessionId, imageEntries, metadataEntries);
			return;
		}

		await Promise.all([
			...imageEntries.map((img) =>
				backend.binary.write(storagePaths.generationImage(sessionId, img.index), img.imageData)
			),
			...metadataEntries.map((meta) =>
				backend.json.writeJson(storagePaths.generationMetadata(sessionId, meta.index), {
					name: meta.name,
					data: meta.data
				})
			)
		]);

		const manifest = await readSessionManifest(backend, sessionId);
		await writeSessionManifest(
			backend,
			mergeSessionManifest(
				manifest,
				imageEntries.map((img) => ({
					index: img.index,
					name: img.name,
					bytes: img.imageData.byteLength
				})),
				metadataEntries.map((meta) => ({
					index: meta.index,
					name: meta.name
				}))
			)
		);
	});
}

async function streamBatchToIndexedDB(
	sessionId: string,
	images: Array<{ index: number; name: string; imageData: ArrayBuffer }>,
	metadata: Array<{ index: number; name: string; data: Record<string, unknown> }>
): Promise<void> {
	const db = await initDB();
	const tx = db.transaction([IMAGES_STORE, METADATA_STORE], 'readwrite');
	const imageStore = tx.objectStore(IMAGES_STORE);
	const metaStore = tx.objectStore(METADATA_STORE);

	for (const image of images) {
		imageStore.put({
			key: imageKey(sessionId, image.index),
			name: image.name,
			imageData: image.imageData
		});
	}

	for (const meta of metadata) {
		metaStore.put({
			key: metadataKey(sessionId, meta.index),
			name: meta.name,
			data: meta.data
		});
	}

	await tx.done;
}

/**
 * Iterate over image+metadata batches capped by total byte size.
 * Only holds one batch in memory at a time.
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
	await waitForSessionWrites(sessionId);

	const backend = await getGenerationStorageBackend();
	if (!backend) {
		await iterateIndexedDBBySize(sessionId, targetBytes, callback);
		return;
	}

	await iterateObjectStorageBySize(backend, sessionId, targetBytes, callback);
}

async function iterateObjectStorageBySize(
	backend: ObjectStorageBackend,
	sessionId: string,
	targetBytes: number,
	callback: (
		batch: { images: StreamedImage[]; metadata: StreamedMetadata[] },
		batchIndex: number,
		totalBatches: number
	) => Promise<void>
): Promise<void> {
	const manifest = await readSessionManifest(backend, sessionId);
	const items = manifest.items
		.filter((item) => item.imageName && item.imageBytes > 0)
		.sort((a, b) => a.index - b.index);

	if (items.length === 0) {
		console.warn(`iterateBySize: No items found for session ${sessionId}`);
		return;
	}

	const effectiveTargetBytes = Math.max(1, targetBytes);
	const totalSize = items.reduce((sum, item) => sum + item.imageBytes, 0);
	const estimatedBatches = Math.max(1, Math.ceil(totalSize / effectiveTargetBytes));

	if (import.meta.env.DEV) {
		console.log(
			`iterateBySize: ${items.length} items, ${(totalSize / 1024 / 1024).toFixed(1)}MB total, ~${estimatedBatches} batches`
		);
	}

	const batchItems: GenerationSessionManifestItem[] = [];
	let batchBytes = 0;
	let batchIndex = 0;

	const flushBatch = async (): Promise<void> => {
		if (batchItems.length === 0) return;

		const images: StreamedImage[] = [];
		const metadata: StreamedMetadata[] = [];

		for (const item of batchItems) {
			const [imageData, metaRecord] = await Promise.all([
				backend.binary.read(storagePaths.generationImage(sessionId, item.index)),
				item.metadataName
					? backend.json.readJson<{ name: string; data: Record<string, unknown> }>(
							storagePaths.generationMetadata(sessionId, item.index)
						)
					: Promise.resolve(null)
			]);

			if (imageData && item.imageName) {
				images.push({ name: item.imageName, imageData });
			}

			if (metaRecord) {
				metadata.push({ name: metaRecord.name, data: metaRecord.data });
			}
		}

		if (images.length > 0 || metadata.length > 0) {
			await callback({ images, metadata }, batchIndex, estimatedBatches);
		}

		batchIndex++;
		batchItems.length = 0;
		batchBytes = 0;
	};

	for (const item of items) {
		if (batchBytes + item.imageBytes > effectiveTargetBytes && batchItems.length > 0) {
			await flushBatch();
		}

		batchItems.push(item);
		batchBytes += item.imageBytes;
	}

	if (batchItems.length > 0) {
		await flushBatch();
	}
}

async function iterateIndexedDBBySize(
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

	if (import.meta.env.DEV) {
		console.log(`iterateBySize: Found ${allImageKeys.length} image keys for session ${sessionId}`);
	}

	const indices = allImageKeys
		.map((k) => parseInt(k.replace(imagePrefix, ''), 10))
		.sort((a, b) => a - b);

	if (indices.length === 0) {
		console.warn(`iterateBySize: No items found for session ${sessionId}`);
		return;
	}

	const sizes: number[] = Array.from({ length: indices.length }, () => 0);
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

	const effectiveTargetBytes = Math.max(1, targetBytes);
	const totalSize = sizes.reduce((sum, s) => sum + s, 0);
	const estimatedBatches = Math.max(1, Math.ceil(totalSize / effectiveTargetBytes));

	if (import.meta.env.DEV) {
		console.log(
			`iterateBySize: ${indices.length} items, ${(totalSize / 1024 / 1024).toFixed(1)}MB total, ~${estimatedBatches} batches`
		);
	}

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

		await callback({ images, metadata }, batchIndex, estimatedBatches);
		batchIndex++;
		batchIndices.length = 0;
		batchBytes = 0;
	};

	for (let i = 0; i < indices.length; i++) {
		const idx = indices[i];
		const itemSize = sizes[i];

		if (batchBytes + itemSize > effectiveTargetBytes && batchIndices.length > 0) {
			await flushBatch();
		}

		batchIndices.push(idx);
		batchBytes += itemSize;
	}

	if (batchIndices.length > 0) {
		await flushBatch();
	}
}

/**
 * Clear all data for a generation session.
 */
export async function clearSession(sessionId: string): Promise<void> {
	await waitForSessionWrites(sessionId, { ignoreErrors: true });

	const backend = await getGenerationStorageBackend();
	if (!backend) {
		await clearIndexedDBSession(sessionId);
		return;
	}

	await backend.binary.removeTree(storagePaths.generationSessionRoot(sessionId));
	sessionWriteQueues.delete(sessionId);
}

async function clearIndexedDBSession(sessionId: string): Promise<void> {
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
