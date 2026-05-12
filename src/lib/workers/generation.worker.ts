// generation.worker.ts

import { getMetadataStrategy, MetadataStandard } from '$lib/domain/metadata/strategies';
import type { TaskId } from '$lib/types/ids';
import type {
	CompleteMessage,
	IncomingMessage,
	TransferrableLayer,
	TransferrableTrait
} from '$lib/types/worker-messages';
import type {
	GenerationChunkMessage,
	InitLayersMessage,
	BatchRefMessage
} from '$lib/types/worker-messages';
import { PerformanceMonitor } from '$lib/utils/performance-monitor';
// Refactored Cache & Optimization Imports
import { WorkerArrayBufferCache } from './cache/array-buffer.cache';
import { OptimizedMemoryManager } from './memory/memory.manager';

// Global worker instances
const workerArrayBufferCache = new WorkerArrayBufferCache();
const perfMonitor = new PerformanceMonitor();

// Bounded LRU cache for ImageBitmaps (max 64 entries to bound GPU memory)
// Uses Map insertion-order semantics for O(1) LRU tracking.
const IMAGE_BITMAP_CACHE_MAX = 64;
const imageBitmapCache = new Map<string, ImageBitmap>();
let bitmapCacheHits = 0;
let bitmapCacheMisses = 0;

function getImageBitmap(key: string): ImageBitmap | undefined {
	if (!imageBitmapCache.has(key)) {
		bitmapCacheMisses++;
		return undefined;
	}
	bitmapCacheHits++;
	const bitmap = imageBitmapCache.get(key)!;
	// Move to end (most recently used) — delete + re-set preserves insertion order
	imageBitmapCache.delete(key);
	imageBitmapCache.set(key, bitmap);
	return bitmap;
}

function setImageBitmap(key: string, bitmap: ImageBitmap): void {
	if (imageBitmapCache.has(key)) {
		imageBitmapCache.delete(key);
	} else if (imageBitmapCache.size >= IMAGE_BITMAP_CACHE_MAX) {
		// Evict oldest (first key in Map insertion order)
		const oldestKey = imageBitmapCache.keys().next().value;
		if (oldestKey !== undefined) {
			const oldBitmap = imageBitmapCache.get(oldestKey);
			if (oldBitmap) oldBitmap.close();
			imageBitmapCache.delete(oldestKey);
		}
	}
	imageBitmapCache.set(key, bitmap);
}

function clearImageBitmapCache(): void {
	for (const bitmap of imageBitmapCache.values()) {
		bitmap.close();
	}
	const totalOps = bitmapCacheHits + bitmapCacheMisses;
	if (totalOps > 0) {
		perfMonitor.addCacheMetrics('imageBitmap', {
			hits: bitmapCacheHits,
			misses: bitmapCacheMisses,
			sets: imageBitmapCache.size,
			evictions: 0,
			currentEntries: imageBitmapCache.size,
			maxEntries: IMAGE_BITMAP_CACHE_MAX,
			currentSize: imageBitmapCache.size,
			maxSize: IMAGE_BITMAP_CACHE_MAX,
			memoryUsage: imageBitmapCache.size * 1024 * 1024,
			hitRate: bitmapCacheHits / totalOps
		});
	}
	imageBitmapCache.clear();
	bitmapCacheHits = 0;
	bitmapCacheMisses = 0;
}

const memoryManager = new OptimizedMemoryManager();

// Layer reference cache for enableLayerRef mode
const layerMap = new Map<string, TransferrableLayer>();
const traitMap = new Map<string, TransferrableTrait>();

// Serial task execution queue
let currentTaskQueue: Promise<void> = Promise.resolve();

/**
 * Create an ImageBitmap from ArrayBuffer - optimized for performance
 */
