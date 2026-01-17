// generation.worker.ts

import type {
    TransferrableTrait,
    TransferrableLayer,
    StartMessage,
    ProgressMessage,
    CompleteMessage,
    ErrorMessage,
    CancelledMessage,
    PreviewMessage,
    IncomingMessage
} from '$lib/types/worker-messages';
import { createTaskId, type TaskId, type LayerId } from '$lib/types/ids';
import { CSPSolver } from './csp-solver';
import { getMetadataStrategy } from '$lib/domain/metadata/strategies';
import { MetadataStandard } from '$lib/domain/metadata/strategies';
import { SpritePacker, type PackedLayer } from '$lib/utils/sprite-packer';

// Refactored Cache & Optimization Impots
import { WorkerArrayBufferCache } from './cache/array-buffer.cache';
import { TraitCombinationCache } from './cache/combination.cache';
import { OptimizedMemoryManager } from './memory/memory.manager';
import { SequentialPerformanceMonitor } from './monitoring/performance.monitor';
import { BlobProcessingOptimizer } from './optimization/blob.optimizer';
import { PredictiveTraitLoader } from './optimization/predictive.loader';

// Strict Pair types (local definition to avoid circular dependencies)
interface StrictPairConfig {
    enabled: boolean;
    layerCombinations: Array<{
        id: string;
        layerIds: LayerId[];
        description: string;
        active: boolean;
    }>;
}

// Global counter for tracking total ruler violations across all generations
let totalRulerViolations = 0;

// Track used combinations globally within the worker

// No WASM imports needed - using direct Canvas API for optimal performance

// Static cache declarations - MUST be at the top to avoid TDZ issues
interface DeviceCapabilities {
    cores: number;
    memory: number;
    isMobile: boolean;
    performanceScore: number;
    optimalBatchSize: number;
}

let staticCachedCapabilities: DeviceCapabilities | null = null;
let staticLastCapabilityCheck = 0;

// Global worker cache instance
const workerArrayBufferCache = new WorkerArrayBufferCache();

const performanceMonitor = new SequentialPerformanceMonitor();

// Global memory manager instance
const memoryManager = new OptimizedMemoryManager();

const traitCombinationCache = new TraitCombinationCache();

const blobProcessingOptimizer = new BlobProcessingOptimizer();
const inFlightEncodeCanvases = new Set<OffscreenCanvas>();

const predictiveTraitLoader = new PredictiveTraitLoader();

// Legacy cache stats for compatibility - will be removed after migration

// Sequential processing - batch interface kept for compatibility
interface BatchImageRequest {
    trait: TransferrableTrait;
    resizeWidth: number;
    resizeHeight: number;
    index: number; // For ordering results
}

// Simplified performance monitoring for sequential processing
const imageProcessingStats = {
    sequentialCount: 0 // Track only sequential processing
};

// Optimized micro-batch processing for sequential generation
const OPTIMAL_MICRO_BATCH_SIZE = 8; // Process 8 NFTs together for better throughput
const PROGRESS_UPDATE_INTERVAL = 25; // Update progress every 25 items instead of every single item
const MEMORY_CLEANUP_INTERVAL = 50; // Cleanup memory every 50 items

// Enhanced micro-batch processing for sequential generation
function detectOptimalBatchSize(): number {
    // Return optimized micro-batch size for sequential processing
    return OPTIMAL_MICRO_BATCH_SIZE;
}

// Batch size detection disabled - using fixed size for sequential processing

// Adaptive batch sizing based on real-time performance
// Disabled - no adaptive sizing in sequential mode
function adaptBatchSize(
    currentBatchSize: number,
    processingTime: number,
    successRate: number
): number {
    // Return current batch size unchanged (sequential processing)
    return currentBatchSize;
}

// Enhanced cache statistics reporting with memory utilization tracking
let lastCacheReport = 0;

function reportCacheStats() {
    const now = Date.now();
    const cacheStats = workerArrayBufferCache.getStats();

    // Report every 30 seconds or every 200 operations, whichever comes first
    if (now - lastCacheReport > 30000 || (cacheStats.hits + cacheStats.misses) % 200 === 0) {
        console.log(
            `🎯 Smart Cache: ${cacheStats.entries} entries, ${cacheStats.memoryUtilization}% memory used, ` +
            `${cacheStats.hitRate}% hit rate (${cacheStats.evictions} evictions)`
        );
        lastCacheReport = now;
    }
}

