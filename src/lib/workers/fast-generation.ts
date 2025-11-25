// src/lib/workers/fast-generation.ts

import type {
	TransferrableLayer,
	TransferrableTrait,
	StartMessage,
	ProgressMessage,
	CompleteMessage,
	ErrorMessage
} from '$lib/types/worker-messages';
import { createTaskId, type TaskId } from '$lib/types/ids';
import { shouldUseFastGeneration, detectCollectionComplexity } from './fast-generation-detector';
import { batchedProgressManager, createProgressUpdate } from '$lib/stores/batched-progress';
import { getMetadataStrategy } from '$lib/domain/metadata/strategies';
import { MetadataStandard } from '$lib/domain/metadata/strategies';

/**
 * Fast Generation Algorithm for Simple Collections
 * Provides 3-5x speed improvement for collections with:
 * - ≤12 layers
 * - ≤100 total traits
 * - ≤15000 items
 * - Simple constraint rules
 */

/**
 * Generate a collection using fast linear algorithm
 */
export async function generateCollectionFast(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	taskId?: TaskId,
	metadataStandard?: MetadataStandard
): Promise<void> {
	const timerId = performance.now();
	console.log(`🚀 Starting fast generation: ${collectionSize} items, ${layers.length} layers`);

	try {
		// Initialize batched progress manager
		const progressManager = batchedProgressManager;

		// Send initial progress
		progressManager.scheduleUpdate(
			createProgressUpdate(
				0,
				collectionSize,
				`Fast generation: Starting ${collectionSize} items...`
			)
		);

		// Pre-load and cache all trait image bitmaps for fast access
		const traitCache = await preloadTraitCache(layers, outputSize);
		console.log(`💾 Pre-loaded ${traitCache.size} trait images into cache`);

		// Generate NFTs using fast linear algorithm
		const results = await generateNFTsFast(
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription,
			traitCache,
			progressManager,
			metadataStandard
		);

		// Send completion
		const completeMessage: CompleteMessage = {
			type: 'complete',
			taskId,
			payload: {
				images: results.images,
				metadata: results.metadata
			}
		};

		self.postMessage(completeMessage);

		const totalTime = performance.now() - timerId;
		const itemsPerSecond = collectionSize / (totalTime / 1000);
		console.log(`✅ Fast generation completed: ${itemsPerSecond.toFixed(1)} items/sec`);
	} catch (error) {
		console.error('Fast generation failed:', error);

		const errorMessage: ErrorMessage = {
			type: 'error',
			taskId,
			payload: {
				message: `Fast generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			}
		};

		self.postMessage(errorMessage);
	}
}

/**
 * Pre-load all trait images into cache for fast access
 * This eliminates the overhead of loading images during generation
 */
async function preloadTraitCache(
	layers: TransferrableLayer[],
	targetSize: { width: number; height: number }
): Promise<Map<string, ImageBitmap>> {
	const cache = new Map<string, ImageBitmap>();

	console.log(`🖼️ Pre-loading ${layers.length} layers of trait images...`);

	// Process layers in parallel for faster loading
	const layerPromises = layers.map(async (layer) => {
		const layerCache = await preloadLayerTraits(layer, targetSize);

		// Add all traits from this layer to the main cache
		for (const [traitId, bitmap] of layerCache) {
			cache.set(traitId, bitmap);
		}
	});

	await Promise.all(layerPromises);

	console.log(`✅ Pre-loaded ${cache.size} trait images`);
	return cache;
}

/**
 * Pre-load all traits for a single layer
 */
async function preloadLayerTraits(
	layer: TransferrableLayer,
	targetSize: { width: number; height: number }
): Promise<Map<string, ImageBitmap>> {
	const cache = new Map<string, ImageBitmap>();

	if (!layer.traits || layer.traits.length === 0) {
		return cache;
	}

	// Process traits in parallel for faster loading
	const traitPromises = layer.traits.map(async (trait) => {
		const bitmap = await createTraitBitmap(trait, targetSize);
		if (bitmap) {
			cache.set(trait.id, bitmap);
		}
	});

	await Promise.all(traitPromises);

	return cache;
}

/**
 * Create ImageBitmap from trait data with optimization
 */
async function createTraitBitmap(
	trait: TransferrableTrait,
	targetSize: { width: number; height: number }
): Promise<ImageBitmap | null> {
	try {
		if (!trait.imageData || trait.imageData.byteLength === 0) {
			console.warn(`Trait ${trait.name} has no image data`);
			return null;
		}

		const blob = new Blob([trait.imageData], { type: 'image/png' });

		// Use createImageBitmap with resize for better performance
		const bitmap = await createImageBitmap(blob, {
			resizeWidth: targetSize.width,
			resizeHeight: targetSize.height,
			resizeQuality: 'high'
		});

		return bitmap;
	} catch (error) {
		console.warn(`Failed to create bitmap for trait ${trait.name}:`, error);
		return null;
	}
}

/**
 * Generate a single NFT with maximum optimization
 */
async function generateSingleNFTFast(
	index: number,
	layers: TransferrableLayer[],
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	traitCache: Map<string, ImageBitmap>,
	metadataStandard: MetadataStandard | undefined,
	canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D
): Promise<{
	image: { name: string; imageData: ArrayBuffer };
	metadata: { name: string; data: object };
} | null> {
	try {
		// Select traits using simple random selection
		const selectedTraits = selectTraitsSimple(layers, traitCache);

		if (selectedTraits.length === 0) {
			return null;
		}

		// Clear canvas efficiently
		ctx.clearRect(0, 0, outputSize.width, outputSize.height);

		// Draw all traits in order - optimized for speed
		for (const traitSelection of selectedTraits) {
			const bitmap = traitSelection.bitmap;
			if (bitmap) {
				// Use fastest drawImage parameters
				ctx.drawImage(bitmap, 0, 0);
			}
		}

		// Convert to blob with optimized settings for speed
		const blob = await canvas.convertToBlob({
			type: 'image/webp', // WebP is much faster than PNG
			quality: 0.8
		});

		// Create metadata
		const attributes = selectedTraits.map((selected) => ({
			trait_type: layers.find((l) => l.id === selected.layerId)?.name || 'Unknown',
			value: selected.trait.name
		}));

		const strategy = getMetadataStrategy(metadataStandard as MetadataStandard);
		const metadataObj = strategy.format(
			`${projectName} #${index + 1}`,
			projectDescription,
			`${index + 1}.webp`,
			attributes,
			{}
		);

		return {
			image: {
				name: `${index + 1}.webp`,
				imageData: await blob.arrayBuffer()
			},
			metadata: {
				name: `${index + 1}.json`,
				data: metadataObj
			}
		};
	} catch (error) {
		console.warn(`Failed to generate NFT ${index + 1}:`, error);
		return null;
	}
}

/**
 * Generate NFTs using parallel processing for large collections
 */
async function generateNFTsParallel(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	traitCache: Map<string, ImageBitmap>,
	progressManager: any,
	metadataStandard: MetadataStandard | undefined,
	canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	images: Array<{ name: string; imageData: ArrayBuffer }>,
	metadata: Array<{ name: string; data: object }>
): Promise<{
	images: Array<{ name: string; imageData: ArrayBuffer }>;
	metadata: Array<{ name: string; data: object }>;
}> {
	// Determine optimal batch size based on collection size
	const cores = navigator.hardwareConcurrency || 4;
	const batchSize = Math.max(2, Math.min(Math.ceil(collectionSize / (cores * 2)), 500));

	console.log(`⚡ Using parallel generation with batch size: ${batchSize}`);

	// Process in batches for better memory management and progress updates
	for (let startIdx = 0; startIdx < collectionSize; startIdx += batchSize) {
		const endIdx = Math.min(startIdx + batchSize, collectionSize);
		const batchPromises: Promise<void>[] = [];

		// Create batches for parallel processing
		const batchCount = Math.min(batchSize, cores);

		for (let batchNum = 0; batchNum < batchCount; batchNum++) {
			const promise = (async () => {
				// Each batch processes its share of items
				for (let i = startIdx + batchNum; i < endIdx; i += batchCount) {
					// Generate single NFT
					const result = await generateSingleNFTFast(
						i,
						layers,
						outputSize,
						projectName,
						projectDescription,
						traitCache,
						metadataStandard,
						canvas,
						ctx
					);

					if (result) {
						images.push(result.image);
						metadata.push(result.metadata);
					}
				}
			})();

			batchPromises.push(promise);
		}

		// Wait for batch to complete
		await Promise.all(batchPromises);

		// Update progress
		const progress = endIdx;
		const percentage = ((progress / collectionSize) * 100).toFixed(1);
		const etaMinutes =
			collectionSize > 5000
				? `${Math.round(((collectionSize - progress) / 1000) * 2)}m`
				: `${Math.round((collectionSize - progress) / 500)}s`;

		progressManager.scheduleUpdate(
			createProgressUpdate(
				progress,
				collectionSize,
				`Parallel generation: ${progress}/${collectionSize} (${percentage}%) - ETA: ${etaMinutes}`
			)
		);
	}

	return { images, metadata };
}

/**
 * Generate NFTs using fast linear algorithm
 */
async function generateNFTsFast(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	traitCache: Map<string, ImageBitmap>,
	progressManager: any,
	metadataStandard?: MetadataStandard
): Promise<{
	images: Array<{ name: string; imageData: ArrayBuffer }>;
	metadata: Array<{ name: string; data: object }>;
}> {
	const images: Array<{ name: string; imageData: ArrayBuffer }> = [];
	const metadata: Array<{ name: string; data: object }> = [];

	// Create reusable canvas for all generations
	const canvas = new OffscreenCanvas(outputSize.width, outputSize.height);
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Failed to get 2D context from OffscreenCanvas');
	}

	// Optimize canvas settings for maximum performance
	ctx.imageSmoothingEnabled = false; // Disable for pixel-perfect rendering
	ctx.globalCompositeOperation = 'source-over';
	ctx.imageSmoothingQuality = 'low'; // Prioritize speed over quality

	console.log(`🚀 Starting fast generation: ${collectionSize} items with ${layers.length} layers`);

	// Use parallel processing for large collections
	if (collectionSize > 1000) {
		return await generateNFTsParallel(
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription,
			traitCache,
			progressManager,
			metadataStandard,
			canvas,
			ctx,
			images,
			metadata
		);
	}

	// Generate each NFT sequentially for smaller collections
	for (let i = 0; i < collectionSize; i++) {
		const result = await generateSingleNFTFast(
			i,
			layers,
			outputSize,
			projectName,
			projectDescription,
			traitCache,
			metadataStandard,
			canvas,
			ctx
		);

		if (result) {
			images.push(result.image);
			metadata.push(result.metadata);
		}

		// Update progress every 200 items for large collections, every 50 for smaller
		const updateInterval = collectionSize > 5000 ? 200 : collectionSize > 1000 ? 100 : 50;

		if (i % updateInterval === 0 || i === collectionSize - 1) {
			const elapsedItems = i + 1;
			const estimatedTotalTime =
				collectionSize > 5000
					? `${Math.round(((collectionSize - elapsedItems) / 1000) * 2)}m`
					: `${Math.round((collectionSize - elapsedItems) / 500)}s`;

			progressManager.scheduleUpdate(
				createProgressUpdate(
					elapsedItems,
					collectionSize,
					`Fast generation: ${elapsedItems}/${collectionSize} - ETA: ${estimatedTotalTime}`
				)
			);
		}
	}

	// Final progress update
	progressManager.scheduleUpdate(
		createProgressUpdate(collectionSize, collectionSize, `Fast generation: Complete!`)
	);

	return { images, metadata };
}

