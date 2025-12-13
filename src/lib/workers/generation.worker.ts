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
import { SpritePacker, type PackedLayer } from '$lib/utils/sprite-packer';

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

// Enhanced worker-level LRU cache with predictive caching and smart eviction
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
			predictedUsage: number; // AI-predicted future usage score
			lastAccessedBatch: number; // Track which batch last accessed this
		}
	>();

	private maxEntries: number;
	private maxMemoryBytes: number;
	private currentMemoryUsage = 0;
	private deviceMemoryGB: number;
	private currentBatch = 0;

	// Enhanced performance tracking
	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		memoryPressure: 0,
		predictiveHits: 0,
		prefetchedItems: 0,
		cacheEfficiency: 0
	};

	// Predictive caching for frequently accessed patterns
	private accessPatterns = new Map<string, number[]>(); // traitName -> batch numbers accessed
	private frequentTraits = new Set<string>(); // Traits accessed frequently

	constructor() {
		// Intelligent cache sizing based on device capabilities
		this.deviceMemoryGB = (navigator as any).deviceMemory || 4;
		this.maxEntries = this.calculateOptimalEntries();
		this.maxMemoryBytes = this.calculateOptimalMemory();

		console.log(
			`🧠 Enhanced Cache initialized: ${this.maxEntries} entries, ${(this.maxMemoryBytes / 1024 / 1024).toFixed(1)}MB max`
		);
	}

	/**
	 * Calculate predicted usage score for a cache key based on access patterns
	 */
	private calculatePredictedUsage(key: string): number {
		// Extract trait name from cache key (format: traitName_size_width_height)
		const traitName = key.split('_')[0];

		// Check if this trait is frequently accessed
		if (this.frequentTraits.has(traitName)) {
			return 2.0; // High predicted usage
		}

		// Check access pattern frequency
		const pattern = this.accessPatterns.get(traitName);
		if (pattern && pattern.length > 3) {
			return 1.5; // Medium-high predicted usage
		}

		return 1.0; // Default predicted usage
	}

	/**
	 * Update batch number for predictive caching
	 */
	updateBatch(batchNumber: number): void {
		this.currentBatch = batchNumber;

		// Update frequent traits based on access patterns
		this.updateFrequentTraits();
	}

	/**
	 * Record access pattern for predictive caching
	 */
	recordAccess(key: string): void {
		const traitName = key.split('_')[0];
		const pattern = this.accessPatterns.get(traitName) || [];
		pattern.push(this.currentBatch);

		// Keep only recent patterns (last 10 batches)
		if (pattern.length > 10) {
			pattern.shift();
		}

		this.accessPatterns.set(traitName, pattern);
	}

	/**
	 * Update frequently accessed traits based on patterns
	 */
	private updateFrequentTraits(): void {
		this.frequentTraits.clear();

		for (const [traitName, pattern] of this.accessPatterns) {
			// A trait is considered frequent if accessed in >50% of recent batches
			const recentBatches = pattern.filter((batch: number) => batch >= this.currentBatch - 10);

			if (recentBatches.length > 5) {
				this.frequentTraits.add(traitName);
			}
		}
	}

	/**
	 * Prefetch predicted items based on access patterns
	 */
	prefetchPredictedItems(availableBuffers: ArrayBuffer[], traitNames: string[]): void {
		for (let i = 0; i < availableBuffers.length && i < traitNames.length; i++) {
			const traitName = traitNames[i];
			const buffer = availableBuffers[i];

			if (this.frequentTraits.has(traitName)) {
				const cacheKey = `${traitName}_${buffer.byteLength}_0_0`;
				if (!this.cache.has(cacheKey)) {
					this.set(cacheKey, buffer);
					this.stats.prefetchedItems++;
				}
			}
		}
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
			creationTime: Date.now(),
			predictedUsage: this.calculatePredictedUsage(key),
			lastAccessedBatch: this.currentBatch
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
		this.currentBatch = 0;
		this.accessPatterns.clear();
		this.frequentTraits.clear();
		this.stats.hits = 0;
		this.stats.misses = 0;
		this.stats.evictions = 0;
		this.stats.memoryPressure = 0;
		this.stats.predictiveHits = 0;
		this.stats.prefetchedItems = 0;
		this.stats.cacheEfficiency = 0;
	}

	get size(): number {
		return this.cache.size;
	}

	get memoryUsage(): number {
		return this.currentMemoryUsage;
	}

	/**
	 * Get enhanced cache performance statistics
	 */
	getStats() {
		const totalOps = this.stats.hits + this.stats.misses;
		const hitRate = totalOps > 0 ? (this.stats.hits / totalOps) * 100 : 0;

		// Calculate memory efficiency
		const memoryEfficiency =
			this.currentMemoryUsage > 0
				? (this.stats.hits / (this.stats.hits + this.stats.misses)) *
					(1 - this.currentMemoryUsage / this.maxMemoryBytes) *
					100
				: 0;

		return {
			...this.stats,
			hitRate: hitRate.toFixed(1),
			entries: this.cache.size,
			memoryUsageMB: (this.currentMemoryUsage / 1024 / 1024).toFixed(1),
			maxMemoryMB: (this.maxMemoryBytes / 1024 / 1024).toFixed(1),
			memoryUtilization: ((this.currentMemoryUsage / this.maxMemoryBytes) * 100).toFixed(1),
			cacheEfficiency: memoryEfficiency.toFixed(1),
			frequentTraitsCount: this.frequentTraits.size,
			predictiveHits: this.stats.predictiveHits,
			prefetchedItems: this.stats.prefetchedItems
		};
	}
}

