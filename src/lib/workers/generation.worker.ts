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
import { createTaskId, type TaskId } from '$lib/types/ids';
import { CSPSolver } from './csp-solver';
import { getMetadataStrategy } from '$lib/domain/metadata/strategies';
import { MetadataStandard } from '$lib/domain/metadata/strategies';

// Strict Pair types (local definition to avoid circular dependencies)
interface StrictPairConfig {
	enabled: boolean;
	layerCombinations: Array<{
		id: string;
		layerIds: string[];
		description: string;
		active: boolean;
	}>;
}

// Track used combinations globally within the worker

// No WASM imports needed - using direct Canvas API for optimal performance

// Enhanced worker-level LRU cache with intelligent sizing and smart eviction
// Optimized for ArrayBuffer storage with memory pressure management
class WorkerArrayBufferCache {
	private cache = new Map<
		string,
		{
			buffer: ArrayBuffer;
			accessTime: number;
			size: number;
			accessCount: number;
			creationTime: number;
		}
	>();

	private maxEntries: number;
	private maxMemoryBytes: number;
	private currentMemoryUsage = 0;
	private deviceMemoryGB: number;

	// Performance tracking
	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		memoryPressure: 0
	};

	constructor() {
		// Intelligent cache sizing based on device capabilities
		this.deviceMemoryGB = (navigator as any).deviceMemory || 4;
		this.maxEntries = this.calculateOptimalEntries();
		this.maxMemoryBytes = this.calculateOptimalMemory();

		console.log(
			`🧠 Cache initialized: ${this.maxEntries} entries, ${(this.maxMemoryBytes / 1024 / 1024).toFixed(1)}MB max`
		);
	}

	private calculateOptimalEntries(): number {
		// Base calculation on device memory and CPU cores
		const cores = navigator.hardwareConcurrency || 4;
		let entries = Math.min(this.deviceMemoryGB * 25, 200); // 25 entries per GB, max 200

		// Adjust for CPU cores (more cores = more parallel processing = bigger cache)
		entries = Math.min(entries * Math.max(1, cores / 4), 300);

		return Math.max(50, Math.floor(entries)); // Minimum 50 entries
	}

	private calculateOptimalMemory(): number {
		// Allocate 15% of available device memory for cache
		const availableMemoryBytes = this.deviceMemoryGB * 1024 * 1024 * 1024;
		const cacheAllocationBytes = availableMemoryBytes * 0.15;

		// Cap at 100MB to prevent memory issues
		return Math.min(cacheAllocationBytes, 100 * 1024 * 1024);
	}

	get(key: string): ArrayBuffer | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			entry.accessTime = Date.now();
			entry.accessCount++;
			this.stats.hits++;
			return entry.buffer;
		}
		this.stats.misses++;
		return undefined;
	}

	set(key: string, buffer: ArrayBuffer): void {
		const bufferSize = buffer.byteLength;

		// Check memory pressure and evict if necessary
		if (
			this.currentMemoryUsage + bufferSize > this.maxMemoryBytes ||
			this.cache.size >= this.maxEntries
		) {
			this.evictEntries(bufferSize);
		}

		// Remove existing entry if it exists (for updates)
		const existing = this.cache.get(key);
		if (existing) {
			this.currentMemoryUsage -= existing.size;
		}

		this.cache.set(key, {
			buffer,
			accessTime: Date.now(),
			size: bufferSize,
			accessCount: 1,
			creationTime: Date.now()
		});

		this.currentMemoryUsage += bufferSize;
	}

	/**
	 * Smart eviction using LRU + frequency + memory pressure
	 * Prioritizes frequently accessed + large + old entries for eviction
	 */
	private evictEntries(requiredSpace: number): void {
		const entries = Array.from(this.cache.entries());

		// Sort by eviction score: (accessCount / daysSinceCreation) * size
		const scoredEntries = entries.map(([key, entry]) => {
			const daysSinceCreation = (Date.now() - entry.creationTime) / (1000 * 60 * 60 * 24);
			const accessFrequency = entry.accessCount / Math.max(1, daysSinceCreation);
			const evictionScore = (accessFrequency / Math.max(1, entry.size / 1024)) * 1000; // Higher score = more likely to evict

			return { key, entry, evictionScore };
		});

		// Sort by eviction score (higher score = better candidate for eviction)
		scoredEntries.sort((a, b) => b.evictionScore - a.evictionScore);

		let freedSpace = 0;
		const maxEvictions = Math.min(scoredEntries.length, 10); // Don't evict too many at once

		for (let i = 0; i < maxEvictions && freedSpace < requiredSpace; i++) {
			const { key, entry } = scoredEntries[i];
			this.cache.delete(key);
			this.currentMemoryUsage -= entry.size;
			freedSpace += entry.size;
			this.stats.evictions++;
		}

		if (freedSpace < requiredSpace) {
			this.stats.memoryPressure++;
			// If still not enough space, force evict oldest entries
			const oldestEntries = entries
				.sort((a, b) => a[1].creationTime - b[1].creationTime)
				.slice(0, 5);

			for (const [key, entry] of oldestEntries) {
				if (this.cache.has(key)) {
					this.cache.delete(key);
					this.currentMemoryUsage -= entry.size;
					this.stats.evictions++;
				}
			}
		}
	}

	clear(): void {
		this.cache.clear();
		this.currentMemoryUsage = 0;
	}

	get size(): number {
		return this.cache.size;
	}

	get memoryUsage(): number {
		return this.currentMemoryUsage;
	}

	/**
	 * Get cache performance statistics
	 */
	getStats() {
		const totalOps = this.stats.hits + this.stats.misses;
		const hitRate = totalOps > 0 ? (this.stats.hits / totalOps) * 100 : 0;

		return {
			...this.stats,
			hitRate: hitRate.toFixed(1),
			entries: this.cache.size,
			memoryUsageMB: (this.currentMemoryUsage / 1024 / 1024).toFixed(1),
			maxMemoryMB: (this.maxMemoryBytes / 1024 / 1024).toFixed(1),
			memoryUtilization: ((this.currentMemoryUsage / this.maxMemoryBytes) * 100).toFixed(1)
		};
	}
}