/**
 * Simple trait selection with basic validation
 * Much faster than full CSP solver for simple cases
 */
function selectTraitsSimple(
	layers: TransferrableLayer[],
	traitCache: Map<string, ImageBitmap>
): Array<{ trait: TransferrableTrait; layerId: string; bitmap: ImageBitmap | null }> {
	const selected: Array<{
		trait: TransferrableTrait;
		layerId: string;
		bitmap: ImageBitmap | null;
	}> = [];

	for (const layer of layers) {
		// Skip optional layers randomly to create variety
		if (layer.isOptional && Math.random() < 0.3) {
			continue;
		}

		if (!layer.traits || layer.traits.length === 0) {
			continue;
		}

		// Simple random selection from available traits
		const randomIndex = Math.floor(Math.random() * layer.traits.length);
		const selectedTrait = layer.traits[randomIndex];

		// Get cached bitmap
		const bitmap = traitCache.get(selectedTrait.id) || null;

		selected.push({
			trait: selectedTrait,
			layerId: layer.id,
			bitmap
		});
	}

	return selected;
}

/**
 * Check if a collection should use fast generation
 */
export function shouldUseFastGenerationWrapper(
	layers: TransferrableLayer[],
	collectionSize: number
): boolean {
	return shouldUseFastGeneration(layers, collectionSize);
}

/**
 * Get collection complexity and recommendations
 */
export function getCollectionAnalysis(layers: TransferrableLayer[], collectionSize: number) {
	const complexity = detectCollectionComplexity(layers, collectionSize);

	return {
		complexity,
		canUseFastGeneration: complexity.type === 'simple',
		estimatedSpeedup: complexity.estimatedSpeedup,
		reason: complexity.reason,
		recommendations: [
			complexity.estimatedSpeedup !== 'baseline'
				? `Fast generation will provide ${complexity.estimatedSpeedup} speed improvement`
				: 'Using sophisticated generation for complex constraints',
			complexity.type === 'simple'
				? 'Parallel canvas composition enabled'
				: 'Standard processing mode',
			'Batched progress updates for better performance'
		]
	};
}
