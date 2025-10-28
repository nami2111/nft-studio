/**
 * Advanced LRU Cache with memory management, TTL, and metrics
 * Supports multiple data types with intelligent eviction strategies
 */

export interface CacheEntry<T> {
	data: T;
	accessTime: number;
	createTime: number;
	size: number;
	accessCount: number;
	ttl?: number; // Time to live in milliseconds
}

export interface CacheMetrics {
	hits: number;
	misses: number;
	sets: number;
	evictions: number;
	currentSize: number;
	currentEntries: number;
	maxSize: number;
	maxEntries: number;
	memoryUsage: number;
	hitRate: number;
	averageAccessCount: number;
}

export interface CacheOptions<T> {
	maxSize?: number; // Maximum memory size in bytes
	maxEntries?: number; // Maximum number of entries
	defaultTtl?: number; // Default TTL in milliseconds
	evictionPolicy?: 'lru' | 'lfu' | 'ttl'; // Eviction strategy
	sizeEstimator?: (data: T) => number; // Function to estimate data size
	onEvict?: (key: string, entry: CacheEntry<T>) => void; // Callback when entry is evicted
}

export class AdvancedCache<T = any> {
	private cache = new Map<string, CacheEntry<T>>();
	private metrics: CacheMetrics;
	private options: Required<CacheOptions<T>>;
	private cleanupTimer?: number;

	constructor(options: CacheOptions<T> = {}) {
		this.options = {
			maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB default
			maxEntries: options.maxEntries || 1000,
			defaultTtl: options.defaultTtl || 30 * 60 * 1000, // 30 minutes default
			evictionPolicy: options.evictionPolicy || 'lru',
			sizeEstimator: options.sizeEstimator || this.defaultSizeEstimator,
			onEvict: options.onEvict || (() => {})
		};

		this.metrics = {
			hits: 0,
			misses: 0,
			sets: 0,
			evictions: 0,
			currentSize: 0,
			currentEntries: 0,
			maxSize: this.options.maxSize,
			maxEntries: this.options.maxEntries,
			memoryUsage: 0,
			hitRate: 0,
			averageAccessCount: 0
		};

		// Start cleanup timer for TTL entries
		this.startCleanupTimer();
	}

	/**
	 * Get an entry from cache
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key);

		if (!entry) {
			this.metrics.misses++;
			this.updateMetrics();
			return undefined;
		}

		// Check TTL
		if (entry.ttl && Date.now() - entry.createTime > entry.ttl) {
			this.delete(key);
			this.metrics.misses++;
			this.updateMetrics();
			return undefined;
		}

		// Update access statistics
		entry.accessTime = Date.now();
		entry.accessCount++;

		this.metrics.hits++;
		this.updateMetrics();
		return entry.data;
	}

	/**
	 * Set an entry in cache
	 */
	set(key: string, data: T, ttl?: number): void {
		const size = this.options.sizeEstimator(data);
		const now = Date.now();

		// Remove existing entry if present
		if (this.cache.has(key)) {
			const existing = this.cache.get(key)!;
			this.metrics.currentSize -= existing.size;
			this.metrics.currentEntries--;
		}

		const entry: CacheEntry<T> = {
			data,
			accessTime: now,
			createTime: now,
			size,
			accessCount: 1,
			ttl: ttl || this.options.defaultTtl
		};

		this.cache.set(key, entry);
		this.metrics.currentSize += size;
		this.metrics.currentEntries++;
		this.metrics.sets++;

		// Enforce limits
		this.enforceLimits();
		this.updateMetrics();
	}

	/**
	 * Check if key exists in cache
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		// Check TTL
		if (entry.ttl && Date.now() - entry.createTime > entry.ttl) {
			this.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Delete an entry from cache
	 */
	delete(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		this.metrics.currentSize -= entry.size;
		this.metrics.currentEntries--;
		this.options.onEvict(key, entry);

		return this.cache.delete(key);
	}

	/**
	 * Clear all entries from cache
	 */
	clear(): void {
		for (const [key, entry] of this.cache) {
			this.options.onEvict(key, entry);
		}

		this.cache.clear();
		this.metrics.currentSize = 0;
		this.metrics.currentEntries = 0;
		this.updateMetrics();
	}

	/**
	 * Get cache size
	 */
	get size(): number {
		return this.cache.size;
	}

	/**
	 * Get all keys
	 */
	keys(): string[] {
		return Array.from(this.cache.keys());
	}

	/**
	 * Get cache metrics
	 */
	getMetrics(): CacheMetrics {
		return { ...this.metrics };
	}

	/**
	 * Get memory usage in human readable format
	 */
	getMemoryUsage(): string {
		const bytes = this.metrics.memoryUsage;
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	/**
	 * Force cleanup of expired entries
	 */
	cleanup(): number {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.cache) {
			if (entry.ttl && now - entry.createTime > entry.ttl) {
				this.delete(key);
				cleaned++;
			}
		}

		return cleaned;
	}