// Global worker cache instance
const workerArrayBufferCache = new WorkerArrayBufferCache();

// Legacy cache stats for compatibility - will be removed after migration

// Parallel processing optimization
interface BatchImageRequest {
	trait: TransferrableTrait;
	resizeWidth: number;
	resizeHeight: number;
	index: number; // For ordering results
}

// Performance monitoring for parallel processing
const imageProcessingStats = {
	batchCount: 0,
	parallelCount: 0,
	sequentialCount: 0,
	averageBatchSize: 0
};

/**
 * Memory Pool for pre-allocated ArrayBuffers to reduce GC pressure
 * Especially useful for predictable chunk sizes during batch generation
 */
class ArrayBufferPool {
	private pools = new Map<number, ArrayBuffer[]>();
	private maxPoolSize = 10; // Keep up to 10 buffers per size

	/**
	 * Get an ArrayBuffer of the specified size, either from pool or create new
	 */
	get(size: number): ArrayBuffer {
		const pool = this.pools.get(size) || [];

		if (pool.length > 0) {
			return pool.pop()!;
		}

		// Create new buffer if pool is empty
		return new ArrayBuffer(size);
	}

	/**
	 * Return an ArrayBuffer to the pool for reuse
	 */
	return(buffer: ArrayBuffer): void {
		const size = buffer.byteLength;
		const pool = this.pools.get(size) || [];

		if (pool.length < this.maxPoolSize) {
			pool.push(buffer);
			this.pools.set(size, pool);
		}
		// If pool is full, let the buffer be garbage collected
	}

	/**
	 * Clear all pools to free memory
	 */
	clear(): void {
		this.pools.clear();
	}

	/**
	 * Get pool statistics
	 */
	getStats() {
		let totalBuffers = 0;
		let totalSize = 0;

		for (const [size, pool] of this.pools) {
			totalBuffers += pool.length;
			totalSize += size * pool.length;
		}

		return {
			totalBuffers,
			totalSize,
			totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
			poolCount: this.pools.size
		};
	}
}

// Global memory pool instance
const arrayBufferPool = new ArrayBufferPool();