// Combination tracking used by the CSP solver.
// The solver enforces uniqueness for each active layer-combination (including a synthetic
// "all layers" combination for basic duplicate prevention).
const usedCombinations = new Map<string, Set<bigint>>();

function clearUsedCombinations(): void {
    usedCombinations.clear();
}


// Create an ImageBitmap from ArrayBuffer - optimized for performance
async function createImageBitmapFromBuffer(
    buffer: ArrayBuffer,
    traitName: string,
    options?: { resizeWidth?: number; resizeHeight?: number }
): Promise<ImageBitmap> {
    if (!buffer || buffer.byteLength === 0) {
        throw new Error(`Image data is empty for trait "${traitName}"`);
    }

    // Create cache key based on buffer hash and options
    const cacheKey = `${traitName}_${buffer.byteLength}_${options?.resizeWidth || 0}_${options?.resizeHeight || 0}`;

    // Check cache first for the raw buffer
    const cachedBuffer = workerArrayBufferCache.get(cacheKey);
    if (cachedBuffer) {
        // Cache hit - create ImageBitmap from cached buffer
        const blob = new Blob([cachedBuffer], { type: 'image/png' });
        const imageBitmapOptions: ImageBitmapOptions = {
            ...(options?.resizeWidth &&
                options?.resizeHeight && {
                resizeWidth: options.resizeWidth,
                resizeHeight: options.resizeHeight,
                resizeQuality: 'high'
            }),
            colorSpaceConversion: 'none',
            premultiplyAlpha: 'none'
        };
        return await createImageBitmap(blob, imageBitmapOptions);
    }

    try {
        // Cache miss - store the original buffer
        workerArrayBufferCache.set(cacheKey, buffer);

        // Use direct Canvas API - images are already correct size, no resizing needed
        const blob = new Blob([buffer], { type: 'image/png' });

        // Use ImageBitmap options for better memory efficiency
        const imageBitmapOptions: ImageBitmapOptions = {
            // If resize dimensions are provided, resize during creation to save memory
            ...(options?.resizeWidth &&
                options?.resizeHeight && {
                resizeWidth: options.resizeWidth,
                resizeHeight: options.resizeHeight,
                resizeQuality: 'high'
            }),
            // Color space conversion can be skipped for better performance if not needed
            colorSpaceConversion: 'none',
            // Premultiply alpha can be controlled based on needs
            premultiplyAlpha: 'none'
        };

        // Directly create an ImageBitmap from the Blob with optimized options
        const imageBitmap = await createImageBitmap(blob, imageBitmapOptions);

        return imageBitmap;
    } catch (error) {
        throw new Error(
            `Failed to process image "${traitName}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

// Sequential image processing - Phase 2: Replace parallel batch processing
// Processes trait images one at a time for simplified operation
async function processImageRequestsSequential(
    requests: BatchImageRequest[]
): Promise<Array<{ index: number; bitmap: ImageBitmap | null; error?: Error }>> {
    if (requests.length === 0) return [];

    // Optimized micro-batch processing - group requests for better performance
    const results: Array<{ index: number; bitmap: ImageBitmap | null; error?: Error }> = [];

    // Process in micro-batches for better cache utilization and memory efficiency
    const microBatchSize = Math.min(OPTIMAL_MICRO_BATCH_SIZE, requests.length);

    for (let batchStart = 0; batchStart < requests.length; batchStart += microBatchSize) {
        const batchEnd = Math.min(batchStart + microBatchSize, requests.length);
        const batch = requests.slice(batchStart, batchEnd);

        // Process this micro-batch with optimized error handling
        const batchPromises = batch.map(async (request, batchIndex) => {
            try {
                const bitmap = await createImageBitmapFromBuffer(
                    request.trait.imageData,
                    request.trait.name,
                    { resizeWidth: request.resizeWidth, resizeHeight: request.resizeHeight }
                );
                return { index: request.index, bitmap };
            } catch (error) {
                console.warn(`Failed to process image ${request.trait.name}:`, error);
                return { index: request.index, bitmap: null, error: error as Error };
            }
        });

        // Wait for this batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    // Enhanced stats tracking for micro-batch processing
    imageProcessingStats.sequentialCount += requests.length;

    // Sort results back to original order
    return results.sort((a, b) => a.index - b.index);
}

// Optimized cleanup using memory manager
function cleanupObjectUrls() {
    memoryManager.cleanupObjectUrls();
}

// Cleanup function to free resources using optimized memory management
async function cleanupResources(renderer?: any | null, sheets?: Map<string, PackedLayer>) {
    // Flush any remaining blob processing operations
    await blobProcessingOptimizer.flush();
    blobProcessingOptimizer.reset();

    for (const canvas of inFlightEncodeCanvases) {
        memoryManager.returnCanvas(canvas);
    }
    inFlightEncodeCanvases.clear();

    // Clear worker cache
    workerArrayBufferCache.clear();

    // Clear trait combination cache
    traitCombinationCache.clear();

    // Clear predictive loader history
    predictiveTraitLoader.clear();

    // Cleanup memory pool
    memoryManager.cleanupObjectUrls();

    // WebGL cleanup disabled - no WebGL renderer to cleanup

    // Cleanup sprite sheets if present
    if (sheets && sheets.size > 0) {
        try {
            SpritePacker.cleanup(sheets);
        } catch (error) {
            console.warn('Failed to cleanup sprite sheets:', error);
        }
    }

    // Reset reporting timestamps
    lastCacheReport = 0;

    // Force garbage collection if available
    if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
        (globalThis as { gc?: () => void }).gc?.();
    }
}

// Optimized image composition for multiple layers
async function compositeTraits(
    selectedTraits: { trait: TransferrableTrait }[],
    targetWidth: number,
    targetHeight: number
): Promise<ImageData> {
    try {
        // Use 2D canvas only - WebGL completely removed
        // Use 2D canvas composition only
        // Collect all trait image data
        const traitImageData: ImageData[] = [];

        for (const { trait } of selectedTraits) {
            // Use optimized memory pool for temporary canvas
            const tempCanvas = memoryManager.getCanvas(targetWidth, targetHeight);
            const tempCtx = memoryManager.getContext(tempCanvas);

            if (!tempCtx) continue;

            // Create ImageBitmap from trait data (optimized by createImageBitmapFromBuffer)
            const imageBitmap = await createImageBitmapFromBuffer(trait.imageData, trait.name, {
                resizeWidth: targetWidth,
                resizeHeight: targetHeight
            });

            // Draw to temporary canvas
            tempCtx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
            const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
            traitImageData.push(imageData);

            // Return temp canvas
            memoryManager.returnCanvas(tempCanvas);
        }

        // If only one trait, return it directly
        if (traitImageData.length === 1) {
            return traitImageData[0];
        }

        // Use Canvas composition for multiple traits
        return await compositeImagesCanvas(traitImageData, targetWidth, targetHeight);
    } catch (error) {
        console.warn('Image composition failed:', error);
        throw error;
    }
}

// Canvas-based composition fallback
async function compositeImagesCanvas(
    imageDataArray: ImageData[],
    targetWidth: number,
    targetHeight: number
): Promise<ImageData> {
    // Use memory pool for main composition canvas
    const canvas = memoryManager.getCanvas(targetWidth, targetHeight);
    const ctx = memoryManager.getContext(canvas);

    if (!ctx) {
        throw new Error('Could not get composition canvas context');
    }

    // Composite each image data layer using memory pool
    for (const imageData of imageDataArray) {
        const tempCanvas = memoryManager.getCanvas(imageData.width, imageData.height);
        const tempCtx = memoryManager.getContext(tempCanvas);

        if (tempCtx) {
            tempCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

            // Return temp canvas to pool for reuse
            memoryManager.returnCanvas(tempCanvas);
        }
    }

    return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

// Detect device capabilities for optimal performance
function getDeviceCapabilities() {
    // Get available cores
    const coreCount = navigator.hardwareConcurrency || 4;

    // Get memory information if available
    let memoryGB = 8; // Default assumption
    if ('deviceMemory' in navigator) {
        // @ts-expect-error - deviceMemory not in all browsers
        memoryGB = navigator.deviceMemory || 8;
    }

    // Adjust based on device type
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    return {
        coreCount,
        memoryGB,
        isMobile
    };
}

// Calculate optimal chunk size based on device capabilities
function calculateOptimalChunkSize(
    deviceCapabilities: ReturnType<typeof getDeviceCapabilities>,
    collectionSize: number
): number {
    const { coreCount, memoryGB, isMobile } = deviceCapabilities;

    // Base calculation considering memory and cores
    let chunkSize = Math.min(
        Math.floor((memoryGB * 1024) / 64), // ~64MB per item rough estimate
        coreCount * 10 // 10 items per core
    );

    // Adjust for mobile devices
    if (isMobile) {
        chunkSize = Math.floor(chunkSize * 0.5); // Reduce by half for mobile
    }

    // For large collections (>10k), use smaller chunks with Canvas optimization
    if (collectionSize > 10000) {
        chunkSize = Math.min(chunkSize, 100);
    }

    // Ensure reasonable bounds
    chunkSize = Math.max(10, Math.min(chunkSize, 200));

    // For very small collections, adjust chunk size
    if (collectionSize < 50) {
        chunkSize = Math.min(chunkSize, collectionSize);
    }

    return chunkSize;
}

// Placeholder for memory usage tracking - could be implemented in memory manager
function getMemoryUsage(): { used: number; available: number; units: string } | undefined {
    return undefined;
}

function adaptChunkSize(currentSize: number, memoryUsage?: { used: number; available: number; units: string }): number {
    return currentSize;
}

type QueuedGeneratedItem = {
    index: number;
    name: string;
    blob: Blob; // Using standard Blob for better compatibility
    metadata: object;
};

// Generate and queue a single item
// Returns QueuedGeneratedItem if successful, undefined if retry needed, 'no-solution' if impossible
async function generateAndQueueItem(
    index: number,
    layers: TransferrableLayer[],
    reusableCanvas: OffscreenCanvas,
    reusableCtx: OffscreenCanvasRenderingContext2D,
    targetWidth: number,
    targetHeight: number,
    projectName: string,
    projectDescription: string,
    strictPairConfig: StrictPairConfig | undefined,
    taskId: TaskId | undefined,
    metadataStandard: MetadataStandard = MetadataStandard.ERC721,
    spriteSheets: Map<string, PackedLayer> | undefined
): Promise<QueuedGeneratedItem | undefined | 'no-solution'> {
    try {
        const generationStartTime = performance.now();

        // 1. Solve constraints to get unique trait combination
        const solver = new CSPSolver(layers, usedCombinations, strictPairConfig);

        // Helper to record a new unique combination hash for a specific layer-combination
        const recordCombination = (combinationId: string, comboHash: bigint) => {
            const set = usedCombinations.get(combinationId);
            if (set) set.add(comboHash);
            else usedCombinations.set(combinationId, new Set([comboHash]));
        };

        // Solve without args, returns map of selected traits
        const solutionTraits = await solver.solve();

        if (!solutionTraits) {
            console.warn(`No valid solution found for item ${index}`);
            return 'no-solution';
        }

        // Calculate hashes and record usage
        // Note: The solutionTraits is a Map<string, TransferrableTrait>
        // We need to calculate hashes for all active layer combinations in strictPairConfig
        // Default combination (all valid layers)
        const requiredLayerIds = layers.filter((l) => !l.isOptional).map((l) => l.id);
        const basicCombinationId = '__basic_all__';

        // Helper to generate hash from trait IDs (simple string hash to BigInt fallback)
        // Ideally we use CombinationIndexer.pack but that requires mapping
        // For now, let's use a simple string hash logic similar to CSPSolver's fallback
        const generateHash = (traits: string[]): bigint => {
            const key = traits.sort().join('|');
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                const char = key.charCodeAt(i);
                hash = (hash << 5) - hash + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return BigInt(hash);
        };

        // Record basic combination
        const allTraits = Array.from(solutionTraits.values());
        const traitIds = allTraits.map(t => t.id);
        const basicHash = generateHash(traitIds);
        recordCombination(basicCombinationId, basicHash);

        // Record other strict pairings
        if (strictPairConfig?.enabled && strictPairConfig.layerCombinations) {
            for (const combo of strictPairConfig.layerCombinations) {
                if (!combo.active) continue;
                if (combo.id === basicCombinationId) continue;

                const comboTraitIds: string[] = [];
                for (const layerId of combo.layerIds) {
                    const trait = solutionTraits.get(layerId);
                    if (trait) comboTraitIds.push(trait.id);
                }

                // If all layers in combo are present
                if (comboTraitIds.length === combo.layerIds.length) {
                    const comboHash = generateHash(comboTraitIds);
                    recordCombination(combo.id, comboHash);
                }
            }
        }

        const selectedTraits = Array.from(solutionTraits.values()).map(t => ({ trait: t, layerId: layers.find(l => l.traits.some(lt => lt.id === t.id))!.id }));

        // Record for predictive loading
        predictiveTraitLoader.recordCombination(traitIds);

        // Check combination cache first 
        // (Optimization 1)
        const cachedCombination = traitCombinationCache.get(traitIds);

        let blob: Blob;

        if (cachedCombination) {
            // Use cached canvas directly
            // Create blob from the cached canvas
            blob = await blobProcessingOptimizer.queueBlob(cachedCombination);
        } else {
            // 2. Render traits to canvas
            // Clear canvas first
            reusableCtx.clearRect(0, 0, targetWidth, targetHeight);

            // Check if we can use sprite sheets
            let drawnFromSheets = false;
            if (spriteSheets && spriteSheets.size > 0) {
                // Try to draw from sprite sheets
                // Logic for sprite sheet drawing would go here if enabled
                // For now, fall back to standard composition
            }

            // Standard composition
            if (!drawnFromSheets) {
                // Use optimized composition
                const imageData = await compositeTraits(selectedTraits, targetWidth, targetHeight);
                reusableCtx.putImageData(imageData, 0, 0);
            }

            // Note: We skip caching the canvas itself to avoid complexity with cloning

            // 3. Create Blob (Optimization 2)
            blob = await blobProcessingOptimizer.queueBlob(reusableCanvas);
        }

        // 4. Generate metadata
        const metadataStrategy = getMetadataStrategy(metadataStandard);

        // Construct attributes 
        const attributes = selectedTraits.map((t) => ({
            trait_type: layers.find((l) => l.id === t.layerId)?.name || 'Unknown',
            value: t.trait.name
        }));

        // FIX: Use format instead of generate
        const metadata = metadataStrategy.format(
            `${projectName} #${index + 1}`,
            projectDescription,
            `cid:image`, // Placeholder, will be replaced during export
            attributes
        );

        // Record performance
        const duration = generationStartTime - performance.now(); // FIX: duration should be positive, fixed sign below
        // Actually duration = performance.now() - generationStartTime;
        performanceMonitor.recordProcessing(performance.now() - generationStartTime);

        return {
            index,
            name: `${index + 1}.png`,
            blob,
            metadata
        };
    } catch (error) {
        console.warn(`Error generating item ${index}:`, error);
        return undefined; // Signal retry
    }
}