// Global worker cache instance
const workerArrayBufferCache = new WorkerArrayBufferCache();

// Enhanced performance tracking for sequential processing
class SequentialPerformanceMonitor {
	private startTime = 0;
	private processedCount = 0;
	private lastReportTime = 0;
	private averageProcessingTime = 0;
	private totalCount = 0;

	start(totalCount: number): void {
		this.startTime = Date.now();
		this.processedCount = 0;
		this.lastReportTime = this.startTime;
		this.averageProcessingTime = 0;
		this.totalCount = totalCount;
		console.log(`🚀 Sequential Generation Started: Target ${totalCount} NFTs`);
	}

	recordProcessing(timePerItem: number): void {
		this.processedCount++;

		// Update running average
		this.averageProcessingTime =
			(this.averageProcessingTime * (this.processedCount - 1) + timePerItem) / this.processedCount;

		const now = Date.now();
		if (now - this.lastReportTime > 2000) {
			// Report every 2 seconds
			const elapsed = now - this.startTime;
			const rate = this.processedCount / (elapsed / 1000);
			const remaining = Math.max(0, this.totalCount - this.processedCount);
			const eta = (this.averageProcessingTime * remaining) / 1000 / 60;

			console.log(
				`⚡ Sequential Performance: ${this.processedCount}/${this.totalCount} NFTs | ` +
					`${rate.toFixed(1)} NFTs/sec | ETA: ${eta.toFixed(1)}min | ` +
					`Avg: ${this.averageProcessingTime.toFixed(1)}ms/item`
			);
			this.lastReportTime = now;
		}
	}

	finish(): void {
		const totalTime = Date.now() - this.startTime;
		const finalRate = this.processedCount / (totalTime / 1000);
		console.log(
			`🎯 Sequential Generation Complete: ${this.processedCount} NFTs in ${(totalTime / 1000).toFixed(1)}s | ` +
				`Average: ${finalRate.toFixed(1)} NFTs/sec`
		);
	}
}

const performanceMonitor = new SequentialPerformanceMonitor();

// Optimized memory pooling for sequential processing
class OptimizedMemoryManager {
	private canvasPool: OffscreenCanvas[] = [];
	private ctxPool: OffscreenCanvasRenderingContext2D[] = [];
	private objectUrlSet = new Set<string>(); // Track ObjectURLs for cleanup

	private maxPoolSize: number;
	private deviceMemoryGB: number;

	constructor() {
		this.deviceMemoryGB = (navigator as any).deviceMemory || 4;
		this.maxPoolSize = Math.min(this.deviceMemoryGB * 2, 10); // 2 canvases per GB, max 10
		console.log(`🎯 Memory Manager: Max pool size ${this.maxPoolSize} canvases`);
	}

	getCanvas(width: number, height: number): OffscreenCanvas {
		// Try to reuse a canvas from the pool
		let canvas = this.canvasPool.pop();

		if (!canvas || canvas.width !== width || canvas.height !== height) {
			canvas = new OffscreenCanvas(width, height);
		}

		return canvas;
	}

	returnCanvas(canvas: OffscreenCanvas): void {
		if (this.canvasPool.length < this.maxPoolSize) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}
			this.canvasPool.push(canvas);
		}
	}

	getContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Failed to get 2D context');
		}
		return ctx;
	}

	trackObjectUrl(url: string): void {
		this.objectUrlSet.add(url);
	}

	cleanupObjectUrls(): void {
		for (const url of this.objectUrlSet) {
			URL.revokeObjectURL(url);
		}
		this.objectUrlSet.clear();
	}

	get poolStats() {
		return {
			pooledCanvases: this.canvasPool.length,
			maxPoolSize: this.maxPoolSize,
			trackedUrls: this.objectUrlSet.size
		};
	}
}

// Global memory manager instance
const memoryManager = new OptimizedMemoryManager();

// ============================================================================
// OPTIMIZATION 1: Trait Combination Caching
// ============================================================================
// Cache rendered trait combinations to avoid re-processing identical combinations
class TraitCombinationCache {
	private combinationCache = new Map<
		string,
		{
			canvas: OffscreenCanvas;
			accessTime: number;
			accessCount: number;
			creationTime: number;
		}
	>();