async function createImageBitmapFromBuffer(
	buffer: ArrayBuffer,
	traitName: string,
	options?: {
		resizeWidth?: number;
		resizeHeight?: number;
		resizeQuality?: 'pixelated' | 'low' | 'medium' | 'high';
	}
): Promise<ImageBitmap> {
	if (!buffer || buffer.byteLength === 0) {
		throw new Error(
			`Image data is empty for trait "${traitName}" (byteLength: ${buffer?.byteLength})`
		);
	}

	const resizeQuality = options?.resizeQuality || 'default';
	const cacheKey = `${traitName}_${buffer.byteLength}_${options?.resizeWidth || 0}_${options?.resizeHeight || 0}_${resizeQuality}`;

	const cachedBitmap = getImageBitmap(cacheKey);
	if (cachedBitmap) return cachedBitmap;

	const cachedBuffer = workerArrayBufferCache.get(cacheKey);
	const dataToUse = cachedBuffer || buffer;

	if (!cachedBuffer) {
		workerArrayBufferCache.set(cacheKey, buffer);
	}

	try {
		const blob = new Blob([dataToUse], { type: 'image/png' });
		const imageBitmapOptions: ImageBitmapOptions = {
			colorSpaceConversion: 'none',
			premultiplyAlpha: 'none'
		};

		if (options?.resizeWidth && options?.resizeHeight) {
			imageBitmapOptions.resizeWidth = options.resizeWidth;
			imageBitmapOptions.resizeHeight = options.resizeHeight;
			if (resizeQuality !== 'default') {
				imageBitmapOptions.resizeQuality = resizeQuality as ImageBitmapOptions['resizeQuality'];
			}
		}

		const bitmap = await createImageBitmap(blob, imageBitmapOptions);
		setImageBitmap(cacheKey, bitmap);
		return bitmap;
	} catch (error) {
		console.error(`Failed to create ImageBitmap for ${traitName}:`, error);
		throw error;
	}
}

/**
 * Direct-to-Canvas composition
 */
async function compositeTraitsDirect(
	selectedTraits: { layerId: string; trait: TransferrableTrait }[],
	ctx: OffscreenCanvasRenderingContext2D,
	targetWidth: number,
	targetHeight: number,
	itemIndex: number
): Promise<void> {
	if (!selectedTraits || selectedTraits.length === 0) {
		console.warn(`Item ${itemIndex}: No traits to composite!`);
		return;
	}

	for (const { trait, layerId } of selectedTraits) {
		if (!trait || !trait.imageData) {
			console.warn(`Item ${itemIndex}: Trait or imageData missing for layer ${layerId}`);
			continue;
		}

		try {
			const imageBitmap = await createImageBitmapFromBuffer(trait.imageData, trait.name, {
				resizeWidth: targetWidth,
				resizeHeight: targetHeight
			});

			ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
		} catch (err) {
			console.error(
				`Item ${itemIndex}: Failed to draw trait ${trait.name} on layer ${layerId}:`,
				err
			);
		}
	}
}

type QueuedGeneratedItem = {
	index: number;
	name: string;
	blob: Blob;
	metadata: object;
};

/**
 * Generate a single pre-solved item using an isolated canvas
 */
async function generateIsolatedItem(
	index: number,
	solutionTraits: { trait: TransferrableTrait; layerId: string }[],
	layers: TransferrableLayer[],
	targetWidth: number,
	targetHeight: number,
	projectName: string,
	projectDescription: string,
	metadataStandard: MetadataStandard = MetadataStandard.ERC721,
	extraData?: Record<string, unknown>
): Promise<QueuedGeneratedItem | undefined> {
	let canvas: OffscreenCanvas | undefined;

	try {
		canvas = memoryManager.getCanvas(targetWidth, targetHeight);

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			console.error(`Item ${index}: Failed to get 2D context`);
			return undefined;
		}

		const generationStartTime = performance.now();

		ctx.clearRect(0, 0, targetWidth, targetHeight);
		await compositeTraitsDirect(solutionTraits, ctx, targetWidth, targetHeight, index);

		const blob = await canvas.convertToBlob({ type: 'image/png' });

		if (blob.size < 100) {
			console.warn(`Item ${index}: Generated blob is suspiciously small (${blob.size} bytes)`);
		}

		const metadataStrategy = getMetadataStrategy(metadataStandard);
		const attributes = solutionTraits.map((st) => ({
			trait_type: layers.find((l) => l.id === st.layerId)?.name || 'Unknown',
			value: st.trait.name
		}));

		const metadata = metadataStrategy.format(
			`${projectName} #${index + 1}`,
			projectDescription,
			`images/${index + 1}.png`,
			attributes,
			extraData
		);

		perfMonitor.recordBatchItem(performance.now() - generationStartTime);

		return {
			index,
			name: `${index + 1}.png`,
			blob,
			metadata
		};
	} catch (error) {
		console.error(`Error in generateIsolatedItem for index ${index}:`, error);
		return undefined;
	} finally {
		if (canvas) {
			memoryManager.returnCanvas(canvas);
		}
	}
}