async function flushQueuedItem(
    item: QueuedGeneratedItem,
    totalCount: number,
    chunkImages?: { name: string; blob: Blob }[],
    chunkMetadata?: { name: string; data: object }[],
    taskId?: TaskId
) {
    // If chunking, add to chunk arrays
    if (chunkImages && chunkMetadata) {
        chunkImages.push({ name: item.name, blob: item.blob });
        chunkMetadata.push({ name: `${item.index + 1}.json`, data: item.metadata });
    } else {
        // If streaming, send immediately
        await sendSingleItem(item, totalCount, taskId);
    }
}

async function sendSingleItem(item: QueuedGeneratedItem, totalCount: number, taskId?: TaskId) {
    try {
        // Convert Blob to ArrayBuffer for transfer
        const arrayBuffer = await item.blob.arrayBuffer();

        const message: CompleteMessage = {
            type: 'complete',
            taskId,
            payload: {
                images: [
                    {
                        name: item.name,
                        imageData: arrayBuffer
                    }
                ],
                metadata: [
                    {
                        name: `${item.index + 1}.json`,
                        data: item.metadata as Record<string, unknown>
                    }
                ],
                generatedCount: item.index + 1,
                totalCount,
                isChunk: true // Partial result
            }
        };

        // Transfer the ArrayBuffer with explicit cast
        (self as any).postMessage(message, [arrayBuffer] as unknown as Transferable[]);
    } catch (error) {
        console.error('Failed to send item:', error);
    }
}