	private maxCombinations: number;
	private maxMemoryBytes: number;
	private currentMemoryUsage = 0;

	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		savedRenderingTime: 0
	};

	constructor() {
		// Cache up to 50 combinations for each 1GB of device memory, capped at 500
		const deviceMemoryGB = (navigator as any).deviceMemory || 4;
		this.maxCombinations = Math.min(deviceMemoryGB * 50, 500);
		// Allocate 10% of device memory for combination cache
		this.maxMemoryBytes = Math.min(deviceMemoryGB * 1024 * 1024 * 1024 * 0.1, 200 * 1024 * 1024); // Cap at 200MB

		console.log(
			`🎨 Trait Combination Cache initialized: ${this.maxCombinations} max combinations, ` +
				`${(this.maxMemoryBytes / 1024 / 1024).toFixed(1)}MB max`
		);
	}

	/**
	 * Generate cache key from trait combination
	 * Key is sorted trait IDs joined by pipe for consistent lookups
	 */
	private generateKey(traitIds: string[]): string {
		return [...traitIds].sort().join('|');
	}

	/**
	 * Get cached combination canvas if available
	 */
	get(traitIds: string[]): OffscreenCanvas | undefined {
		const key = this.generateKey(traitIds);
		const entry = this.combinationCache.get(key);

		if (entry) {
			entry.accessTime = Date.now();
			entry.accessCount++;
			this.stats.hits++;
			return entry.canvas;
		}

		this.stats.misses++;
		return undefined;
	}

	/**
	 * Cache a rendered trait combination
	 * For memory efficiency, we estimate canvas size based on typical PNG compression
	 */
	set(traitIds: string[], canvas: OffscreenCanvas): void {
		const key = this.generateKey(traitIds);

		// Estimate canvas memory footprint (rough: width * height * 4 bytes * 0.3 compression)
		const estimatedSize = canvas.width * canvas.height * 4 * 0.3;

		// Check memory pressure
		if (
			this.currentMemoryUsage + estimatedSize > this.maxMemoryBytes ||
			this.combinationCache.size >= this.maxCombinations
		) {
			this.evictEntries(estimatedSize);
		}

		// Don't cache if it's too large relative to our budget
		if (estimatedSize > this.maxMemoryBytes * 0.2) {
			return;
		}

		this.combinationCache.set(key, {
			canvas,
			accessTime: Date.now(),
			accessCount: 1,
			creationTime: Date.now()
		});

		this.currentMemoryUsage += estimatedSize;
	}

	/**
	 * Evict least valuable entries based on access frequency and age
	 */
	private evictEntries(requiredSpace: number): void {
		const entries = Array.from(this.combinationCache.entries());

		// Score entries: (accessCount / ageDays) - higher score = more valuable
		const scoredEntries = entries.map(([key, entry]) => {
			const ageDays = (Date.now() - entry.creationTime) / (1000 * 60 * 60 * 24);
			const value = entry.accessCount / Math.max(1, ageDays);
			return { key, entry, value };
		});

		// Sort by value (descending) - keep high-value items
		scoredEntries.sort((a, b) => b.value - a.value);

		let freedSpace = 0;
		const maxEvictions = Math.min(scoredEntries.length, 10);

		for (
			let i = scoredEntries.length - 1;
			i >= 0 && freedSpace < requiredSpace && maxEvictions > 0;
			i--
		) {
			const { key, entry } = scoredEntries[i];
			const estimatedSize = entry.canvas.width * entry.canvas.height * 4 * 0.3;
			this.combinationCache.delete(key);
			this.currentMemoryUsage -= estimatedSize;
			freedSpace += estimatedSize;
			this.stats.evictions++;
		}
	}

	clear(): void {
		this.combinationCache.clear();
		this.currentMemoryUsage = 0;
		this.stats.hits = 0;
		this.stats.misses = 0;
		this.stats.evictions = 0;
		this.stats.savedRenderingTime = 0;
	}

	get size(): number {
		return this.combinationCache.size;
	}

	getStats() {
		const totalOps = this.stats.hits + this.stats.misses;
		const hitRate = totalOps > 0 ? (this.stats.hits / totalOps) * 100 : 0;

		return {
			...this.stats,
			hitRate: hitRate.toFixed(1),
			cachedCombinations: this.combinationCache.size,
			maxCombinations: this.maxCombinations,
			memoryUsageMB: (this.currentMemoryUsage / 1024 / 1024).toFixed(1),
			maxMemoryMB: (this.maxMemoryBytes / 1024 / 1024).toFixed(1),
			memoryUtilization: ((this.currentMemoryUsage / this.maxMemoryBytes) * 100).toFixed(1)
		};
	}
}

const traitCombinationCache = new TraitCombinationCache();

// ============================================================================
// OPTIMIZATION 2: Blob Processing Optimization
// ============================================================================
// Batch and optimize blob creation for better throughput
class BlobProcessingOptimizer {
	private blobQueue: Array<{
		canvas: OffscreenCanvas;
		resolve: (blob: Blob) => void;
		reject: (error: Error) => void;
	}> = [];

	private processingPromise: Promise<void> | null = null;
	private batchSize = 5; // Process up to 5 blobs in parallel
	private totalTimeMs = 0;

