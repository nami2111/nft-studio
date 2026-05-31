/**
 * Streaming helper for generation images and metadata.
 * Used when enableStreamingStorage is true to avoid unbounded in-memory accumulation.
 */

import { getStorageBackend } from '$lib/storage/backend';
import { requestPersistentStorageOnce } from '$lib/storage/capabilities';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';

const LARGE_GENERATION_SESSION_BYTES = 50 * 1024 * 1024;
const DEFAULT_STALE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

export interface CleanupStaleGenerationSessionsOptions {
	activeSessionIds?: Iterable<string>;
	maxAgeMs?: number;
	now?: number;
	preserveActiveWrites?: boolean;
}

export interface CleanupStaleGenerationSessionsResult {
	removedSessionIds: string[];
	skippedSessionIds: string[];
	failedSessionIds: string[];
}

const sessionWriteQueues = new Map<string, Promise<void>>();

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

async function getGenerationStorageBackend(): Promise<ObjectStorageBackend> {
	return getStorageBackend();
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

function getManifestTimestamp(manifest: GenerationSessionManifest | null): number | null {
	if (manifest?.updatedAt) return manifest.updatedAt;
	if (manifest?.createdAt) return manifest.createdAt;
	return null;
}

function parseSessionTimestamp(sessionId: string): number | null {
	const match = /^gen-(\d+)-/.exec(sessionId);
	if (!match) return null;

	const timestamp = Number(match[1]);
	return Number.isFinite(timestamp) ? timestamp : null;
}

function getSessionAgeMs(
	sessionId: string,
	manifest: GenerationSessionManifest | null,
	now: number
): number | null {
	const timestamp = getManifestTimestamp(manifest) ?? parseSessionTimestamp(sessionId);
	return timestamp === null ? null : now - timestamp;
}

function getActiveSessionIds(options: CleanupStaleGenerationSessionsOptions): Set<string> {
	const activeSessionIds = new Set(options.activeSessionIds ?? []);
	if (options.preserveActiveWrites !== false) {
		for (const sessionId of sessionWriteQueues.keys()) {
			activeSessionIds.add(sessionId);
		}
	}

	return activeSessionIds;
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
		const mergedManifest = mergeSessionManifest(
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
		);
		await writeSessionManifest(backend, mergedManifest);

		const sessionImageBytes = mergedManifest.items.reduce((sum, item) => sum + item.imageBytes, 0);
		if (sessionImageBytes >= LARGE_GENERATION_SESSION_BYTES) {
			void requestPersistentStorageOnce('generation-session');
		}
	});
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

/**
 * Clear all data for a generation session.
 */
export async function clearSession(sessionId: string): Promise<void> {
	await waitForSessionWrites(sessionId, { ignoreErrors: true });

	const backend = await getGenerationStorageBackend();
	await backend.binary.removeTree(storagePaths.generationSessionRoot(sessionId));
	sessionWriteQueues.delete(sessionId);
}

export async function cleanupStaleGenerationSessions(
	options: CleanupStaleGenerationSessionsOptions = {}
): Promise<CleanupStaleGenerationSessionsResult> {
	const backend = await getGenerationStorageBackend();
	const result: CleanupStaleGenerationSessionsResult = {
		removedSessionIds: [],
		skippedSessionIds: [],
		failedSessionIds: []
	};

	const now = options.now ?? Date.now();
	const maxAgeMs = Math.max(0, options.maxAgeMs ?? DEFAULT_STALE_SESSION_MAX_AGE_MS);
	const activeSessionIds = getActiveSessionIds(options);

	const sessionIds = await backend.binary.list(storagePaths.generationRoot());

	for (const sessionId of sessionIds) {
		if (activeSessionIds.has(sessionId)) {
			result.skippedSessionIds.push(sessionId);
			continue;
		}

		let manifest: GenerationSessionManifest | null = null;
		try {
			manifest = await backend.json.readJson<GenerationSessionManifest>(
				storagePaths.generationSessionManifest(sessionId)
			);
		} catch {
			manifest = null;
		}

		const sessionAgeMs = getSessionAgeMs(sessionId, manifest, now);
		if (maxAgeMs > 0 && (sessionAgeMs === null || sessionAgeMs < maxAgeMs)) {
			result.skippedSessionIds.push(sessionId);
			continue;
		}

		try {
			await waitForSessionWrites(sessionId, { ignoreErrors: true });
			await backend.binary.removeTree(storagePaths.generationSessionRoot(sessionId));
			result.removedSessionIds.push(sessionId);
		} catch {
			result.failedSessionIds.push(sessionId);
		}
	}

	return result;
}