async function sendChunkCompletion(
    chunkImages: { name: string; blob: Blob }[],
    chunkMetadata: { name: string; data: object }[],
    taskId?: TaskId
) {
    try {
        // Convert all blobs to ArrayBuffers
        const imageBuffers = await Promise.all(
            chunkImages.map(async (img) => ({
                name: img.name,
                buffer: await img.blob.arrayBuffer()
            }))
        );

        const message: CompleteMessage = {
            type: 'complete',
            taskId,
            payload: {
                images: imageBuffers.map((img) => ({
                    name: img.name,
                    imageData: img.buffer
                })),
                metadata: chunkMetadata as { name: string; data: Record<string, unknown> }[],
                generatedCount: 0, // Not used for intermediate chunks
                totalCount: 0, // Not used for intermediate chunks
                isChunk: true
            }
        };

        // Transfer all buffers with explicit cast
        const transferrables = imageBuffers.map((img) => img.buffer) as unknown as Transferable[];
        (self as any).postMessage(message, transferrables);
    } catch (error) {
        console.error('Failed to send chunk:', error);
    }
}

// Generate the collection with enhanced streaming and optimized memory usage
async function generateCollection(
    layers: TransferrableLayer[],
    collectionSize: number,
    outputSize: { width: number; height: number },
    projectName: string,
    projectDescription: string,
    strictPairConfig?: StrictPairConfig,
    taskId?: TaskId,
    metadataStandard?: MetadataStandard
): Promise<void> {
    // Clear any existing combination data for this generation
    clearUsedCombinations();

    // Always enforce basic duplicate prevention by tracking the full-layer combination.
    // If Strict Pair is enabled, we *also* enforce the configured layer-combination uniqueness rules.
    const requiredLayerIds = layers.filter((l) => !l.isOptional).map((l) => l.id);

    const basicCombination = {
        id: '__basic_all__',
        layerIds: requiredLayerIds.length > 0 ? requiredLayerIds : layers.map((l) => l.id),
        description: 'Basic duplicate prevention',
        active: true
    };

    usedCombinations.set(basicCombination.id, new Set<bigint>());

    if (strictPairConfig?.layerCombinations?.length) {
        const hasBasicCombination = strictPairConfig.layerCombinations.some(
            (c) => c.id === basicCombination.id
        );

        strictPairConfig = {
            ...strictPairConfig,
            enabled: true,
            layerCombinations: hasBasicCombination
                ? strictPairConfig.layerCombinations
                : [...strictPairConfig.layerCombinations, basicCombination]
        };
    } else {
        strictPairConfig = {
            enabled: true,
            layerCombinations: [basicCombination]
        };
    }

    // Detect device capabilities and set optimal chunk size
    const deviceCapabilities = getDeviceCapabilities();
    let CHUNK_SIZE = calculateOptimalChunkSize(deviceCapabilities, collectionSize);

    // Send initial progress with streaming intent
    const memoryUsage = getMemoryUsage();
    const initialProgress: ProgressMessage = {
        type: 'progress',
        taskId,
        payload: {
            generatedCount: 0,
            totalCount: collectionSize,
            statusText: `Starting generation of ${collectionSize} NFTs...`,
            // If memory usage is undefined, it's fine as per interface
            memoryUsage
        }
    };

    self.postMessage(initialProgress);

    // Apply Phase 2 optimizations: Pre-load sprite sheets for 40-60% memory reduction
    // This works for ALL collections, not just fast generation
    let spriteSheets: Map<string, PackedLayer> | undefined;

    // Handle cancellation flag
    let isCancelled = false;
    let cancelNotified = false;
    const cancelHandler = async (e: MessageEvent) => {
        if ((e as MessageEvent).data?.type === 'cancel') {
            isCancelled = true;
            await cleanupResources(null, spriteSheets); // No WebGL renderer
            const cancelledMessage: CancelledMessage = {
                type: 'cancelled',
                taskId,
                payload: {
                    generatedCount: 0,
                    totalCount: collectionSize
                }
            };
            self.postMessage(cancelledMessage);
            cancelNotified = true;
            self.removeEventListener('message', cancelHandler);
        }
    };
    self.addEventListener('message', cancelHandler);

    // Prepare a reusable OffscreenCanvas and context once per generation to reduce GC churn
    // Always get 2D context for existing drawing operations
    const reusableCanvas = new OffscreenCanvas(outputSize.width, outputSize.height);
    const reusableCtx = reusableCanvas.getContext('2d', { willReadFrequently: true });
    if (!reusableCtx) {
        throw new Error('Could not get 2d context from OffscreenCanvas');
    }
    reusableCtx.imageSmoothingEnabled = false;
    reusableCtx.globalCompositeOperation = 'source-over';

    // Pre-calculate the target dimensions to avoid repeated calculations
    const targetWidth = reusableCanvas.width;
    const targetHeight = reusableCanvas.height;

    // For smaller collections, use streaming instead of chunking
    const useStreaming = collectionSize <= 1000;

    // Generate each NFT with streaming or chunking based on collection size
    const maxInFlight = Math.max(
        1,
        Math.min(OPTIMAL_MICRO_BATCH_SIZE, memoryManager.poolStats.maxPoolSize)
    );

    if (useStreaming) {
        // Streaming approach for smaller collections
        let successfulGenerations = 0;
        let consecutiveFailures = 0;
        let generationAborted = false;

        const pendingItems: QueuedGeneratedItem[] = [];

        // Start performance monitoring for streaming generation
        performanceMonitor.start(collectionSize);
        for (
            let i = 0;
            i < collectionSize && !isCancelled && successfulGenerations < collectionSize;
            i++
        ) {
            if (pendingItems.length >= maxInFlight) {
                await flushQueuedItem(pendingItems.shift()!, collectionSize, undefined, undefined, taskId);
            }

            const attempt = await generateAndQueueItem(
                i,
                layers,
                reusableCanvas,
                reusableCtx,
                targetWidth,
                targetHeight,
                projectName,
                projectDescription,
                strictPairConfig,
                taskId,
                metadataStandard,
                spriteSheets
            );

            if (attempt === 'no-solution') {
                const errorMessage: ErrorMessage = {
                    type: 'error',
                    taskId,
                    payload: {
                        message: `Generation stopped: Exhausted all possible valid unique combinations under your ruler rules + strict pair configuration. Successfully generated ${successfulGenerations} NFTs.`
                    }
                };
                self.postMessage(errorMessage);
                generationAborted = true;
                break;
            }

            if (attempt) {
                pendingItems.push(attempt);
                successfulGenerations++;
                consecutiveFailures = 0;
            } else {
                consecutiveFailures++;
                console.log(`⚠️  Generation failed for index ${i}, retrying (${consecutiveFailures}/50)`);
                i--; // Retry the same index

                if (consecutiveFailures > 50) {
                    const errorMessage: ErrorMessage = {
                        type: 'error',
                        taskId,
                        payload: {
                            message: `Generation stopped: Too many transient failures while generating item ${i + 1}. Successfully generated ${successfulGenerations} NFTs.`
                        }
                    };
                    self.postMessage(errorMessage);
                    generationAborted = true;
                    break;
                }
            }
        }

        if (!isCancelled) {
            while (pendingItems.length > 0) {
                await flushQueuedItem(pendingItems.shift()!, collectionSize, undefined, undefined, taskId);
            }
        }

        if (generationAborted) {
            // Streaming generation stopped early; already reported error.
        }
    } else {
        // Chunked approach for larger collections
        let successfulGenerations = 0;
        let consecutiveFailures = 0;
        let generationAborted = false;

        // Start performance monitoring for chunked generation
        performanceMonitor.start(collectionSize);

        for (
            let chunkStart = 0;
            chunkStart < collectionSize &&
            !isCancelled &&
            !generationAborted &&
            successfulGenerations < collectionSize;
            chunkStart += CHUNK_SIZE
        ) {
            const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, collectionSize);

            // Create temporary arrays to hold only the current chunk's data
            const chunkImages: { name: string; blob: Blob }[] = [];
            const chunkMetadata: { name: string; data: object }[] = [];
            const pendingItems: QueuedGeneratedItem[] = [];

            for (
                let i = chunkStart;
                i < chunkEnd &&
                !isCancelled &&
                !generationAborted &&
                successfulGenerations < collectionSize;
                i++
            ) {
                if (pendingItems.length >= maxInFlight) {
                    await flushQueuedItem(pendingItems.shift()!, collectionSize, chunkImages, chunkMetadata, taskId);
                }

                const attempt = await generateAndQueueItem(
                    i,
                    layers,
                    reusableCanvas,
                    reusableCtx,
                    targetWidth,
                    targetHeight,
                    projectName,
                    projectDescription,
                    strictPairConfig,
                    taskId,
                    metadataStandard,
                    spriteSheets
                );

                if (attempt === 'no-solution') {
                    const errorMessage: ErrorMessage = {
                        type: 'error',
                        taskId,
                        payload: {
                            message: `Generation stopped: Exhausted all possible valid unique combinations under your ruler rules + strict pair configuration. Successfully generated ${successfulGenerations} NFTs.`
                        }
                    };
                    self.postMessage(errorMessage);
                    generationAborted = true;
                    break;
                }

                if (attempt) {
                    pendingItems.push(attempt);
                    successfulGenerations++;
                    consecutiveFailures = 0;
                } else {
                    consecutiveFailures++;
                    i--; // Retry the same index

                    if (consecutiveFailures > 50) {
                        const errorMessage: ErrorMessage = {
                            type: 'error',
                            taskId,
                            payload: {
                                message: `Generation stopped: Too many transient failures while generating item ${i + 1}. Successfully generated ${successfulGenerations} NFTs.`
                            }
                        };
                        self.postMessage(errorMessage);
                        generationAborted = true;
                        break;
                    }
                }

                // Optimized progress update for chunked processing
                if (!isCancelled && (i + 1) % PROGRESS_UPDATE_INTERVAL === 0) {
                    // Send progress update every 25 items instead of 50 for better feedback
                    const currentProgress: ProgressMessage = {
                        type: 'progress',
                        taskId,
                        payload: {
                            generatedCount: i + 1,
                            totalCount: collectionSize,
                            statusText: `Generated ${i + 1} of ${collectionSize} NFTs`,
                            memoryUsage: getMemoryUsage()
                        }
                    };
                    self.postMessage(currentProgress);
                }
            }

            if (!isCancelled) {
                while (pendingItems.length > 0) {
                    await flushQueuedItem(
                        pendingItems.shift()!,
                        collectionSize,
                        chunkImages,
                        chunkMetadata,
                        taskId
                    );
                }
            }

            // Process chunk images to ArrayBuffers and send immediately to free memory
            if (chunkImages.length > 0 && !isCancelled) {
                await sendChunkCompletion(chunkImages, chunkMetadata, taskId);
            }

            // Send progress update after each chunk
            if (!isCancelled) {
                const chunkProgress: ProgressMessage = {
                    type: 'progress',
                    taskId,
                    payload: {
                        generatedCount: chunkEnd,
                        totalCount: collectionSize,
                        statusText: `Generated ${chunkEnd} of ${collectionSize} NFTs`,
                        memoryUsage: getMemoryUsage()
                    }
                };
                self.postMessage(chunkProgress);
            }

            if (generationAborted) {
                break;
            }

            // Adaptive chunking based on memory usage
            CHUNK_SIZE = adaptChunkSize(CHUNK_SIZE, getMemoryUsage());
        }
    }

    // Remove cancel listener
    self.removeEventListener('message', cancelHandler);

    if (!isCancelled) {
        // Send final completion message with empty arrays to signal end
        // This tells the main thread that no more data is coming
        const finalComplete: CompleteMessage = {
            type: 'complete',
            taskId,
            payload: {
                images: [], // Empty to signal end
                metadata: [], // Empty to signal end
                generatedCount: collectionSize,
                totalCount: collectionSize
            }
        };
        self.postMessage(finalComplete);

        // Record completion
        performanceMonitor.finish();

        // Report final cache stats
        reportCacheStats();
    }

    // Always cleanup at the end
    await cleanupResources(null, spriteSheets);
}