	private stats = {
		totalBlobs: 0,
		batchedOperations: 0,
		averageTime: 0,
		qualityLevel: 0.9
	};

	/**
	 * Queue a canvas for blob conversion with batching
	 */
	async queueBlob(canvas: OffscreenCanvas, quality: number = 0.9): Promise<Blob> {
		this.stats.qualityLevel = quality;

		return new Promise((resolve, reject) => {
			this.blobQueue.push({ canvas, resolve, reject });
			void this.processBatch();
		});
	}

	/**
	 * Process queued blobs in batches for better throughput
	 */
	private async processBatch(): Promise<void> {
		if (this.processingPromise) {
			return this.processingPromise;
		}

		if (this.blobQueue.length === 0) {
			return;
		}

		this.processingPromise = (async () => {
			if (this.blobQueue.length < this.batchSize) {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			while (this.blobQueue.length > 0) {
				const batch = this.blobQueue.splice(0, this.batchSize);
				const startTime = performance.now();

				const blobPromises = batch.map(async (item) => {
					try {
						const blob = await item.canvas.convertToBlob({
							type: 'image/png',
							quality: this.stats.qualityLevel
						});
						item.resolve(blob);
					} catch (error) {
						item.reject(error instanceof Error ? error : new Error('Blob conversion failed'));
					}
				});

				await Promise.all(blobPromises);

				const batchTime = performance.now() - startTime;
				this.totalTimeMs += batchTime;
				this.stats.totalBlobs += batch.length;
				this.stats.batchedOperations++;
				this.stats.averageTime =
					this.stats.totalBlobs > 0 ? this.totalTimeMs / this.stats.totalBlobs : 0;
			}
		})();

		try {
			await this.processingPromise;
		} finally {
			this.processingPromise = null;
		}
	}

	/**
	 * Force immediate processing of remaining queued blobs
	 */
	async flush(): Promise<void> {
		while (this.blobQueue.length > 0 || this.processingPromise) {
			await this.processBatch();
		}
	}

	reset(): void {
		this.blobQueue = [];
		this.processingPromise = null;
		this.totalTimeMs = 0;
		this.stats.totalBlobs = 0;
		this.stats.batchedOperations = 0;
		this.stats.averageTime = 0;
	}

	getStats() {
		return {
			...this.stats,
			queuedBlobs: this.blobQueue.length,
			averageTimeMs: this.stats.averageTime.toFixed(2)
		};
	}
}

const blobProcessingOptimizer = new BlobProcessingOptimizer();
const inFlightEncodeCanvases = new Set<OffscreenCanvas>();

// ============================================================================
// OPTIMIZATION 3: Predictive Loading
// ============================================================================
// Predict and preload traits likely to be needed based on patterns
class PredictiveTraitLoader {
	private loadHistory: string[][] = []; // Store trait combinations in order
	private patternFrequency = new Map<string, number>(); // Pattern -> frequency
	private currentBatch = 0;

	private pendingPredictions: string[] = [];

	private stats = {
		predictionsAttempted: 0,
		successfulPredictions: 0,
		prefetchedItems: 0
	};

	/**
	 * Record a trait combination used in generation.
	 * Also evaluates the previous prediction set against this combination,
	 * and generates a new prediction set for the next item.
	 */
	recordCombination(traitIds: string[]): { patternFrequency: number; predictions: string[] } {
		// Evaluate previous predictions against the current combination
		if (this.pendingPredictions.length > 0) {
			const matched = this.pendingPredictions.some((predictedTraitId) =>
				traitIds.includes(predictedTraitId)
			);
			if (matched) {
				this.stats.successfulPredictions++;
			}
			this.pendingPredictions = [];
		}

		this.loadHistory.push([...traitIds]);

		// Keep only recent history (last 100 combinations)
		if (this.loadHistory.length > 100) {
			this.loadHistory.shift();
		}

		// Update pattern frequency
		const pattern = [...traitIds].sort().join('|');
		const nextFrequency = (this.patternFrequency.get(pattern) || 0) + 1;
		this.patternFrequency.set(pattern, nextFrequency);

		// Predict next traits (attempted even if it returns an empty array)
		const predictions = this.predictNextTraits(traitIds);
		if (this.loadHistory.length >= 3) {
			this.stats.predictionsAttempted++;
			this.pendingPredictions = predictions;
		}

		return { patternFrequency: nextFrequency, predictions };
	}

	/**
	 * Predict likely next traits based on current patterns
	 * Returns top predicted trait IDs sorted by probability
	 */
	predictNextTraits(currentTraitIds: string[]): string[] {
		if (this.loadHistory.length < 3) {
			return []; // Not enough data to predict
		}

		const predicted = new Map<string, number>(); // traitId -> score
		const currentPattern = [...currentTraitIds].sort().join('|');

		// Find similar patterns in history
		for (const [pattern, frequency] of this.patternFrequency) {
			if (this.isSimilarPattern(pattern, currentPattern)) {
				// Extract unique traits from pattern
				const patternTraits = pattern.split('|');
				for (const trait of patternTraits) {
					if (!currentTraitIds.includes(trait)) {
						predicted.set(trait, (predicted.get(trait) || 0) + frequency);
					}
				}
			}
		}

		// Sort by score and return top predictions
		return Array.from(predicted.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([trait]) => trait);
	}