function getMemoryUsage(): number {
	return (
		(performance as unknown as { memory?: { usedJSHeapSize: number } })?.memory?.usedJSHeapSize ?? 0
	);
}

/**
 * Main batch generation handler
 */
async function handleBatchGeneration(
	solutions: {
		index: number;
		traits: { trait: TransferrableTrait; layerId: string }[];
	}[],
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	taskId?: TaskId,
	metadataStandard: MetadataStandard = MetadataStandard.ERC721,
	extraData?: Record<string, unknown>
) {
	perfMonitor.startBatch(solutions.length);

	const CHUNK_FLUSH_SIZE = 10;
	let chunkImages: { name: string; blob: Blob }[] = [];
	let chunkMetadata: { name: string; data: object }[] = [];
	let processedInChunk = 0;
	const TOTAL_IN_BATCH = solutions.length;

	try {
		for (const solution of solutions) {
			const item = await generateIsolatedItem(
				solution.index,
				solution.traits,
				layers,
				outputSize.width,
				outputSize.height,
				projectName,
				projectDescription,
				metadataStandard,
				extraData
			);

			if (item) {
				chunkImages.push({ name: item.name, blob: item.blob });
				chunkMetadata.push({
					name: `${item.index + 1}.json`,
					data: item.metadata
				});
				processedInChunk++;
			}

			// FIND-2: Flush intermediate results every CHUNK_FLUSH_SIZE items.
			// This avoids holding all blobs + array buffers simultaneously.
			if (chunkImages.length >= CHUNK_FLUSH_SIZE) {
				await flushGenerationChunk(chunkImages, chunkMetadata, taskId, false);
				chunkImages = [];
				chunkMetadata = [];
			}

			if (processedInChunk % 10 === 0) {
				self.postMessage({
					type: 'progress',
					taskId,
					payload: {
						generatedCount: solution.index + 1,
						totalCount: collectionSize,
						statusText: `Batch processing: ${processedInChunk}/${TOTAL_IN_BATCH}`,
						memoryUsage: getMemoryUsage()
					}
				});
			}
		}

		perfMonitor.finishBatch();
		clearImageBitmapCache();

		// Flush remaining items as final complete message (terminates the task)
		await flushGenerationChunk(chunkImages, chunkMetadata, taskId, true);
	} catch (error) {
		console.error('Batch processing error:', error);
		throw error;
	}
}

/**
 * Flush accumulated chunk images as a postMessage with Transferable ArrayBuffers.
 * If isFinal, sends as 'complete' (task-terminating); otherwise as 'chunk' (intermediate).
 * The worker pool forwards 'chunk' messages without resolving the task,
 * so streaming intermediate results does not trigger premature completion.
 */
