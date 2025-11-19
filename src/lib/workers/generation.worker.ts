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

// Track used combinations for each layer combination
interface UsedCombination {
	traitIds: string[];
}

// No WASM imports needed - using direct Canvas API for optimal performance

// Simple worker-level LRU cache for ArrayBuffers instead of ImageBitmaps
// ImageBitmaps can't be safely cached across different contexts due to detachment
class WorkerArrayBufferCache {
	private cache = new Map<string, { buffer: ArrayBuffer; accessTime: number }>();
	private readonly maxSize = 50; // Keep 50 recently used buffers

	get(key: string): ArrayBuffer | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			entry.accessTime = Date.now();
			return entry.buffer;
		}
		return undefined;
	}

	set(key: string, buffer: ArrayBuffer): void {
		// Remove oldest if at capacity
		if (this.cache.size >= this.maxSize) {
			let oldestKey = '';
			let oldestTime = Date.now();

			for (const [k, entry] of this.cache) {
				if (entry.accessTime < oldestTime) {
					oldestTime = entry.accessTime;
					oldestKey = k;
				}
			}

			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			buffer,
			accessTime: Date.now()
		});
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}
}

// Global worker cache instance
const workerArrayBufferCache = new WorkerArrayBufferCache();

// Cache statistics tracking
let cacheStats = { hits: 0, misses: 0, lastReport: 0 };

// Report cache statistics periodically (every 10 seconds or 50 operations)
function reportCacheStats() {
	const now = Date.now();
	const totalOps = cacheStats.hits + cacheStats.misses;

	// Report every 30 seconds or every 200 operations, whichever comes first
	if (now - cacheStats.lastReport > 30000 || totalOps % 200 === 0) {
		const hitRate = totalOps > 0 ? ((cacheStats.hits / totalOps) * 100).toFixed(1) : '0.0';
		console.log(
			`🎯 Worker Cache: ${workerArrayBufferCache.size} entries, ` +
				`${hitRate}% hit rate (${cacheStats.hits}/${totalOps})`
		);
		cacheStats.lastReport = now;
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
		cacheStats.hits++;
		reportCacheStats();

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
		cacheStats.misses++;
		reportCacheStats();

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

// No-op to keep call sites intact; retained for backward compatibility
function cleanupObjectUrls() {
	// Intentionally empty: we no longer create object URLs in the worker
}

// Cleanup function to free resources
function cleanupResources() {
	// Clear worker cache
	workerArrayBufferCache.clear();

	// Reset cache statistics
	cacheStats = { hits: 0, misses: 0, lastReport: 0 };

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

	// Report final cache statistics (before cleanup)
	const totalOps = cacheStats.hits + cacheStats.misses;
	const finalHitRate = totalOps > 0 ? ((cacheStats.hits / totalOps) * 100).toFixed(1) : '0.0';
	console.log(
		`✅ Generation Complete - Worker Cache: ${workerArrayBufferCache.size} entries, ` +
			`${finalHitRate}% hit rate (${cacheStats.hits} hits, ${cacheStats.misses} misses)`
	);

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
		let hasRequiredLayerFailure = false;

		// Use CSP Solver to find a valid combination
		const solver = new CSPSolver(layers, usedCombinations, strictPairConfig);
		const solution = solver.solve();

		if (!solution) {
			return false; // No valid combination found
		}

		// Process the solution
		for (const layer of layers) {
			const selectedTrait = solution.get(layer.id);

			// If a trait is selected, draw it
			if (selectedTrait) {
				selectedTraits.push({
					traitId: selectedTrait.id,
					layerId: layer.id,
					trait: selectedTrait
				});

				// Create ImageBitmap from the trait's image data with resizing for memory efficiency
				const imageBitmap = await createImageBitmapFromBuffer(
					selectedTrait.imageData,
					selectedTrait.name,
					{ resizeWidth: targetWidth, resizeHeight: targetHeight }
				);

				// Draw the image onto the OffscreenCanvas
				ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

				// Clean up the ImageBitmap immediately to free memory
				imageBitmap.close();
			}
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
					return;
				}

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
			} catch (error) {
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