	/**
	 * Destroy cache and cleanup timers
	 */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}
		this.clear();
	}

	/**
	 * Start automatic cleanup timer
	 */
	private startCleanupTimer(): void {
		// Cleanup every 5 minutes
		this.cleanupTimer = setInterval(
			() => {
				this.cleanup();
			},
			5 * 60 * 1000
		) as unknown as number;
	}

	/**
	 * Update calculated metrics
	 */
	private updateMetrics(): void {
		this.metrics.memoryUsage = this.metrics.currentSize;
		this.metrics.hitRate =
			this.metrics.hits + this.metrics.misses > 0
				? this.metrics.hits / (this.metrics.hits + this.metrics.misses)
				: 0;

		if (this.metrics.currentEntries > 0) {
			const totalAccessCount = Array.from(this.cache.values()).reduce(
				(sum, entry) => sum + entry.accessCount,
				0
			);
			this.metrics.averageAccessCount = totalAccessCount / this.metrics.currentEntries;
		} else {
			this.metrics.averageAccessCount = 0;
		}
	}

	/**
	 * Enforce size and entry limits
	 */
	private enforceLimits(): void {
		// First remove expired entries
		this.cleanup();

		// Enforce entry limit
		while (this.cache.size > this.options.maxEntries) {
			this.evictEntry();
		}

		// Enforce size limit
		while (this.metrics.currentSize > this.options.maxSize) {
			this.evictEntry();
		}
	}

	/**
	 * Evict an entry based on policy
	 */
	private evictEntry(): void {
		if (this.cache.size === 0) return;

		let keyToEvict: string;
		const entries = Array.from(this.cache.entries());

		switch (this.options.evictionPolicy) {
			case 'lru':
				// Least Recently Used
				keyToEvict = entries.reduce(
					(oldest, [key, entry]) =>
						entry.accessTime < oldest.entry.accessTime ? { key, entry } : oldest,
					{ key: entries[0][0], entry: entries[0][1] }
				).key;
				break;

			case 'lfu':
				// Least Frequently Used
				keyToEvict = entries.reduce(
					(least, [key, entry]) =>
						entry.accessCount < least.entry.accessCount ? { key, entry } : least,
					{ key: entries[0][0], entry: entries[0][1] }
				).key;
				break;

			case 'ttl':
				// Shortest TTL remaining
				keyToEvict = entries.reduce(
					(shortest, [key, entry]) => {
						if (!entry.ttl) return { key, entry };
						const remaining = entry.ttl - (Date.now() - entry.createTime);
						const shortestRemaining = shortest.entry.ttl
							? shortest.entry.ttl - (Date.now() - shortest.entry.createTime)
							: Infinity;
						return remaining < shortestRemaining ? { key, entry } : shortest;
					},
					{ key: entries[0][0], entry: entries[0][1] }
				).key;
				break;

			default:
				keyToEvict = entries[0][0];
		}

		this.delete(keyToEvict);
		this.metrics.evictions++;
	}

	/**
	 * Default size estimator for common types
	 */
	private defaultSizeEstimator(data: any): number {
		if (data === null || data === undefined) return 0;

		if (typeof data === 'string') {
			return data.length * 2; // Unicode characters are 2 bytes
		}

		if (typeof data === 'number') {
			return 8; // 64-bit number
		}

		if (typeof data === 'boolean') {
			return 4;
		}

		if (data instanceof ArrayBuffer) {
			return data.byteLength;
		}

		if (data instanceof Blob) {
			return data.size;
		}

		if (data instanceof ImageBitmap) {
			// Estimate based on width * height * 4 bytes (RGBA)
			return (data.width || 0) * (data.height || 0) * 4;
		}

		if (data instanceof ImageData) {
			return data.width * data.height * 4;
		}

		if (data instanceof HTMLImageElement) {
			// Rough estimate - actual size varies
			return 1024 * 1024; // 1MB estimate
		}

		// For objects, try to estimate based on JSON serialization
		try {
			return JSON.stringify(data).length * 2;
		} catch {
			return 1024; // 1KB fallback estimate
		}
	}
}

/**
 * Specialized cache for different data types
 */

export class ImageBitmapCache extends AdvancedCache<ImageBitmap> {
	constructor(options: Omit<CacheOptions<ImageBitmap>, 'sizeEstimator'> = {}) {
		super({
			...options,
			sizeEstimator: (bitmap: ImageBitmap) => (bitmap.width || 0) * (bitmap.height || 0) * 4,
			maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB for images
			maxEntries: options.maxEntries || 500
		});
	}
}

export class ImageDataCache extends AdvancedCache<ImageData> {
	constructor(options: Omit<CacheOptions<ImageData>, 'sizeEstimator'> = {}) {
		super({
			...options,
			sizeEstimator: (imageData: ImageData) => imageData.width * imageData.height * 4,
			maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB for ImageData
			maxEntries: options.maxEntries || 200
		});
	}
}

export class ArrayBufferCache extends AdvancedCache<ArrayBuffer> {
	constructor(options: Omit<CacheOptions<ArrayBuffer>, 'sizeEstimator'> = {}) {
		super({
			...options,
			sizeEstimator: (buffer: ArrayBuffer) => buffer.byteLength,
			maxSize: options.maxSize || 200 * 1024 * 1024, // 200MB for ArrayBuffers
			maxEntries: options.maxEntries || 1000
		});
	}
}