// Device capability detection for optimal batch sizing
function detectOptimalBatchSize(): number {
	const cores = navigator.hardwareConcurrency || 4;
	const memory = (navigator as any).deviceMemory || 4;

	// Conservative batch sizing based on device capabilities
	let batchSize = Math.min(cores * 2, 8); // Default: 2x cores, max 8

	// Adjust for memory (GB)
	if (memory >= 8) batchSize = Math.min(batchSize * 2, 12);
	else if (memory <= 2) batchSize = Math.min(batchSize, 4);

	// Adjust for mobile (heuristic: fewer cores = likely mobile)
	if (cores <= 2) batchSize = Math.min(batchSize, 4);

	return Math.max(2, batchSize); // Minimum batch size of 2
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

// Track used combinations globally within the worker
const usedCombinations = new Map<string, Set<string>>();

// Mark a trait combination as used
function markCombinationAsUsed(
	selectedTraits: { traitId: string; layerId: string }[],
	strictPairConfig: StrictPairConfig | undefined
): void {
	if (!strictPairConfig?.enabled) return;

	for (const layerCombination of strictPairConfig.layerCombinations) {
		if (!layerCombination.active) continue;

		// Find the traits from all layers in the selected traits
		const foundTraits: string[] = [];
		let allLayersPresent = true;

		for (const layerId of layerCombination.layerIds) {
			const trait = selectedTraits.find((t) => t.layerId === layerId);
			if (trait) {
				foundTraits.push(trait.traitId);
			} else {
				allLayersPresent = false;
				break;
			}
		}

		// All layers must be present in the selected traits for this rule to apply
		if (!allLayersPresent) continue;

		// Generate and mark the combination
		const combinationKey = foundTraits.sort().join('|');

		if (!usedCombinations.has(layerCombination.id)) {
			usedCombinations.set(layerCombination.id, new Set());
		}

		const usedSet = usedCombinations.get(layerCombination.id)!;
		usedSet.add(combinationKey);
	}
}

// Clear used combinations for a new generation
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

/**
 * Parallel batch image processing for maximum GPU utilization
 * Processes multiple trait images concurrently using Promise.all
 * @param requests - Array of image processing requests
 * @returns Promise resolving to array of ImageBitmaps in original order
 */
async function processBatchImageRequests(
	requests: BatchImageRequest[]
): Promise<Array<{ index: number; bitmap: ImageBitmap | null; error?: Error }>> {
	if (requests.length === 0) return [];
	if (requests.length === 1) {
		// Single image - use existing optimized method
		const req = requests[0];
		try {
			const bitmap = await createImageBitmapFromBuffer(req.trait.imageData, req.trait.name, {
				resizeWidth: req.resizeWidth,
				resizeHeight: req.resizeHeight
			});
			return [{ index: req.index, bitmap }];
		} catch (error) {
			return [{ index: req.index, bitmap: null, error: error as Error }];
		}
	}

	// Multiple images - process in parallel for maximum performance
	const optimalBatchSize = detectOptimalBatchSize();
	imageProcessingStats.batchCount++;
	imageProcessingStats.parallelCount += requests.length;

	if (requests.length > optimalBatchSize) {
		imageProcessingStats.averageBatchSize =
			(imageProcessingStats.averageBatchSize + requests.length) / 2;
	}

	// Process in chunks if batch is too large
	const results: Array<{ index: number; bitmap: ImageBitmap | null; error?: Error }> = [];

	if (requests.length <= optimalBatchSize) {
		// Small batch - process all at once
		const promises = requests.map(async (request) => {
			try {
				const bitmap = await createImageBitmapFromBuffer(
					request.trait.imageData,
					request.trait.name,
					{ resizeWidth: request.resizeWidth, resizeHeight: request.resizeHeight }
				);
				return { index: request.index, bitmap };
			} catch (error) {
				return { index: request.index, bitmap: null, error: error as Error };
			}
		});

		const batchResults = await Promise.all(promises);
		results.push(...batchResults);
	} else {
		// Large batch - process in optimal chunks to avoid memory pressure
		for (let i = 0; i < requests.length; i += optimalBatchSize) {
			const chunk = requests.slice(i, i + optimalBatchSize);
			const chunkPromises = chunk.map(async (request) => {
				try {
					const bitmap = await createImageBitmapFromBuffer(
						request.trait.imageData,
						request.trait.name,
						{ resizeWidth: request.resizeWidth, resizeHeight: request.resizeHeight }
					);
					return { index: request.index, bitmap };
				} catch (error) {
					return { index: request.index, bitmap: null, error: error as Error };
				}
			});

			const chunkResults = await Promise.all(chunkPromises);
			results.push(...chunkResults);
		}
	}

	// Sort results back to original order
	return results.sort((a, b) => a.index - b.index);
}

/**
 * Report parallel processing performance statistics
 */
function reportImageProcessingStats(): void {
	const totalProcessed = imageProcessingStats.parallelCount + imageProcessingStats.sequentialCount;
	if (totalProcessed > 0) {
		const parallelRatio = ((imageProcessingStats.parallelCount / totalProcessed) * 100).toFixed(1);
		console.log(
			`🖼️ Parallel Processing: ${parallelRatio}% parallel, ` +
				`avg batch size: ${imageProcessingStats.averageBatchSize.toFixed(1)}`
		);
	}
}

// No-op to keep call sites intact; retained for backward compatibility
function cleanupObjectUrls() {
	// Intentionally empty: we no longer create object URLs in the worker
}

// Cleanup function to free resources
function cleanupResources() {
	// Clear worker cache
	workerArrayBufferCache.clear();

	// Clear memory pool
	arrayBufferPool.clear();

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
		// Collect all trait image data
		const traitImageData: ImageData[] = [];

		for (const { trait } of selectedTraits) {
			// Create temporary canvas for each trait
			const tempCanvas = new OffscreenCanvas(targetWidth, targetHeight);
			const tempCtx = tempCanvas.getContext('2d');

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
	const canvas = new OffscreenCanvas(targetWidth, targetHeight);
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Could not get composition canvas context');
	}

	// Composite each image data layer
	for (const imageData of imageDataArray) {
		const tempCanvas = new OffscreenCanvas(imageData.width, imageData.height);
		const tempCtx = tempCanvas.getContext('2d');

		if (tempCtx) {
			tempCtx.putImageData(imageData, 0, 0);
			ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
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
	// Use a smaller initial array size to reduce memory footprint
	const metadata: { name: string; data: object }[] = [];

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
			memoryUsage: memoryUsage || undefined
		}
	};

	self.postMessage(initialProgress);

	// Handle cancellation flag
	let isCancelled = false;
	const cancelHandler = (e: MessageEvent) => {
		if ((e as MessageEvent).data?.type === 'cancel') {
			isCancelled = true;
			cleanupResources();
			const cancelledMessage: CancelledMessage = {
				type: 'cancelled',
				taskId,
				payload: {
					generatedCount: 0,
					totalCount: collectionSize
				}
			};
			self.postMessage(cancelledMessage);
			self.removeEventListener('message', cancelHandler);
		}
	};
	self.addEventListener('message', cancelHandler);

	// Prepare a reusable OffscreenCanvas and context once per generation to reduce GC churn
	const reusableCanvas = new OffscreenCanvas(outputSize.width, outputSize.height);
	const reusableCtx = reusableCanvas.getContext('2d');
	if (!reusableCtx) {
		throw new Error('Could not get 2d context from OffscreenCanvas');
	}

	// Optimize canvas context settings for better performance
	reusableCtx.imageSmoothingEnabled = false; // Disable smoothing for pixel-perfect rendering
	reusableCtx.globalCompositeOperation = 'source-over';

	// Pre-calculate the target dimensions to avoid repeated calculations
	const targetWidth = reusableCanvas.width;
	const targetHeight = reusableCanvas.height;

	// For smaller collections, use streaming instead of chunking
	const useStreaming = collectionSize <= 1000;

	// Generate each NFT with streaming or chunking based on collection size
	if (useStreaming) {
		// Streaming approach for smaller collections
		let successfulGenerations = 0;
		let consecutiveFailures = 0;
		for (
			let i = 0;
			i < collectionSize && !isCancelled && successfulGenerations < collectionSize;
			i++
		) {
			// Generate item
			const success = await generateAndStreamItem(
				i,
				layers,
				reusableCanvas,
				reusableCtx,
				targetWidth,
				targetHeight,
				projectName,
				projectDescription,
				collectionSize,
				metadata,
				strictPairConfig,
				undefined, // No chunking for streaming mode
				taskId,
				metadataStandard
			);

			if (success) {
				successfulGenerations++;
				consecutiveFailures = 0;
			} else {
				// Generation failed due to strict pair constraints, try again
				consecutiveFailures++;
				i--; // Retry the same index

				// Safety check: if we have too many consecutive failures, we might be out of valid combinations
				if (consecutiveFailures > 1000) {
					const errorMessage: ErrorMessage = {
						type: 'error',
						taskId,
						payload: {
							message: `Generation stopped: Exhausted all possible unique combinations. Successfully generated ${successfulGenerations} NFTs, but no more valid combinations are available with the current strict pair configuration.`
						}
					};
					self.postMessage(errorMessage);
					break;
				}
			}
		}
	} else {
		// Chunked approach for larger collections
		let successfulGenerations = 0;
		let consecutiveFailures = 0;
		for (
			let chunkStart = 0;
			chunkStart < collectionSize && !isCancelled && successfulGenerations < collectionSize;
			chunkStart += CHUNK_SIZE
		) {
			const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, collectionSize);

			// Create a temporary array to hold only the current chunk's images
			const chunkImages: { name: string; blob: Blob }[] = [];

			for (
				let i = chunkStart;
				i < chunkEnd && !isCancelled && successfulGenerations < collectionSize;
				i++
			) {
				// Generate item
				const success = await generateAndStreamItem(
					i,
					layers,
					reusableCanvas,
					reusableCtx,
					targetWidth,
					targetHeight,
					projectName,
					projectDescription,
					collectionSize,
					metadata,
					strictPairConfig,
					chunkImages,
					taskId,
					metadataStandard
				);

				if (success) {
					successfulGenerations++;
					consecutiveFailures = 0;
				} else {
					// Generation failed due to strict pair constraints, try again
					consecutiveFailures++;
					i--; // Retry the same index

					// Safety check: if we have too many consecutive failures, we might be out of valid combinations
					if (consecutiveFailures > 1000) {
						const errorMessage: ErrorMessage = {
							type: 'error',
							taskId,
							payload: {
								message: `Generation stopped: Exhausted all possible unique combinations. Successfully generated ${successfulGenerations} NFTs, but no more valid combinations are available with the current strict pair configuration.`
							}
						};
						self.postMessage(errorMessage);
						break;
					}
				}

				// Send progress update for each item in large chunks to show progress
				if (!isCancelled && (i + 1) % 50 === 0) {
					// Send progress update every 50 items
					const currentProgress: ProgressMessage = {
						type: 'progress',
						taskId,
						payload: {
							generatedCount: i + 1,
							totalCount: collectionSize,
							statusText: `Generated ${i + 1} of ${collectionSize} NFTs`,
							memoryUsage: getMemoryUsage() || undefined
						}
					};
					self.postMessage(currentProgress);
				}
			}

			// Process chunk images to ArrayBuffers and send immediately to free memory
			if (chunkImages.length > 0 && !isCancelled) {
				await sendChunkCompletion(chunkImages, metadata, chunkStart, taskId);
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
						memoryUsage: getMemoryUsage() || undefined
					}
				};
				self.postMessage(chunkProgress);
			}

			// Adaptive chunking based on memory usage
			CHUNK_SIZE = adaptChunkSize(CHUNK_SIZE, getMemoryUsage());
		}
	}

	// Remove cancel listener
	self.removeEventListener('message', cancelHandler);

	// Check if cancelled before final processing
	if (isCancelled) {
		const cancelledMessage: CancelledMessage = {
			type: 'cancelled',
			taskId,
			payload: {
				generatedCount: 0,
				totalCount: collectionSize
			}
		};
		self.postMessage(cancelledMessage);
		return;
	}

	// Report final cache and processing statistics (before cleanup)
	const cacheStats = workerArrayBufferCache.getStats();
	const poolStats = arrayBufferPool.getStats();
	const totalProcessed = imageProcessingStats.parallelCount + imageProcessingStats.sequentialCount;
	const parallelRatio =
		totalProcessed > 0
			? ((imageProcessingStats.parallelCount / totalProcessed) * 100).toFixed(1)
			: '0.0';

	console.log(
		`✅ Generation Complete - Smart Cache: ${cacheStats.entries} entries, ` +
			`${cacheStats.memoryUtilization}% memory, ${cacheStats.hitRate}% hit rate | ` +
			`Memory Pool: ${poolStats.totalBuffers} buffers, ${poolStats.totalSizeMB}MB | ` +
			`Parallel: ${parallelRatio}% (${imageProcessingStats.parallelCount}/${totalProcessed})`
	);

	// Report detailed parallel processing performance
	reportImageProcessingStats();

	// Send final completion message
	const finalCompleteMessage: CompleteMessage = {
		type: 'complete',
		taskId,
		payload: {
			images: [], // Already sent via streaming/chunking
			metadata: [] // Already sent via streaming/chunking
		}
	};

	self.postMessage(finalCompleteMessage);

	// Final cleanup (after reporting)
	cleanupResources();
}

