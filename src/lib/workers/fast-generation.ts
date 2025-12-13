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
import { SpritePacker, type PackedLayer, type SpriteSheet } from '$lib/utils/sprite-packer';
import { CombinationIndexer } from '$lib/utils/combination-indexer';

// Track used combinations for strict pair constraints
const usedCombinations = new Map<string, Set<bigint>>();
const combinationHashes = new Map<string, string>(); // For hash-based tracking

/**
 * Generate numeric hash for combination keys (for BigInt conversion)
 */
function generateNumericHash(combinationKey: string): number {
	let hash = 0;
	for (let i = 0; i < combinationKey.length; i++) {
		const char = combinationKey.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	// Make it unsigned to avoid negative values
	return hash >>> 0;
}

/**
 * Check if a combination is already used (for strict pair constraints)
 */
function isCombinationUsed(
	selectedTraits: Array<{ traitId: string; layerId: string }>,
	strictPairConfig: { enabled: boolean; layerCombinations: Array<{ id: string; layerIds: string[]; description: string; active: boolean }> } | undefined
): boolean {
	if (!strictPairConfig?.enabled) return false;

	for (const layerCombination of strictPairConfig.layerCombinations) {
		if (!layerCombination.active) continue;

		// Extract trait IDs for this combination
		const traitIds: string[] = [];
		let allLayersPresent = true;

		for (const layerId of layerCombination.layerIds) {
			const trait = selectedTraits.find(t => t.layerId === layerId);
			if (trait) {
				traitIds.push(trait.traitId);
			} else {
				allLayersPresent = false;
				break;
			}
		}

		if (!allLayersPresent) continue;

		// Check if this combination is already used
		const usedSet = usedCombinations.get(layerCombination.id);
		if (!usedSet || usedSet.size === 0) {
			continue;
		}

		// Try bit-packed lookup first
		try {
			const numericIds = traitIds.map(id => parseInt(id, 10));
			if (numericIds.every(id => id <= 255) && numericIds.length <= 8) {
				const combinationKey = CombinationIndexer.pack(numericIds);
				if (usedSet.has(combinationKey)) {
					return true; // Already used
				}
			}
		} catch {
			// Fallback to hash-based check
			const stringKey = traitIds.sort().join('|');
			const numericHash = generateNumericHash(stringKey);
			const hashAsBigInt = BigInt(numericHash);

			if (usedSet.has(hashAsBigInt)) {
				return true; // Already used
			}
		}
	}

	return false;
}

/**
 * Mark a combination as used (for strict pair constraints)
 */
function markCombinationAsUsed(
	selectedTraits: Array<{ traitId: string; layerId: string }>,
	strictPairConfig: { enabled: boolean; layerCombinations: Array<{ id: string; layerIds: string[]; description: string; active: boolean }> } | undefined
): void {
	if (!strictPairConfig?.enabled) return;

	for (const layerCombination of strictPairConfig.layerCombinations) {
		if (!layerCombination.active) continue;

		// Extract trait IDs for this combination
		const traitIds: string[] = [];
		let allLayersPresent = true;

		for (const layerId of layerCombination.layerIds) {
			const trait = selectedTraits.find(t => t.layerId === layerId);
			if (trait) {
				traitIds.push(trait.traitId);
			} else {
				allLayersPresent = false;
				break;
			}
		}

		if (!allLayersPresent) continue;

		// Initialize tracking set if not present
		if (!usedCombinations.has(layerCombination.id)) {
			usedCombinations.set(layerCombination.id, new Set());
		}
		const usedSet = usedCombinations.get(layerCombination.id)!;

		// Try bit-packed indexing first
		try {
			const numericIds = traitIds.map(id => parseInt(id, 10));
			if (numericIds.every(id => id <= 255) && numericIds.length <= 8) {
				const combinationKey = CombinationIndexer.pack(numericIds);
				usedSet.add(combinationKey);
			} else {
				// Fallback to hash-based tracking
				const stringKey = traitIds.sort().join('|');
				const numericHash = generateNumericHash(stringKey);
				const hashAsBigInt = BigInt(numericHash);
				usedSet.add(hashAsBigInt);
			}
		} catch {
			// Fallback to hash-based tracking
			const stringKey = traitIds.sort().join('|');
			const numericHash = generateNumericHash(stringKey);
			const hashAsBigInt = BigInt(numericHash);
			usedSet.add(hashAsBigInt);
		}
	}
}

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
	metadataStandard?: MetadataStandard,
	strictPairConfig?: {
		enabled: boolean;
		layerCombinations: Array<{
			id: string;
			layerIds: string[];
			description: string;
			active: boolean;
		}>;
	}
): Promise<void> {
	const timerId = performance.now();
	console.log(`🚀 Starting fast generation: ${collectionSize} items, ${layers.length} layers`);

	// Clear any existing combination data for this generation
	usedCombinations.clear();
	combinationHashes.clear();

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

		// Try sprite sheets first for 40-60% memory reduction
		const spriteSheetResult = await preloadSpriteSheets(layers, outputSize);
		let traitCache: Map<string, ImageBitmap> | undefined;
		let spriteSheets: Map<string, PackedLayer> | undefined;

		if (spriteSheetResult) {
			console.log(`💾 Using sprite sheets for generation`);
			spriteSheets = spriteSheetResult.spriteSheets;
		} else {
			// Fallback to individual image loading
			console.log(`💾 Using individual image loading`);
			traitCache = await preloadTraitCache(layers, outputSize);
			console.log(`✅ Pre-loaded ${traitCache.size} trait images into cache`);
		}

		// Generate NFTs using fast linear algorithm
		const results = await generateNFTsFast(
			layers,
			collectionSize,
			outputSize,
			projectName,
			projectDescription,
			traitCache,
			progressManager,
			metadataStandard,
			spriteSheets,
			strictPairConfig
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
 * Pre-load traits into sprite sheets for 40-60% memory reduction
 * More efficient than individual image loading for large collections
 */
export async function preloadSpriteSheets(
	layers: TransferrableLayer[],
	targetSize: { width: number; height: number }
): Promise<{
	spriteSheets: Map<string, PackedLayer>;
	traitCount: number;
} | null> {
	try {
		// Only use sprite sheets for collections with many traits
		const totalTraits = layers.reduce((sum, layer) => sum + (layer.traits?.length || 0), 0);

		// Use sprite sheets for 20+ traits (significant memory savings)
		if (totalTraits < 20) {
			return null;
		}

		console.log(`🎨 Pre-packing ${totalTraits} traits into sprite sheets...`);

		// Create sprite packer
		const packer = new SpritePacker(targetSize.width, targetSize.width * 8);

		// Pack all layers into sprite sheets
		const packedLayers = await packer.packLayers(layers);

		const duration = performance.now();
		console.log(
			`✅ Sprite sheets created: ${totalTraits} traits packed into ${Array.from(packedLayers.values()).reduce((sum, pl) => sum + pl.sheets.length, 0)} sheets`
		);

		// Log memory savings
		const stats = SpritePacker.getMemoryStats(totalTraits);
		console.log(
			`💾 Memory savings: ${stats.savingsPercent.toFixed(1)}% (${(stats.savingsBytes / 1024 / 1024).toFixed(1)}MB)`
		);
		console.log(`🌐 HTTP requests reduced: ${stats.reducedRequests} fewer requests`);

		return {
			spriteSheets: packedLayers,
			traitCount: totalTraits
		};
	} catch (error) {
		console.warn('Sprite sheet packing failed, falling back to individual images:', error);
		return null;
	}
}

/**
 * Determine output format based on original trait images
 * Returns 'image/png' if any original trait is PNG, otherwise 'image/webp'
 */
function determineOutputFormat(
	selectedTraits: Array<{ trait: TransferrableTrait; layerId: string; bitmap: ImageBitmap | null }>,
	layers: TransferrableLayer[]
): string {
	// Check if any trait has PNG data (detect PNG signature in imageData)
	for (const selected of selectedTraits) {
		const layer = layers.find(l => l.id === selected.layerId);
		const trait = layer?.traits?.find(t => t.id === selected.trait.id);

		if (trait?.imageData && trait.imageData.byteLength > 4) {
			// Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
			const view = new Uint8Array(trait.imageData);
			if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47) {
				return 'image/png';
			}
		}
	}

	// Default to WebP for performance if no PNG detected
	return 'image/webp';
}

/**
 * Generate a single NFT with maximum optimization
 * Supports both sprite sheets and individual image loading
 */
async function generateSingleNFT(
	index: number,
	layers: TransferrableLayer[],
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	traitCache: Map<string, ImageBitmap> | undefined,
	metadataStandard: MetadataStandard | undefined,
	canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	spriteSheets?: Map<string, PackedLayer>
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
		if (spriteSheets && spriteSheets.size > 0) {
			// Use sprite sheets for drawing (40-60% memory savings)
			for (const traitSelection of selectedTraits) {
				const packedLayer = spriteSheets.get(traitSelection.layerId);
				if (!packedLayer) continue;

				// Find which sheet contains this trait
				for (const sheet of packedLayer.sheets) {
					const drawn = SpritePacker.drawFromSheet(
						ctx,
						sheet,
						traitSelection.trait.id,
						0,
						0,
						outputSize.width,
						outputSize.height
					);
					if (drawn) break; // Successfully drawn from this sheet
				}
			}
		} else {
			// Fallback to individual images
			for (const traitSelection of selectedTraits) {
				const bitmap = traitSelection.bitmap;
				if (bitmap) {
					// Use fastest drawImage parameters
					ctx.drawImage(bitmap, 0, 0);
				}
			}
		}

		// Determine output format based on original traits
		const outputFormat = determineOutputFormat(selectedTraits, layers);

		// Convert to blob with optimized settings for speed
		const blob = await canvas.convertToBlob({
			type: outputFormat,
			quality: outputFormat === 'image/webp' ? 0.8 : 1.0
		});

		// Create metadata
		const attributes = selectedTraits.map((selected) => ({
			trait_type: layers.find((l) => l.id === selected.layerId)?.name || 'Unknown',
			value: selected.trait.name
		}));

		const strategy = getMetadataStrategy(metadataStandard as MetadataStandard);
		const fileExtension = outputFormat === 'image/png' ? 'png' : 'webp';
		const metadataObj = strategy.format(
			`${projectName} #${index + 1}`,
			projectDescription,
			`${index + 1}.${fileExtension}`,
			attributes,
			{}
		);

		return {
			image: {
				name: `${index + 1}.${fileExtension}`,
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
 * Generate NFTs using sequential processing - Phase 3: Remove parallel processing
 */
async function generateNFTsSequential(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string,
	traitCache: Map<string, ImageBitmap> | undefined,
	progressManager: any,
	metadataStandard: MetadataStandard | undefined,
	canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	images: Array<{ name: string; imageData: ArrayBuffer }>,
	metadata: Array<{ name: string; data: object }>,
	spriteSheets?: Map<string, PackedLayer>,
	strictPairConfig?: {
		enabled: boolean;
		layerCombinations: Array<{
			id: string;
			layerIds: string[];
			description: string;
			active: boolean;
		}>;
	}
): Promise<{
	images: Array<{ name: string; imageData: ArrayBuffer }>;
	metadata: Array<{ name: string; data: object }>;
}> {
	// Determine optimal batch size based on collection size
	const cores = navigator.hardwareConcurrency || 4;
	const batchSize = Math.max(2, Math.min(Math.ceil(collectionSize / (cores * 2)), 500));

	console.log(`⚡ Using sequential generation for large collections`);

	// Sequential processing - process items one at a time
	for (let i = 0; i < collectionSize; i++) {
		let result = null;
		let attempts = 0;
		const maxAttempts = 100; // Prevent infinite loops

		// Try to generate a valid NFT with strict pair constraints
		while (!result && attempts < maxAttempts) {
			result = await generateSingleNFT(
				i,
				layers,
				outputSize,
				projectName,
				projectDescription,
				traitCache,
				metadataStandard,
				canvas,
				ctx,
				spriteSheets
			);

			if (result) {
				// Check strict pair constraints
				const metadata = result.metadata.data as any;
				const selectedTraits = metadata.attributes.map((attr: any) => {
					const layer = layers.find(l => l.name === attr.trait_type);
					const trait = layer?.traits?.find(t => t.name === attr.value);
					return {
						traitId: trait?.id || '',
						layerId: layer?.id || ''
					};
				}).filter((t: any) => t.traitId && t.layerId);

				if (isCombinationUsed(selectedTraits, strictPairConfig)) {
					// This combination is already used, try again
					result = null;
					attempts++;
				} else {
					// Valid combination, mark it as used
					markCombinationAsUsed(selectedTraits, strictPairConfig);
				}
			} else {
				attempts++;
			}
		}

		if (!result) {
			console.warn(`Failed to generate valid NFT ${i + 1} after ${maxAttempts} attempts`);
			continue;
		}

		images.push(result.image);
		metadata.push(result.metadata);

		// Update progress periodically (every 100 items or at the end)
		if (i % 100 === 0 || i === collectionSize - 1) {
			const progress = i + 1;
			const percentage = ((progress / collectionSize) * 100).toFixed(1);
			const etaMinutes =
				collectionSize > 5000
					? `${Math.round(((collectionSize - progress) / 1000) * 2)}m`
					: `${Math.round((collectionSize - progress) / 500)}s`;

			progressManager.scheduleUpdate(
				createProgressUpdate(
					progress,
					collectionSize,
					`Sequential generation: ${progress}/${collectionSize} (${percentage}%) - ETA: ${etaMinutes}`
				)
			);
		}
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
	traitCache: Map<string, ImageBitmap> | undefined,
	progressManager: any,
	metadataStandard?: MetadataStandard,
	spriteSheets?: Map<string, PackedLayer>,
	strictPairConfig?: {
		enabled: boolean;
		layerCombinations: Array<{
			id: string;
			layerIds: string[];
			description: string;
			active: boolean;
		}>;
	}
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

	// Use sequential processing for large collections
	if (collectionSize > 1000) {
		return await generateNFTsSequential(
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
			metadata,
			spriteSheets,
			strictPairConfig
		);
	}

	// Generate each NFT sequentially for smaller collections
	for (let i = 0; i < collectionSize; i++) {
		let result = null;
		let attempts = 0;
		const maxAttempts = 100; // Prevent infinite loops

		// Try to generate a valid NFT with strict pair constraints
		while (!result && attempts < maxAttempts) {
			result = await generateSingleNFT(
				i,
				layers,
				outputSize,
				projectName,
				projectDescription,
				traitCache,
				metadataStandard,
				canvas,
				ctx,
				spriteSheets
			);

			if (result) {
				// Check strict pair constraints
				const metadata = result.metadata.data as any;
				const selectedTraits = metadata.attributes.map((attr: any) => {
					const layer = layers.find(l => l.name === attr.trait_type);
					const trait = layer?.traits?.find(t => t.name === attr.value);
					return {
						traitId: trait?.id || '',
						layerId: layer?.id || ''
					};
				}).filter((t: any) => t.traitId && t.layerId);

				if (isCombinationUsed(selectedTraits, strictPairConfig)) {
					// This combination is already used, try again
					result = null;
					attempts++;
				} else {
					// Valid combination, mark it as used
					markCombinationAsUsed(selectedTraits, strictPairConfig);
				}
			} else {
				attempts++;
			}
		}

		if (!result) {
			console.warn(`Failed to generate valid NFT ${i + 1} after ${maxAttempts} attempts`);
			continue;
		}

		images.push(result.image);
		metadata.push(result.metadata);

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
 * Weighted random selection based on rarity weights
 * Higher rarityWeight = lower probability (rarer)
 */
function selectWeightedRandom(traits: TransferrableTrait[]): TransferrableTrait | null {
	if (!traits || traits.length === 0) return null;

	// Calculate total weight (inverse of rarityWeight)
	// rarityWeight 1 (common) = weight 5, rarityWeight 5 (legendary) = weight 1
	const weights = traits.map(trait => 6 - (trait.rarityWeight || 1));
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

	// Generate random number between 0 and totalWeight
	const random = Math.random() * totalWeight;

	// Find selected trait based on weights
	let currentWeight = 0;
	for (let i = 0; i < traits.length; i++) {
		currentWeight += weights[i];
		if (random <= currentWeight) {
			return traits[i];
		}
	}

	// Fallback to last trait
	return traits[traits.length - 1];
}

/**
 * Check if a trait is compatible with already selected traits based on ruler rules
 */
function isTraitRulerCompatible(
	candidateTrait: TransferrableTrait,
	candidateLayerId: string,
	selectedTraits: Array<{ trait: TransferrableTrait; layerId: string }>,
	allLayers: TransferrableLayer[]
): boolean {
	// Check if candidate trait has ruler rules that conflict with selected traits
	if (candidateTrait.rulerRules) {
		for (const rule of candidateTrait.rulerRules) {
			const targetLayer = allLayers.find(l => l.id === rule.layerId);
			if (!targetLayer) continue;

			const selectedTrait = selectedTraits.find(t => t.layerId === rule.layerId);
			if (!selectedTrait) continue;

			// Check forbidden traits
			if (rule.forbiddenTraitIds.includes(selectedTrait.trait.id)) {
				return false;
			}

			// Check allowed traits (if whitelist exists)
			if (rule.allowedTraitIds.length > 0 && !rule.allowedTraitIds.includes(selectedTrait.trait.id)) {
				return false;
			}
		}
	}

	// Check if any selected trait has ruler rules that conflict with candidate
	for (const selected of selectedTraits) {
		if (selected.trait.rulerRules) {
			for (const rule of selected.trait.rulerRules) {
				if (rule.layerId === candidateLayerId) {
					// Check forbidden traits
					if (rule.forbiddenTraitIds.includes(candidateTrait.id)) {
						return false;
					}

					// Check allowed traits (if whitelist exists)
					if (rule.allowedTraitIds.length > 0 && !rule.allowedTraitIds.includes(candidateTrait.id)) {
						return false;
					}
				}
			}
		}
	}

	return true;
}

/**
 * Enhanced trait selection with ruler rule validation and rarity weight consideration
 * Maintains performance while ensuring constraint compliance
 */
function selectTraitsSimple(
	layers: TransferrableLayer[],
	traitCache?: Map<string, ImageBitmap>
): Array<{ trait: TransferrableTrait; layerId: string; bitmap: ImageBitmap | null }> {
	const selected: Array<{
		trait: TransferrableTrait;
		layerId: string;
		bitmap: ImageBitmap | null;
	}> = [];

	// Track layers that have ruler rules for optimization
	const rulerLayers = new Set<string>();
	for (const layer of layers) {
		if (layer.traits?.some(t => t.rulerRules && t.rulerRules.length > 0)) {
			rulerLayers.add(layer.id);
		}
	}

	// Process layers in order, handling ruler constraints
	for (const layer of layers) {
		// Skip optional layers randomly to create variety
		if (layer.isOptional && Math.random() < 0.3) {
			continue;
		}

		if (!layer.traits || layer.traits.length === 0) {
			continue;
		}

		// If layer has no ruler rules and no other layers have ruler rules affecting it,
		// use simple weighted random selection
		if (!rulerLayers.has(layer.id) && !hasRulerConstraintsFromOtherLayers(layer.id, layers)) {
			const selectedTrait = selectWeightedRandom(layer.traits);
			if (selectedTrait) {
				const bitmap = traitCache ? traitCache.get(selectedTrait.id) || null : null;
				selected.push({
					trait: selectedTrait,
					layerId: layer.id,
					bitmap
				});
			}
			continue;
		}

		// For layers with ruler constraints, try multiple times to find compatible trait
		const maxAttempts = 50; // Prevent infinite loops
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const candidateTrait = selectWeightedRandom(layer.traits);
			if (!candidateTrait) continue;

			// Check compatibility with already selected traits
			if (isTraitRulerCompatible(candidateTrait, layer.id, selected, layers)) {
				const bitmap = traitCache ? traitCache.get(candidateTrait.id) || null : null;
				selected.push({
					trait: candidateTrait,
					layerId: layer.id,
					bitmap
				});
				break;
			}
		}
	}

	return selected;
}

/**
 * Check if a layer is constrained by ruler rules from other layers
 */
function hasRulerConstraintsFromOtherLayers(layerId: string, allLayers: TransferrableLayer[]): boolean {
	for (const layer of allLayers) {
		if (layer.id === layerId) continue;
		if (layer.traits?.some(t =>
			t.rulerRules?.some(rule => rule.layerId === layerId)
		)) {
			return true;
		}
	}
	return false;
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
export function getCollectionAnalysis(layers: TransferrableLayer[], collectionSize: number, strictPairConfig?: { enabled: boolean; layerCombinations: Array<{ id: string; layerIds: string[]; description: string; active: boolean }> }) {
	const complexity = detectCollectionComplexity(layers, collectionSize, strictPairConfig);

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