	/**
	 * Check if two patterns are similar (share 70% of traits)
	 */
	private isSimilarPattern(pattern1: string, pattern2: string): boolean {
		const traits1 = new Set(pattern1.split('|'));
		const traits2 = new Set(pattern2.split('|'));

		const intersection = new Set([...traits1].filter((x) => traits2.has(x)));
		const union = new Set([...traits1, ...traits2]);

		const similarity = intersection.size / Math.max(1, union.size);
		return similarity >= 0.7;
	}

	/**
	 * Get most common trait combinations
	 */
	getMostCommonCombinations(limit: number = 10): Array<{ traits: string[]; frequency: number }> {
		return Array.from(this.patternFrequency.entries())
			.map(([pattern, frequency]) => ({
				traits: pattern.split('|'),
				frequency
			}))
			.sort((a, b) => b.frequency - a.frequency)
			.slice(0, limit);
	}

	updateBatch(batchNumber: number): void {
		this.currentBatch = batchNumber;
	}

	clear(): void {
		this.loadHistory = [];
		this.patternFrequency.clear();
		this.currentBatch = 0;
		this.pendingPredictions = [];
		this.stats.predictionsAttempted = 0;
		this.stats.successfulPredictions = 0;
		this.stats.prefetchedItems = 0;
	}

	getStats() {
		return {
			...this.stats,
			historicalCombinations: this.loadHistory.length,
			uniquePatterns: this.patternFrequency.size
		};
	}
}

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

// Enhanced combination tracking with incremental updates and hybrid indexing
// Combines bit-packed indexing with hash-based lookups for optimal performance
const usedCombinations = new Map<string, Set<bigint>>();
const combinationHashes = new Map<string, string>(); // Hybrid string-based tracking for edge cases
const combinationStats = {
	totalChecks: 0,
	bitPackHits: 0,
	hashHits: 0,
	memoryEfficiency: 0
};

// Enhanced combination tracking with incremental updates and hybrid indexing
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

		// Initialize tracking sets if not present
		if (!usedCombinations.has(layerCombination.id)) {
			usedCombinations.set(layerCombination.id, new Set());
		}
		const usedSet = usedCombinations.get(layerCombination.id)!;

		// Enhanced hybrid indexing for optimal performance
		let useBitPack = true;

		try {
			// Try bit-packed indexing first (faster and more memory efficient)
			const traitIds = foundTraits.map((id) => parseInt(id, 10));

			// Check if trait IDs are within acceptable range for bit-packing
			if (traitIds.some((id) => id > 255 || traitIds.length > 8)) {
				useBitPack = false;
			} else {
				const combinationKey = CombinationIndexer.pack(traitIds);
				usedSet.add(combinationKey);
				combinationStats.bitPackHits++;
			}
		} catch {
			useBitPack = false;
		}

		// Add to tracking with incremental updates
		if (!useBitPack) {
			const stringKey = foundTraits.sort().join('|');
			const hashKey = generateCombinationHash(stringKey);
			if (!combinationHashes.has(hashKey)) {
				combinationHashes.set(hashKey, stringKey);
			}
			combinationStats.hashHits++;
		}

		combinationStats.totalChecks++;
	}
}