async function flushGenerationChunk(
	images: { name: string; blob: Blob }[],
	metadata: { name: string; data: object }[],
	taskId: TaskId | undefined,
	isFinal: boolean
): Promise<void> {
	// Skip only when there's nothing to send and it's not the final flush
	if (images.length === 0 && !isFinal) return;

	const imageBuffers = await Promise.all(
		images.map(async (img) => ({
			name: img.name,
			buffer: await img.blob.arrayBuffer()
		}))
	);

	const payload = {
		images: imageBuffers.map((img) => ({
			name: img.name,
			imageData: img.buffer
		})),
		metadata: metadata as { name: string; data: Record<string, unknown> }[],
		generatedCount: images.length,
		totalCount: images.length
	};

	const transferrables = imageBuffers.map((img) => img.buffer) as unknown as Transferable[];

	if (isFinal) {
		const message: CompleteMessage = {
			type: 'complete',
			taskId,
			payload: { ...payload, isChunk: true }
		};
		(self as unknown as Worker).postMessage(message, transferrables);
	} else {
		const message: GenerationChunkMessage = {
			type: 'chunk',
			taskId,
			payload
		};
		(self as unknown as Worker).postMessage(message, transferrables);
	}
}

/**
 * Handle init-layers message to populate local reference maps.
 */
function handleInitLayers(message: InitLayersMessage): void {
	const { layers } = message.payload;
	layerMap.clear();
	traitMap.clear();
	for (const layer of layers) {
		layerMap.set(layer.id, layer);
		for (const trait of layer.traits) {
			traitMap.set(`${layer.id}:${trait.id}`, trait);
		}
	}
}

/**
 * Resolve trait references using the local layer/trait maps.
 */
function resolveTraitRefs(
	refs: { layerId: string; traitId: string }[]
): { layerId: string; trait: TransferrableTrait }[] {
	const resolved: { layerId: string; trait: TransferrableTrait }[] = [];
	for (const ref of refs) {
		const trait = traitMap.get(`${ref.layerId}:${ref.traitId}`);
		if (trait) {
			resolved.push({ layerId: ref.layerId, trait });
		}
	}
	return resolved;
}

// Message Listener with serialization
self.addEventListener('message', (e: MessageEvent) => {
	const message = e.data as IncomingMessage;

	currentTaskQueue = currentTaskQueue
		.then(async () => {
			if (message.type === 'batch') {
				const {
					solutions,
					layers,
					collectionSize,
					outputSize,
					projectName,
					projectDescription,
					metadataStandard,
					extraData
				} = message.payload;
				try {
					await handleBatchGeneration(
						solutions,
						layers,
						collectionSize,
						outputSize,
						projectName,
						projectDescription,
						message.taskId,
						metadataStandard,
						extraData
					);
				} catch (error) {
					self.postMessage({
						type: 'error',
						taskId: message.taskId,
						payload: {
							message: error instanceof Error ? error.message : 'Batch error'
						}
					});
				}
			} else if (message.type === 'init-layers') {
				handleInitLayers(message as InitLayersMessage);
				self.postMessage({
					type: 'complete',
					taskId: message.taskId,
					payload: { initialized: true }
				});
			} else if (message.type === 'batch-ref') {
				const {
					solutions,
					collectionSize,
					outputSize,
					projectName,
					projectDescription,
					metadataStandard,
					extraData
				} = (message as BatchRefMessage).payload;
				const resolvedSolutions = solutions.map((s) => ({
					index: s.index,
					traits: resolveTraitRefs(s.traitRefs)
				}));
				const layers = Array.from(layerMap.values());
				try {
					await handleBatchGeneration(
						resolvedSolutions,
						layers,
						collectionSize,
						outputSize,
						projectName,
						projectDescription,
						message.taskId,
						metadataStandard,
						extraData
					);
				} catch (error) {
					self.postMessage({
						type: 'error',
						taskId: message.taskId,
						payload: {
							message: error instanceof Error ? error.message : 'Batch error'
						}
					});
				}
			} else if (message.type === 'initialize') {
				self.postMessage({ type: 'ready' });
			} else if (message.type === 'ping') {
				self.postMessage({
					type: 'pingResponse',
					pingResponse: (message as unknown as { pingId: string }).pingId
				});
			}
		})
		.catch((err) => {
			console.error('Task queue fatal error:', err);
		});
});
