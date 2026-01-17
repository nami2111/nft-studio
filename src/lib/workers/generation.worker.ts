// generation.worker.ts

import type {
    TransferrableTrait,
    TransferrableLayer,
    CompleteMessage,
    ErrorMessage,
    IncomingMessage
} from '$lib/types/worker-messages';
import { type TaskId } from '$lib/types/ids';
import { getMetadataStrategy } from '$lib/domain/metadata/strategies';
import { MetadataStandard } from '$lib/domain/metadata/strategies';

// Refactored Cache & Optimization Imports
import { WorkerArrayBufferCache } from './cache/array-buffer.cache';
import { TraitCombinationCache } from './cache/combination.cache';
import { OptimizedMemoryManager } from './memory/memory.manager';
import { SequentialPerformanceMonitor } from './monitoring/performance.monitor';
import { BlobProcessingOptimizer } from './optimization/blob.optimizer';
import { PredictiveTraitLoader } from './optimization/predictive.loader';

// Global worker instances
const workerArrayBufferCache = new WorkerArrayBufferCache();
const performanceMonitor = new SequentialPerformanceMonitor();
const imageBitmapCache = new Map<string, ImageBitmap>();
const memoryManager = new OptimizedMemoryManager();
const traitCombinationCache = new TraitCombinationCache();
const blobProcessingOptimizer = new BlobProcessingOptimizer();
const predictiveTraitLoader = new PredictiveTraitLoader();

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
        throw new Error(`Image data is empty for trait "${traitName}" (byteLength: ${buffer?.byteLength})`);
    }

    const cacheKey = `${traitName}_${buffer.byteLength}_${options?.resizeWidth || 0}_${options?.resizeHeight || 0}`;

    const cachedBitmap = imageBitmapCache.get(cacheKey);
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
        imageBitmapCache.set(cacheKey, bitmap);
        return bitmap;
    } catch (error) {
        console.error(`Failed to create ImageBitmap for ${traitName}:`, error);
        throw error;
    }
}

/**
 * Cleanup ImageBitmap cache
 */
async function clearImageBitmapCache() {
    for (const bitmap of imageBitmapCache.values()) {
        bitmap.close();
    }
    imageBitmapCache.clear();
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
            console.error(`Item ${itemIndex}: Failed to draw trait ${trait.name} on layer ${layerId}:`, err);
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
    metadataStandard: MetadataStandard = MetadataStandard.ERC721
): Promise<QueuedGeneratedItem | undefined> {
    const canvas = memoryManager.getCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        console.error(`Item ${index}: Failed to get 2D context`);
        memoryManager.returnCanvas(canvas);
        return undefined;
    }

    try {
        const generationStartTime = performance.now();
        const traitIds = solutionTraits.map(st => st.trait.id);
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
            `cid:image`,
            attributes
        );

        performanceMonitor.recordProcessing(performance.now() - generationStartTime);

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
    return (performance as any).memory?.usedJSHeapSize || 0;
}

/**
 * Main batch generation handler
 */
async function handleBatchGeneration(
    solutions: { index: number; traits: any[] }[],
    layers: TransferrableLayer[],
    collectionSize: number,
    outputSize: { width: number; height: number },
    projectName: string,
    projectDescription: string,
    taskId?: TaskId,
    metadataStandard: MetadataStandard = MetadataStandard.ERC721
) {
    performanceMonitor.start(solutions.length);

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
                metadataStandard
            );

            if (item) {
                chunkImages.push({ name: item.name, blob: item.blob });
                chunkMetadata.push({ name: `${item.index + 1}.json`, data: item.metadata });
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

        performanceMonitor.finish();
        await clearImageBitmapCache();

        const message: CompleteMessage = {
            type: 'complete',
            taskId,
            payload: {
                images: imageBuffers.map((img) => ({
                    name: img.name,
                    imageData: img.buffer
                })),
                metadata: chunkMetadata as { name: string; data: Record<string, unknown> }[],
                generatedCount: 0,
                totalCount: 0,
                isChunk: true
            }
        };

        const transferrables = imageBuffers.map((img) => img.buffer) as unknown as Transferable[];
        (self as any).postMessage(message, transferrables);

        self.postMessage({
            type: 'complete',
            taskId,
            payload: {
                images: [],
                metadata: [],
                isChunk: true
            }
        });

    } catch (error) {
        console.error('Batch processing error:', error);
        throw error;
    }
}

// Message Listener with serialization
self.addEventListener('message', (e: MessageEvent) => {
    const message = e.data as IncomingMessage;

    currentTaskQueue = currentTaskQueue.then(async () => {
        if (message.type === 'batch') {
            const { solutions, layers, collectionSize, outputSize, projectName, projectDescription, metadataStandard } = message.payload;
            try {
                await handleBatchGeneration(
                    solutions,
                    layers,
                    collectionSize,
                    outputSize,
                    projectName,
                    projectDescription,
                    message.taskId,
                    metadataStandard
                );
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    taskId: message.taskId,
                    payload: { message: error instanceof Error ? error.message : 'Batch error' }
                });
            }
        } else if (message.type === 'initialize') {
            self.postMessage({ type: 'ready' });
        } else if (message.type === 'ping') {
            self.postMessage({ type: 'pingResponse', pingResponse: (message as any).pingId });
        }
    }).catch(err => {
        console.error('Task queue fatal error:', err);
    });
});

export { };
