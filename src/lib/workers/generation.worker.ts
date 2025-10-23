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

// No WASM imports needed - using direct Canvas API for optimal performance

// Check if a trait is compatible with currently selected traits
function isTraitCompatible(
	trait: TransferrableTrait,
	layerId: string,
	selectedTraits: { traitId: string; layerId: string; trait: TransferrableTrait }[],
	layers: TransferrableLayer[]
): boolean {
	// Check if any selected ruler traits forbid this trait
	for (const selected of selectedTraits) {
		if (selected.trait.type === 'ruler' && selected.trait.rulerRules) {
			const rule = selected.trait.rulerRules.find((r) => r.layerId === layerId);
			if (rule) {
				// Check if trait is in forbidden list
				if (rule.forbiddenTraitIds.includes(trait.id)) {
					return false;
				}
				// Check if trait is in allowed list (if allowed list is not empty)
				if (rule.allowedTraitIds.length > 0 && !rule.allowedTraitIds.includes(trait.id)) {
					return false;
				}
			}
		}
	}
	return true;
}

// Get compatible traits for a layer based on current selection
function getCompatibleTraits(
	layer: TransferrableLayer,
	selectedTraits: { traitId: string; layerId: string; trait: TransferrableTrait }[],
	layers: TransferrableLayer[]
): TransferrableTrait[] {
	return layer.traits.filter((trait) => isTraitCompatible(trait, layer.id, selectedTraits, layers));
}

// Rarity algorithm with compatibility checking
function selectTrait(
	layer: TransferrableLayer,
	selectedTraits: { traitId: string; layerId: string; trait: TransferrableTrait }[],
	layers: TransferrableLayer[]
): TransferrableTrait | null {
	// Handle optional layers first
	if (layer.isOptional) {
		const skipChance = 0.3; // 30% chance to skip optional layer
		if (Math.random() < skipChance) {
			return null;
		}
	}

	// Get compatible traits based on current selection
	const compatibleTraits = getCompatibleTraits(layer, selectedTraits, layers);
	if (compatibleTraits.length === 0) {
		return null; // No compatible traits available
	}

	const totalWeight = compatibleTraits.reduce((sum, trait) => sum + trait.rarityWeight, 0);
	if (totalWeight === 0) {
		return null;
	}

	let randomNum = Math.random() * totalWeight;

	for (const trait of compatibleTraits) {
		if (randomNum < trait.rarityWeight) {
			return trait;
		}
		randomNum -= trait.rarityWeight;
	}
	return null;
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

	try {
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
			const imageBitmap = await createImageBitmapFromBuffer(
				trait.imageData,
				trait.name,
				{ resizeWidth: targetWidth, resizeHeight: targetHeight }
			);

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
	taskId?: TaskId
) {
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
		for (let i = 0; i < collectionSize && !isCancelled; i++) {
			await generateAndStreamItem(
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
				undefined, // no chunkImages for streaming
				taskId
			);
		}
	} else {
		// Chunked approach for larger collections
		for (
			let chunkStart = 0;
			chunkStart < collectionSize && !isCancelled;
			chunkStart += CHUNK_SIZE
		) {
			const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, collectionSize);

			// Create a temporary array to hold only the current chunk's images
			const chunkImages: { name: string; blob: Blob }[] = [];

			for (let i = chunkStart; i < chunkEnd && !isCancelled; i++) {
				await generateAndStreamItem(
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
					chunkImages,
					taskId
				);

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

	// Final cleanup
	cleanupResources();

	// Send final completion message
	const finalCompleteMessage: CompleteMessage = {
		type: 'complete',
		taskId,
		payload: {
			images: [], // Already sent via streaming/chunking
			metadata: [] // Already sent via streaming/chunking
		}
	};

	// Send final completion message
	self.postMessage(finalCompleteMessage);
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
	chunkImages?: { name: string; blob: Blob }[],
	taskId?: TaskId
): Promise<void> {
	try {
		// Always use optimized Canvas compositing
		// Clear the reusable canvas for this item
		ctx.clearRect(0, 0, targetWidth, targetHeight);

		// Selected traits for this NFT
		const selectedTraits: { traitId: string; layerId: string; trait: TransferrableTrait }[] = [];

		// Iterate through the layers in their specified order
		for (const layer of layers) {
			// Validate layer has traits
			if (!layer.traits || layer.traits.length === 0) {
				continue;
			}

			// Select a trait based on the rarity algorithm with compatibility checking
			const selectedTrait = selectTrait(layer, selectedTraits, layers);

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

		const metadataObj = {
			name: `${projectName} #${index + 1}`,
			description: projectDescription,
			image: `${index + 1}.png`,
			attributes: attributes
		};

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
	} catch (error) {
		const errorMessage: ErrorMessage = {
			type: 'error',
			taskId,
			payload: {
				message: `Error generating item ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
			}
		};
		self.postMessage(errorMessage);
		throw error; // Stop generation on error
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
				await generateCollection(
					startPayload.layers,
					startPayload.collectionSize,
					startPayload.outputSize,
					startPayload.projectName,
					startPayload.projectDescription,
					taskId
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