// Generate hash for combination keys (fast lookup)
function generateCombinationHash(combinationKey: string): string {
	let hash = 0;
	for (let i = 0; i < combinationKey.length; i++) {
		const char = combinationKey.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash.toString(36);
}

// Check if combination is used (enhanced with hybrid indexing)
function isCombinationUsed(
	selectedTraits: { traitId: string; layerId: string }[],
	layerCombinationId: string
): boolean {
	const usedSet = usedCombinations.get(layerCombinationId);
	if (!usedSet || usedSet.size === 0) {
		return false;
	}

	// Extract trait IDs for the combination
	const foundTraits: string[] = [];
	for (const trait of selectedTraits) {
		foundTraits.push(trait.traitId);
	}

	// Try bit-packed lookup first (faster path)
	try {
		const traitIds = foundTraits.map((id) => parseInt(id, 10));
		if (traitIds.every((id) => id <= 255) && traitIds.length <= 8) {
			const combinationKey = CombinationIndexer.pack(traitIds);
			if (usedSet.has(combinationKey)) {
				combinationStats.bitPackHits++;
				combinationStats.totalChecks++;
				return true;
			}
		}
	} catch {
		// Fall through to hash-based lookup
	}

	// Fallback to hash-based lookup
	const combinationKey = foundTraits.sort().join('|');
	const hashKey = generateCombinationHash(combinationKey);

	if (combinationHashes.has(hashKey)) {
		combinationStats.hashHits++;
		combinationStats.totalChecks++;
		return true;
	}

	combinationStats.totalChecks++;
	return false;
}

// Clear combination tracking with enhanced cleanup
function clearUsedCombinations(): void {
	usedCombinations.clear();
	combinationHashes.clear();

	// Reset stats
	combinationStats.totalChecks = 0;
	combinationStats.bitPackHits = 0;
	combinationStats.hashHits = 0;
	combinationStats.memoryEfficiency = 0;
}

// Legacy function removed - using enhanced version above

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
 * Sequential image processing - Phase 2: Replace parallel batch processing
 * Processes trait images one at a time for simplified operation
 * @param requests - Array of image processing requests
 * @returns Promise resolving to array of ImageBitmaps in original order
 */
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

// Performance monitoring removed - only count tracked

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

	// WebGL disabled - no WebGL renderer
	// let webGLRenderer: WebGLRenderer | null = null;
	const totalTraits = layers.reduce((sum, layer) => sum + (layer.traits?.length || 0), 0);

	// Try sprite sheets for 20+ traits
	if (totalTraits >= 20) {
		console.log(`🎨 Pre-packing ${totalTraits} traits into sprite sheets...`);
		const spriteSheetResult = await preloadSpriteSheets(layers, outputSize);
		if (spriteSheetResult) {
			spriteSheets = spriteSheetResult.spriteSheets;
			console.log(`💾 Using sprite sheets for generation (40-60% memory savings)`);
		}
	}

	// Prepare a reusable OffscreenCanvas and context once per generation to reduce GC churn
	// Always get 2D context for existing drawing operations
	const reusableCanvas = new OffscreenCanvas(outputSize.width, outputSize.height);
	const reusableCtx = reusableCanvas.getContext('2d');
	if (!reusableCtx) {
		throw new Error('Could not get 2d context from OffscreenCanvas');
	}
	reusableCtx.imageSmoothingEnabled = false;
	reusableCtx.globalCompositeOperation = 'source-over';

	// WebGL disabled - use 2D canvas only for simplified operation

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
				await flushQueuedItem(pendingItems.shift()!, collectionSize, undefined, taskId);
			}

			const queuedItem = await generateAndQueueItem(
				i,
				layers,
				reusableCanvas,
				reusableCtx,
				targetWidth,
				targetHeight,
				projectName,
				projectDescription,
				metadata,
				strictPairConfig,
				taskId,
				metadataStandard,
				spriteSheets
			);

			if (queuedItem) {
				pendingItems.push(queuedItem);
				successfulGenerations++;
				consecutiveFailures = 0;
			} else {
				consecutiveFailures++;
				i--; // Retry the same index

				if (consecutiveFailures > 1000) {
					const errorMessage: ErrorMessage = {
						type: 'error',
						taskId,
						payload: {
							message: `Generation stopped: Exhausted all possible unique combinations. Successfully generated ${successfulGenerations} NFTs, but no more valid combinations are available with the current strict pair configuration.`
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
				await flushQueuedItem(pendingItems.shift()!, collectionSize, undefined, taskId);
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

			// Create a temporary array to hold only the current chunk's images
			const chunkImages: { name: string; blob: Blob }[] = [];
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
					await flushQueuedItem(pendingItems.shift()!, collectionSize, chunkImages, taskId);
				}

				const queuedItem = await generateAndQueueItem(
					i,
					layers,
					reusableCanvas,
					reusableCtx,
					targetWidth,
					targetHeight,
					projectName,
					projectDescription,
					metadata,
					strictPairConfig,
					taskId,
					metadataStandard,
					spriteSheets
				);

				if (queuedItem) {
					pendingItems.push(queuedItem);
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
							memoryUsage: getMemoryUsage() || undefined
						}
					};
					self.postMessage(currentProgress);
				}
			}

			if (!isCancelled) {
				while (pendingItems.length > 0) {
					await flushQueuedItem(pendingItems.shift()!, collectionSize, chunkImages, taskId);
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

			if (generationAborted) {
				break;
			}

			// Adaptive chunking based on memory usage
			CHUNK_SIZE = adaptChunkSize(CHUNK_SIZE, getMemoryUsage());
		}
	}

	// Remove cancel listener
	self.removeEventListener('message', cancelHandler);

	// Check if cancelled before final processing
	if (isCancelled) {
		if (!cancelNotified) {
			const cancelledMessage: CancelledMessage = {
				type: 'cancelled',
				taskId,
				payload: {
					generatedCount: 0,
					totalCount: collectionSize
				}
			};
			self.postMessage(cancelledMessage);
		}
		return;
	}

	// Report final cache statistics (before cleanup)
	const cacheStats = workerArrayBufferCache.getStats();
	const combinationCacheStats = traitCombinationCache.getStats();
	const blobStats = blobProcessingOptimizer.getStats();
	const predictiveStats = predictiveTraitLoader.getStats();

	console.log(
		`✅ Generation Complete - Smart Cache: ${cacheStats.entries} entries, ` +
			`${cacheStats.memoryUtilization}% memory, ${cacheStats.hitRate}% hit rate | ` +
			`Sequential Processing: ${imageProcessingStats.sequentialCount} items processed`
	);

	console.log(
		`🎨 Trait Combination Cache: ${combinationCacheStats.cachedCombinations}/${combinationCacheStats.maxCombinations} ` +
			`cached (${combinationCacheStats.hitRate}% hit rate, ${combinationCacheStats.memoryUsageMB}MB used)`
	);

	console.log(
		`🔄 Blob Processing: ${blobStats.totalBlobs} blobs batched, ` +
			`${blobStats.averageTimeMs}ms average, ${blobStats.batchedOperations} batch operations`
	);

	console.log(
		`🔮 Predictive Loading: ${predictiveStats.uniquePatterns} patterns analyzed, ` +
			`${predictiveStats.successfulPredictions}/${predictiveStats.predictionsAttempted} predictions successful`
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

	// Complete performance monitoring
	performanceMonitor.finish();

	self.postMessage(finalCompleteMessage);

	// Final cleanup (after reporting)
	await cleanupResources(null, spriteSheets); // No WebGL renderer
}