// Generate a single item and stream it immediately
async function generateAndStreamItem(
	index: number,
	layers: TransferrableLayer[],
	canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	targetWidth: number,
	targetHeight: number,
	projectName: string,
	projectDescription: string,
	collectionSize: number,
	metadata: { name: string; data: object }[],
	strictPairConfig?: StrictPairConfig,
	chunkImages?: { name: string; blob: Blob }[],
	taskId?: TaskId,
	metadataStandard?: MetadataStandard
): Promise<boolean> {
	try {
		// Always use optimized Canvas compositing
		// Clear the reusable canvas for this item
		ctx.clearRect(0, 0, targetWidth, targetHeight);

		// Selected traits for this NFT
		const selectedTraits: { traitId: string; layerId: string; trait: TransferrableTrait }[] = [];
		const hasRequiredLayerFailure = false;

		// Use CSP Solver to find a valid combination
		const solver = new CSPSolver(layers, usedCombinations, strictPairConfig);
		const solution = solver.solve();

		if (!solution) {
			return false; // No valid combination found
		}

		// Collect all selected traits for batch processing
		for (const layer of layers) {
			const selectedTrait = solution.get(layer.id);

			if (selectedTrait) {
				selectedTraits.push({
					traitId: selectedTrait.id,
					layerId: layer.id,
					trait: selectedTrait
				});
			}
		}

		// If no traits selected, return false
		if (selectedTraits.length === 0) {
			return false;
		}

		// Parallel batch processing of all trait images
		const batchRequests: BatchImageRequest[] = selectedTraits.map((trait, index) => ({
			trait: trait.trait,
			resizeWidth: targetWidth,
			resizeHeight: targetHeight,
			index
		}));

		const batchResults = await processBatchImageRequests(batchRequests);

		// Draw all images to canvas in order
		for (let i = 0; i < selectedTraits.length; i++) {
			const trait = selectedTraits[i];
			const result = batchResults.find((r) => r.index === i);

			if (!result || !result.bitmap) {
				if (result?.error) {
					console.warn(
						`Failed to process image for trait "${trait.trait.name}": ${result.error.message}`
					);
				}
				return false;
			}

			// Draw the image onto the OffscreenCanvas
			ctx.drawImage(result.bitmap, 0, 0, targetWidth, targetHeight);

			// Clean up the ImageBitmap immediately to free memory
			result.bitmap.close();
		}

		// If required layer failed due to strict pair constraints, return false
		if (hasRequiredLayerFailure) {
			return false;
		}

		// After selecting all traits, mark the combination as used for Strict Pair tracking
		if (strictPairConfig?.enabled) {
			const simpleSelectedTraits = selectedTraits.map((t) => ({
				traitId: t.traitId,
				layerId: t.layerId
			}));
			markCombinationAsUsed(simpleSelectedTraits, strictPairConfig);
		}

		// Convert the canvas to blob after all layers are drawn
		const blob: Blob = await canvas.convertToBlob({
			type: 'image/png',
			quality: 0.9 // Slight compression to reduce memory usage
		});

		// Create metadata using selected traits
		const attributes = selectedTraits.map((selected) => ({
			trait_type: layers.find((l) => l.id === selected.layerId)?.name || 'Unknown',
			value: selected.trait.name
		}));

		// Use the selected metadata strategy
		const strategy = getMetadataStrategy(metadataStandard as MetadataStandard);
		const metadataObj = strategy.format(
			`${projectName} #${index + 1}`,
			projectDescription,
			`${index + 1}.png`,
			attributes,
			{
				// Pass extra data if needed for specific strategies (e.g. Solana symbol)
				// For now we just pass basic info
			}
		);

		// Store the metadata
		metadata.push({
			name: `${index + 1}.json`,
			data: metadataObj
		});

		if (chunkImages) {
			// Chunked approach - add to chunk array
			chunkImages.push({
				name: `${index + 1}.png`,
				blob
			});
		} else {
			// Streaming approach - send immediately
			const imageData = await blob.arrayBuffer();
			const streamMessage: CompleteMessage = {
				type: 'complete',
				taskId,
				payload: {
					images: [{ name: `${index + 1}.png`, imageData }],
					metadata: [{ name: `${index + 1}.json`, data: metadataObj }]
				}
			};

			// Transfer the underlying ArrayBuffer
			// @ts-expect-error - TS in worker env may not infer postMessage overload with transfer list
			self.postMessage(streamMessage, [imageData]);
		}

		// Send progress update more frequently for streaming
		if (!chunkImages && (index % 5 === 0 || index === collectionSize - 1)) {
			// Cleanup resources periodically to free memory
			cleanupObjectUrls();

			// Get current memory usage
			const currentMemoryUsage = getMemoryUsage();

			const progressMessage: ProgressMessage = {
				type: 'progress',
				taskId,
				payload: {
					generatedCount: index + 1,
					totalCount: collectionSize,
					statusText: `Generated ${index + 1} of ${collectionSize} NFTs`,
					memoryUsage: currentMemoryUsage || undefined
				}
			};
			self.postMessage(progressMessage);
		}

		// Send preview for progressive rendering every 50 items for streaming (more frequent)
		if (
			!chunkImages &&
			collectionSize <= 1000 &&
			(index % 50 === 0 || index === collectionSize - 1)
		) {
			await sendPreview(blob, index, taskId);
		}

		// Force GC after each item for better memory management in large collections
		if (collectionSize > 1000 && typeof globalThis !== 'undefined' && 'gc' in globalThis) {
			(globalThis as { gc?: () => void }).gc?.();
		}

		return true; // Generation successful
	} catch (error) {
		const errorMessage: ErrorMessage = {
			type: 'error',
			taskId,
			payload: {
				message: `Error generating item ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
			}
		};
		self.postMessage(errorMessage);

		return false; // Generation failed
	}
}

// Send chunk completion with transferables
async function sendChunkCompletion(
	chunkImages: { name: string; blob: Blob }[],
	metadata: { name: string; data: object }[],
	chunkStart: number,
	taskId?: TaskId
): Promise<void> {
	// Convert only this chunk's Blobs to ArrayBuffers for transfer
	const chunkImagesForTransfer = await Promise.all(
		chunkImages.map(async (image) => ({
			name: image.name,
			imageData: await image.blob.arrayBuffer()
		}))
	);

	// Prepare transferables for this chunk
	const transferables: ArrayBuffer[] = [];
	chunkImagesForTransfer.forEach((img) => {
		if (img.imageData instanceof ArrayBuffer) {
			transferables.push(img.imageData);
		}
	});

	// Extract metadata for this chunk (indices that correspond to this chunk's images)
	const chunkStartIndex = chunkStart;
	const chunkMetadata = metadata.slice(chunkStartIndex, chunkStartIndex + chunkImages.length);

	// Send chunk completion message with transferables to avoid copying
	const chunkCompleteMessage: CompleteMessage = {
		type: 'complete',
		taskId,
		payload: {
			images: chunkImagesForTransfer,
			metadata: chunkMetadata
		}
	};

	// Transfer the underlying ArrayBuffers
	// @ts-expect-error - TS in worker env may not infer postMessage overload with transfer list
	self.postMessage(chunkCompleteMessage, transferables);

	// Force garbage collection between chunks if available to free memory immediately
	if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
		(globalThis as { gc?: () => void }).gc?.();
	}
}

// Send preview for progressive rendering
async function sendPreview(blob: Blob, index: number, taskId?: TaskId): Promise<void> {
	// Create a small preview by converting to a small canvas to reduce data transfer
	try {
		const smallCanvas = new OffscreenCanvas(100, 100); // Small preview size
		const smallCtx = smallCanvas.getContext('2d');
		if (smallCtx) {
			// Create image bitmap from blob and draw to small canvas
			const imageBitmap = await createImageBitmap(blob);
			// Scale the image to fit the small canvas
			smallCtx.drawImage(imageBitmap, 0, 0, 100, 100);
			imageBitmap.close();

			// Convert to a small blob to reduce transfer size
			const smallBlob = await smallCanvas.convertToBlob({
				type: 'image/png',
				quality: 0.5
			});
			const previewData = [await smallBlob.arrayBuffer()];

			const previewMessage: PreviewMessage = {
				type: 'preview',
				taskId,
				payload: {
					indexes: [index],
					previewData: previewData
				}
			};
			self.postMessage(previewMessage);
		}
	} catch (previewError) {
		console.warn('Failed to generate preview:', previewError);
		// Continue generation even if preview fails
	}
}

// Adapt chunk size based on memory usage
function adaptChunkSize(
	currentChunkSize: number,
	memoryUsage: { used: number; available: number } | null
): number {
	if (!memoryUsage) return currentChunkSize;

	const memoryUsageRatio = memoryUsage.used / memoryUsage.available;

	// More granular chunk size adjustments
	if (memoryUsageRatio > 0.9) {
		// Critical memory pressure
		return Math.max(5, Math.floor(currentChunkSize * 0.3));
	} else if (memoryUsageRatio > 0.8) {
		// High memory pressure
		return Math.max(10, Math.floor(currentChunkSize * 0.5));
	} else if (memoryUsageRatio > 0.7) {
		// Medium memory pressure
		return Math.max(15, Math.floor(currentChunkSize * 0.7));
	} else if (memoryUsageRatio < 0.5 && currentChunkSize < 200) {
		// Low memory usage, can increase chunk size
		return Math.min(200, Math.floor(currentChunkSize * 1.2));
	}

	return currentChunkSize;
}
interface MemoryInfo {
	usedJSHeapSize: number;
	jsHeapSizeLimit: number;
	totalJSHeapSize: number;
}

// Memory monitoring function with enhanced detection
function getMemoryUsage() {
	try {
		// Standard performance.memory API (Chrome)
		if (typeof performance !== 'undefined' && 'memory' in performance) {
			const memory = (performance as { memory: MemoryInfo }).memory;
			return {
				used: memory.usedJSHeapSize,
				available: memory.jsHeapSizeLimit,
				total: memory.totalJSHeapSize,
				units: 'bytes'
			};
		}

		// Firefox and other browsers might have different APIs
		if (typeof performance !== 'undefined' && 'mozMemory' in performance) {
			const memory = (performance as { mozMemory: MemoryInfo }).mozMemory;
			return {
				used: memory.usedJSHeapSize,
				available: memory.jsHeapSizeLimit,
				total: memory.totalJSHeapSize,
				units: 'bytes'
			};
		}
	} catch {
		// Fallback: return estimated memory based on environment
		return null;
	}
	return null;
}

// Validate that the requested collection size is achievable with all constraints
function validateCollectionSize(
	layers: TransferrableLayer[],
	requestedSize: number,
	strictPairConfig?: StrictPairConfig
): string | null {
	// Calculate maximum possible combinations accounting for all constraints
	const maxCombinations = calculateMaxPossibleCombinations(layers, strictPairConfig);

	if (maxCombinations === 0) {
		return 'Invalid configuration: No valid trait combinations are possible with the current settings. Check your ruler rules and layer configurations.';
	}

	if (requestedSize > maxCombinations) {
		return `Collection size too large: Requested ${requestedSize} NFTs but the current configuration only allows approximately ${maxCombinations} unique combinations. This limit is due to strict pair constraints and ruler compatibility rules. Reduce collection size or modify your configuration.`;
	}

	return null; // Validation passes
}

// Calculate maximum possible combinations accounting for all constraints
function calculateMaxPossibleCombinations(
	layers: TransferrableLayer[],
	strictPairConfig?: StrictPairConfig
): number {
	// If no strict pair constraints, estimate based on all possible combinations
	if (!strictPairConfig?.enabled || !strictPairConfig.layerCombinations.length) {
		return calculateAllPossibleCombinations(layers);
	}

	let maxCombinations = 0;

	// Calculate for each strict pair combination
	for (const layerCombination of strictPairConfig.layerCombinations) {
		if (!layerCombination.active) continue;

		// Get layers in this combination
		const combinationLayers = layerCombination.layerIds
			.map((layerId) => layers.find((l) => l.id === layerId))
			.filter((layer) => layer && layer.traits && layer.traits.length > 0) as TransferrableLayer[];

		if (combinationLayers.length !== layerCombination.layerIds.length) {
			continue; // Skip if any layer is missing
		}

		// Calculate valid combinations for this layer set considering ruler compatibility
		const validCombinations = calculateValidCombinationsForLayers(combinationLayers);
		maxCombinations += validCombinations;
	}

	return maxCombinations;
}

// Calculate all possible combinations without strict pair constraints
function calculateAllPossibleCombinations(layers: TransferrableLayer[]): number {
	return layers
		.filter((layer) => layer.traits && layer.traits.length > 0)
		.reduce((total, layer) => total * layer.traits!.length, 1);
}

// Calculate valid combinations for a specific set of layers considering ruler compatibility
function calculateValidCombinationsForLayers(layers: TransferrableLayer[]): number {
	if (layers.length === 0) return 0;
	if (layers.length === 1) return layers[0].traits?.length || 0;

	// For multiple layers, we need to account for ruler compatibility
	// This is a simplified calculation - actual generation may find fewer valid combinations
	let totalValidCombinations = 0;

	// Generate all possible combinations and check ruler compatibility
	const layerCount = layers.length;

	function* generateCombinations(
		traitIndex: number,
		currentSelection: { traitId: string; layerId: string; trait: TransferrableTrait }[]
	): Generator<{ traitId: string; layerId: string; trait: TransferrableTrait }[]> {
		if (traitIndex === layerCount) {
			yield currentSelection;
			return;
		}

		const currentLayer = layers[traitIndex];
		for (const trait of currentLayer.traits || []) {
			// Check ruler compatibility
			if (isRulerCompatible(currentSelection, trait, currentLayer, layers)) {
				yield* generateCombinations(traitIndex + 1, [
					...currentSelection,
					{ traitId: trait.id, layerId: currentLayer.id, trait }
				]);
			}
		}
	}

	// Count valid combinations with performance limit
	const MAX_COMBINATIONS_TO_COUNT = 100000; // Prevent excessive computation time
	for (const _ of generateCombinations(0, [])) {
		totalValidCombinations++;
		if (totalValidCombinations >= MAX_COMBINATIONS_TO_COUNT) {
			// If we reach the performance limit, return the estimated count
			// This gives a conservative estimate that won't cause validation to fail
			return Math.max(
				totalValidCombinations,
				layers.reduce((product, layer) => product * (layer.traits?.length || 1), 1) * 0.8
			);
		}
	}

	return totalValidCombinations;
}

// Check if a trait is compatible with current selection considering ruler rules
function isRulerCompatible(
	currentSelection: { traitId: string; layerId: string; trait: TransferrableTrait }[],
	newTrait: TransferrableTrait,
	newLayer: TransferrableLayer,
	allLayers: TransferrableLayer[]
): boolean {
	// Check ruler rules for the new trait
	if (newTrait.rulerRules) {
		for (const rule of newTrait.rulerRules) {
			const targetLayer = allLayers.find((l) => l.id === rule.layerId);
			if (!targetLayer) continue;

			const selectedTrait = currentSelection.find((t) => t.layerId === targetLayer.id);
			if (!selectedTrait) continue;

			// Check allowed traits
			if (rule.allowedTraitIds.length > 0) {
				if (!rule.allowedTraitIds.includes(selectedTrait.trait.id)) {
					return false;
				}
			}

			// Check forbidden traits
			if (rule.forbiddenTraitIds.includes(selectedTrait.trait.id)) {
				return false;
			}
		}
	}

	// Check existing traits' ruler rules
	for (const selectedTrait of currentSelection) {
		if (selectedTrait.trait.rulerRules) {
			for (const rule of selectedTrait.trait.rulerRules) {
				if (rule.layerId === newLayer.id) {
					// Check allowed traits
					if (rule.allowedTraitIds.length > 0) {
						if (!rule.allowedTraitIds.includes(newTrait.id)) {
							return false;
						}
					}

					// Check forbidden traits
					if (rule.forbiddenTraitIds.includes(newTrait.id)) {
						return false;
					}
				}
			}
		}
	}

	return true;
}

// Import performance improvements
import { shouldUseFastGeneration, getOptimizationHints, detectCollectionComplexity } from './fast-generation-detector';
import { generateCollectionFast, getCollectionAnalysis } from './fast-generation';
import { performanceAnalyzer } from '$lib/utils/performance-analyzer';

// Main worker message handler
self.onmessage = async (e: MessageEvent<IncomingMessage>) => {
	const {
		type,
		payload,
		taskId: rawTaskId
	} = e.data as {
		type: string;
		payload?: unknown;
		taskId?: string;
	};
	const taskId = rawTaskId ? createTaskId(rawTaskId) : undefined;

	// Handle ping messages for health checks
	if (type === 'ping') {
		const pingData = e.data as unknown as { pingId: string };
		self.postMessage({ type: 'pingResponse', pingResponse: pingData.pingId });
		return;
	}

	// Handle initialization message
	if (type === 'initialize') {
		// Worker is already initialized, send ready message
		self.postMessage({ type: 'ready' });
		return;
	}

	switch (type) {
		case 'start':
			try {
				const startPayload = payload as StartMessage['payload'];

				// Analyze collection complexity and decide on algorithm
				const analysis = getCollectionAnalysis(
					startPayload.layers,
					startPayload.collectionSize
				);

				// Start performance analysis
				performanceAnalyzer.startAnalysis(
					analysis.complexity.recommendedAlgorithm,
					analysis.complexity.type,
					1 // Single worker for now
				);

				// Send analysis info to client
				self.postMessage({
					type: 'analysis',
					taskId,
					payload: {
						complexity: analysis.complexity,
						canUseFastGeneration: analysis.canUseFastGeneration,
						estimatedSpeedup: analysis.estimatedSpeedup,
						recommendations: analysis.recommendations
					}
				});

				// Validate that the requested collection size is achievable with strict pair constraints
				const validationError = validateCollectionSize(
					startPayload.layers,
					startPayload.collectionSize,
					startPayload.strictPairConfig
				);
				if (validationError) {
					const errorMessage: ErrorMessage = {
						type: 'error',
						taskId,
						payload: {
							message: validationError
						}
					};
					self.postMessage(errorMessage);
					performanceAnalyzer.stopAnalysis();
					return;
				}

				// Choose generation algorithm based on complexity
				if (analysis.canUseFastGeneration) {
					console.log(`🚀 Using fast generation for ${analysis.complexity.type} collection`);
					
					// Use fast generation algorithm
					await generateCollectionFast(
						startPayload.layers,
						startPayload.collectionSize,
						startPayload.outputSize,
						startPayload.projectName,
						startPayload.projectDescription,
						taskId,
						startPayload.metadataStandard
					);
				} else {
					console.log(`🔧 Using existing generation for ${analysis.complexity.type} collection`);
					
					// Use existing sophisticated generation
					await generateCollection(
						startPayload.layers,
						startPayload.collectionSize,
						startPayload.outputSize,
						startPayload.projectName,
						startPayload.projectDescription,
						startPayload.strictPairConfig,
						taskId,
						startPayload.metadataStandard
					);
				}

				// Generate and send final performance report
				const report = performanceAnalyzer.stopAnalysis();
				self.postMessage({
					type: 'performance-report',
					taskId,
					payload: report
				});

			} catch (error) {
				// Stop performance analysis on error
				try {
					performanceAnalyzer.stopAnalysis();
				} catch {
					// Ignore if no active analysis
				}

				const errorMessage: ErrorMessage = {
					type: 'error',
					taskId,
					payload: {
						message: error instanceof Error ? error.message : 'An unknown error occurred'
					}
				};
				self.postMessage(errorMessage);
			}
			break;
		case 'cancel':
			// Cancel is handled by event listener in generateCollection
			break;
		default: {
			const errorMessage: ErrorMessage = {
				type: 'error',
				taskId,
				payload: {
					message: `Unknown message type: ${type}`
				}
			};
			self.postMessage(errorMessage);
		}
	}
};
