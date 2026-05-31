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
		memoryPressure: 0
	};

	constructor() {
		// Intelligent cache sizing based on device capabilities
		this.deviceMemoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
		this.maxEntries = this.calculateOptimalEntries();
		this.maxMemoryBytes = this.calculateOptimalMemory();
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
	 * Smart eviction using LRU + frequency + memory pressure.
	 * Uses single-pass top-k selection (O(n)) instead of full sort (O(n log n)).
	 */
	private evictEntries(requiredSpace: number): void {
		const entries = Array.from(this.cache.entries());

		// Single-pass top-k selection: find the maxEvictions entries with highest eviction scores.
		// This avoids a full O(n log n) sort — we only maintain a small sorted candidate list.
		const maxEvictions = Math.min(entries.length, 10);
		type Candidate = {
			key: string;
			entry: {
				buffer: ArrayBuffer;
				accessTime: number;
				size: number;
				accessCount: number;
				creationTime: number;
			};
		};
		const topCandidates: Candidate[] = []; // Sorted ascending by evictionScore (smallest first)

		const now = Date.now();

		for (const [key, entry] of entries) {
			const daysSinceCreation = (now - entry.creationTime) / (1000 * 60 * 60 * 24);
			const accessFrequency = entry.accessCount / Math.max(1, daysSinceCreation);
			const evictionScore = (accessFrequency / Math.max(1, entry.size / 1024)) * 1000;

			if (topCandidates.length < maxEvictions) {
				topCandidates.push({ key, entry });
				topCandidates.sort((a, b) => {
					const scoreA = this.computeEvictionScore(a.entry, now);
					const scoreB = this.computeEvictionScore(b.entry, now);
					return scoreA - scoreB;
				});
			} else {
				const minScore = this.computeEvictionScore(topCandidates[0].entry, now);
				if (evictionScore > minScore) {
					topCandidates[0] = { key, entry };
					topCandidates.sort((a, b) => {
						const scoreA = this.computeEvictionScore(a.entry, now);
						const scoreB = this.computeEvictionScore(b.entry, now);
						return scoreA - scoreB;
					});
				}
			}
		}

		// Sort candidates descending by score for eviction (highest score = best to evict)
		topCandidates.sort(
			(a, b) => this.computeEvictionScore(b.entry, now) - this.computeEvictionScore(a.entry, now)
		);

		let freedSpace = 0;
		for (const { key, entry } of topCandidates) {
			if (freedSpace >= requiredSpace) break;
			if (!this.cache.has(key)) continue;
			this.cache.delete(key);
			this.currentMemoryUsage -= entry.size;
			freedSpace += entry.size;
			this.stats.evictions++;
		}

		if (freedSpace < requiredSpace) {
			this.stats.memoryPressure++;
			// If still not enough space, force evict oldest entries (Map iteration order = insertion order)
			for (const [key, entry] of this.cache.entries()) {
				if (freedSpace >= requiredSpace) break;
				this.cache.delete(key);
				this.currentMemoryUsage -= entry.size;
				freedSpace += entry.size;
				this.stats.evictions++;
			}
		}
	}

	/**
	 * Compute eviction score for a single entry.
	 * Higher score = better candidate for eviction.
	 */
	private computeEvictionScore(
		entry: { accessCount: number; creationTime: number; size: number },
		now: number
	): number {
		const daysSinceCreation = (now - entry.creationTime) / (1000 * 60 * 60 * 24);
		const accessFrequency = entry.accessCount / Math.max(1, daysSinceCreation);
		return (accessFrequency / Math.max(1, entry.size / 1024)) * 1000;
	}

	clear(): void {
		this.cache.clear();
		this.currentMemoryUsage = 0;
		this.currentBatch = 0;
		this.stats.evictions = 0;
		this.stats.memoryPressure = 0;
	}

	get size(): number {
		return this.cache.size;
	}

	get memoryUsage(): number {
		return this.currentMemoryUsage;
	}

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