interface QueuedGeneratedItem {
	index: number;
	imageName: string;
	metadataName: string;
	metadataObj: object;
	encodeCanvas: OffscreenCanvas;
	blobPromise: Promise<Blob>;
	startTime: number;
}

// Generate a single item onto the reusable canvas, then copy it to an encode canvas and queue blob conversion.
async function generateAndQueueItem(
	index: number,
	layers: TransferrableLayer[],
	canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	targetWidth: number,
	targetHeight: number,
	projectName: string,
	projectDescription: string,
	metadata: { name: string; data: object }[],
	strictPairConfig?: StrictPairConfig,
	taskId?: TaskId,
	metadataStandard?: MetadataStandard,
	spriteSheets?: Map<string, PackedLayer>
): Promise<QueuedGeneratedItem | null> {
	const itemStartTime = performance.now();

	try {
		if (!ctx) {
			console.error('Canvas context is null in generateAndQueueItem');
			return null;
		}

		ctx.clearRect(0, 0, targetWidth, targetHeight);

		const selectedTraits: { traitId: string; layerId: string; trait: TransferrableTrait }[] = [];
		const hasRequiredLayerFailure = false;

		const solver = new CSPSolver(layers, usedCombinations, strictPairConfig);
		const solution = solver.solve();

		if (!solution) {
			return null;
		}

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

		if (selectedTraits.length === 0) {
			return null;
		}

		const selectedTraitIds = selectedTraits.map((t) => t.traitId);
		const cachedCombination = traitCombinationCache.get(selectedTraitIds);

		const { patternFrequency } = predictiveTraitLoader.recordCombination(selectedTraitIds);

		if (cachedCombination) {
			ctx.drawImage(cachedCombination, 0, 0, targetWidth, targetHeight);
		} else {
			if (spriteSheets && spriteSheets.size > 0) {
				// Sprite sheet path (much faster than per-trait decoding)
				for (const selected of selectedTraits) {
					const packedLayer = spriteSheets.get(selected.layerId);
					let drawn = false;

					if (packedLayer) {
						for (const sheet of packedLayer.sheets) {
							if (
								SpritePacker.drawFromSheet(
									ctx,
									sheet,
									selected.traitId,
									0,
									0,
									targetWidth,
									targetHeight
								)
							) {
								drawn = true;
								break;
							}
						}
					}

					// Fallback: decode and draw trait directly if not present in any sheet
					if (!drawn) {
						const bitmap = await createImageBitmapFromBuffer(
							selected.trait.imageData,
							selected.trait.name,
							{
								resizeWidth: targetWidth,
								resizeHeight: targetHeight
							}
						);
						ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
						bitmap.close();
					}
				}

				imageProcessingStats.sequentialCount += selectedTraits.length;
			} else {
				// Fallback path: decode per trait (cached ArrayBuffers)
				const batchRequests: BatchImageRequest[] = selectedTraits.map((trait, traitIndex) => ({
					trait: trait.trait,
					resizeWidth: targetWidth,
					resizeHeight: targetHeight,
					index: traitIndex
				}));

				const batchResults = await processImageRequestsSequential(batchRequests);

				for (let i = 0; i < selectedTraits.length; i++) {
					const trait = selectedTraits[i];
					const result = batchResults.find((r) => r.index === i);

					if (!result || !result.bitmap) {
						if (result?.error) {
							console.warn(
								`Failed to process image for trait "${trait.trait.name}": ${result.error.message}`
							);
						}
						return null;
					}

					ctx.drawImage(result.bitmap, 0, 0, targetWidth, targetHeight);
					result.bitmap.close();
				}
			}

			if (patternFrequency >= 2) {
				const cacheCanvas = new OffscreenCanvas(targetWidth, targetHeight);
				const cacheCtx = cacheCanvas.getContext('2d');
				cacheCtx?.drawImage(canvas, 0, 0, targetWidth, targetHeight);
				traitCombinationCache.set(selectedTraitIds, cacheCanvas);
			}
		}

		if (hasRequiredLayerFailure) {
			return null;
		}

		if (strictPairConfig?.enabled) {
			const simpleSelectedTraits = selectedTraits.map((t) => ({
				traitId: t.traitId,
				layerId: t.layerId
			}));
			markCombinationAsUsed(simpleSelectedTraits, strictPairConfig);
		}

		const attributes = selectedTraits.map((selected) => ({
			trait_type: layers.find((l) => l.id === selected.layerId)?.name || 'Unknown',
			value: selected.trait.name
		}));

		const strategy = getMetadataStrategy(metadataStandard as MetadataStandard);
		const metadataObj = strategy.format(
			`${projectName} #${index + 1}`,
			projectDescription,
			`${index + 1}.png`,
			attributes,
			{}
		);

		metadata.push({
			name: `${index + 1}.json`,
			data: metadataObj
		});

		// Copy from the reusable render canvas to a pooled encode canvas so we can overlap encode work.
		const encodeCanvas = memoryManager.getCanvas(targetWidth, targetHeight);
		inFlightEncodeCanvases.add(encodeCanvas);
		const encodeCtx = memoryManager.getContext(encodeCanvas);
		encodeCtx.imageSmoothingEnabled = false;
		encodeCtx.globalCompositeOperation = 'source-over';
		encodeCtx.clearRect(0, 0, targetWidth, targetHeight);
		encodeCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

		const blobPromise = blobProcessingOptimizer.queueBlob(encodeCanvas, 0.9);

		return {
			index,
			imageName: `${index + 1}.png`,
			metadataName: `${index + 1}.json`,
			metadataObj,
			encodeCanvas,
			blobPromise,
			startTime: itemStartTime
		};
	} catch (error) {
		const errorMessage: ErrorMessage = {
			type: 'error',
			taskId,
			payload: {
				message: `Error generating item ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
			}
		};
		self.postMessage(errorMessage);

		return null;
	}
}

async function flushQueuedItem(
	item: QueuedGeneratedItem,
	collectionSize: number,
	chunkImages: { name: string; blob: Blob }[] | undefined,
	taskId?: TaskId
): Promise<void> {
	try {
		const blob = await item.blobPromise;

		if (chunkImages) {
			chunkImages.push({ name: item.imageName, blob });
		} else {
			const imageData = await blob.arrayBuffer();
			const streamMessage: CompleteMessage = {
				type: 'complete',
				taskId,
				payload: {
					images: [{ name: item.imageName, imageData }],
					metadata: [{ name: item.metadataName, data: item.metadataObj }]
				}
			};

			// @ts-expect-error - TS in worker env may not infer postMessage overload with transfer list
			self.postMessage(streamMessage, [imageData]);

			if (item.index % PROGRESS_UPDATE_INTERVAL === 0 || item.index === collectionSize - 1) {
				if (item.index % MEMORY_CLEANUP_INTERVAL === 0) {
					cleanupObjectUrls();
				}

				const currentMemoryUsage = getMemoryUsage();

				const progressMessage: ProgressMessage = {
					type: 'progress',
					taskId,
					payload: {
						generatedCount: item.index + 1,
						totalCount: collectionSize,
						statusText: `Generated ${item.index + 1} of ${collectionSize} NFTs`,
						memoryUsage: currentMemoryUsage || undefined
					}
				};
				self.postMessage(progressMessage);
			}

			if (
				collectionSize <= 1000 &&
				(item.index % (PROGRESS_UPDATE_INTERVAL * 2) === 0 || item.index === collectionSize - 1)
			) {
				await sendPreview(blob, item.index, taskId);
			}
		}

		if (collectionSize > 1000 && typeof globalThis !== 'undefined' && 'gc' in globalThis) {
			(globalThis as { gc?: () => void }).gc?.();
		}

		const itemEndTime = performance.now();
		performanceMonitor.recordProcessing(itemEndTime - item.startTime);
	} finally {
		inFlightEncodeCanvases.delete(item.encodeCanvas);
		memoryManager.returnCanvas(item.encodeCanvas);
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

// Send preview for progressive rendering using memory pool
async function sendPreview(blob: Blob, index: number, taskId?: TaskId): Promise<void> {
	// Create a small preview by converting to a small canvas to reduce data transfer
	try {
		// Use memory pool for preview canvas
		const smallCanvas = memoryManager.getCanvas(100, 100);
		const smallCtx = memoryManager.getContext(smallCanvas);
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

			// Return canvas to pool for reuse
			memoryManager.returnCanvas(smallCanvas);
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
import {
	shouldUseFastGeneration,
	getOptimizationHints,
	detectCollectionComplexity
} from './fast-generation-detector';
import {
	generateCollectionFast,
	getCollectionAnalysis,
	preloadSpriteSheets
} from './fast-generation';
import { performanceAnalyzer } from '$lib/utils/performance-analyzer';
import { CombinationIndexer } from '$lib/utils/combination-indexer';

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
				const analysis = getCollectionAnalysis(startPayload.layers, startPayload.collectionSize);

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
