/**
 * Enhanced worker-level LRU cache with predictive caching and smart eviction
 * Optimized for ArrayBuffer storage with memory pressure management
 */
export class WorkerArrayBufferCache {
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
		this.deviceMemoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
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