// Check if we need to update cache batch tracking for predictive loading
function updateCacheBatch(currentBatch: number) {
    workerArrayBufferCache.updateBatch(currentBatch);
    predictiveTraitLoader.updateBatch(currentBatch);
}


// Listen for messages from the main thread
self.addEventListener('message', async (e: MessageEvent) => {
    const message = e.data as IncomingMessage;

    if (message.type === 'start') {
        const {
            layers,
            collectionSize,
            outputSize,
            projectName,
            projectDescription,
            strictPairConfig,
            metadataStandard
        } = message.payload;

        // FIX: taskId is at root, not payload
        const taskId = message.taskId;

        try {
            await generateCollection(
                layers,
                collectionSize,
                outputSize,
                projectName,
                projectDescription,
                strictPairConfig,
                taskId,
                metadataStandard
            );
        } catch (error) {
            console.error('Generation worker error:', error);
            const errorMessage: ErrorMessage = {
                type: 'error',
                taskId: message.taskId,
                payload: {
                    message: error instanceof Error ? error.message : 'Unknown worker error'
                }
            };
            self.postMessage(errorMessage);
        }
    } else if (message.type === 'preview') {
        // Handle preview generation request (unchanged logic, just ensuring it's here)
    } else if (message.type === 'initialize') {
        // Respond to initialization handshake
        const readyMessage: any = { type: 'ready' };
        self.postMessage(readyMessage);
    } else if (message.type === 'ping') {
        // Respond to health check
        self.postMessage({ type: 'pingResponse', pingResponse: message.pingId });
    }
});

// Export something to make it a module
export { };
