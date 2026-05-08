// generation.worker.ts

import { getMetadataStrategy, MetadataStandard } from '$lib/domain/metadata/strategies';
import type { TaskId } from '$lib/types/ids';
import type {
	CompleteMessage,
	IncomingMessage,
	TransferrableLayer,
	TransferrableTrait
} from '$lib/types/worker-messages';
import type { InitLayersMessage, BatchRefMessage } from '$lib/types/worker-messages';
import { PerformanceMonitor } from '$lib/utils/performance-monitor';
// Refactored Cache & Optimization Imports
import { WorkerArrayBufferCache } from './cache/array-buffer.cache';
import { OptimizedMemoryManager } from './memory/memory.manager';
import { PredictiveTraitLoader } from './optimization/predictive.loader';

// Global worker instances
const workerArrayBufferCache = new WorkerArrayBufferCache();
const perfMonitor = new PerformanceMonitor();

// Bounded LRU cache for ImageBitmaps (max 64 entries to bound GPU memory)
const IMAGE_BITMAP_CACHE_MAX = 64;
const imageBitmapCache = new Map<string, ImageBitmap>();
const imageBitmapCacheOrder: string[] = []; // access order (oldest first)

function getImageBitmap(key: string): ImageBitmap | undefined {
	const bitmap = imageBitmapCache.get(key);
	if (bitmap) {
		// Move to end (most recently used)
		const idx = imageBitmapCacheOrder.indexOf(key);
		if (idx > -1) {
			imageBitmapCacheOrder.splice(idx, 1);
			imageBitmapCacheOrder.push(key);
		}
	}
	return bitmap;
}

function setImageBitmap(key: string, bitmap: ImageBitmap): void {
	if (imageBitmapCache.has(key)) {
		// Update existing - move to end
		const idx = imageBitmapCacheOrder.indexOf(key);
		if (idx > -1) {
			imageBitmapCacheOrder.splice(idx, 1);
		}
		imageBitmapCacheOrder.push(key);
		return;
	}

	if (imageBitmapCache.size >= IMAGE_BITMAP_CACHE_MAX) {
		// Evict oldest
		const oldestKey = imageBitmapCacheOrder.shift();
		if (oldestKey) {
			const oldBitmap = imageBitmapCache.get(oldestKey);
			if (oldBitmap) oldBitmap.close();
			imageBitmapCache.delete(oldestKey);
		}
	}

	imageBitmapCache.set(key, bitmap);
	imageBitmapCacheOrder.push(key);
}

function clearImageBitmapCache(): void {
	for (const bitmap of imageBitmapCache.values()) {
		bitmap.close();
	}
	imageBitmapCache.clear();
	imageBitmapCacheOrder.length = 0;
}

const memoryManager = new OptimizedMemoryManager();
const predictiveTraitLoader = new PredictiveTraitLoader();

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
	options?: { resizeWidth?: number; resizeHeight?: number }
): Promise<ImageBitmap> {
	if (!buffer || buffer.byteLength === 0) {
		throw new Error(
			`Image data is empty for trait "${traitName}" (byteLength: ${buffer?.byteLength})`
		);
	}

	const cacheKey = `${traitName}_${buffer.byteLength}_${options?.resizeWidth || 0}_${options?.resizeHeight || 0}`;

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
			imageBitmapOptions.resizeQuality = 'high';
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
	const canvas = memoryManager.getCanvas(targetWidth, targetHeight);
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		console.error(`Item ${index}: Failed to get 2D context`);
		memoryManager.returnCanvas(canvas);
		return undefined;
	}

	try {
		const generationStartTime = performance.now();
		const traitIds = solutionTraits.map((st) => st.trait.id);
		predictiveTraitLoader.recordCombination(traitIds);

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
		memoryManager.returnCanvas(canvas);
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

	const chunkImages: { name: string; blob: Blob }[] = [];
	const chunkMetadata: { name: string; data: object }[] = [];
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

		const imageBuffers = await Promise.all(
			chunkImages.map(async (img) => ({
				name: img.name,
				buffer: await img.blob.arrayBuffer()
			}))
		);

		perfMonitor.finishBatch();
		clearImageBitmapCache();

		const message: CompleteMessage = {
			type: 'complete',
			taskId,
			payload: {
				images: imageBuffers.map((img) => ({
					name: img.name,
					imageData: img.buffer
				})),
				metadata: chunkMetadata as {
					name: string;
					data: Record<string, unknown>;
				}[],
				generatedCount: 0,
				totalCount: 0,
				isChunk: true
			}
		};

		const transferrables = imageBuffers.map((img) => img.buffer) as unknown as Transferable[];
		(self as unknown as Worker).postMessage(message, transferrables);
	} catch (error) {
		console.error('Batch processing error:', error);
		throw error;
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
