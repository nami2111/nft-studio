/**
 * LRU Cache for ObjectURLs with automatic cleanup
 * Prevents memory leaks by evicting least recently used URLs
 */

export class ObjectUrlCache {
	private cache = new Map<string, { url: string; size: number; lastAccessed: number }>();
	private maxSize: number;
	private maxMemory: number; // in bytes
	private currentMemory = 0;

	/**
	 * @param maxSize Maximum number of URLs to cache
	 * @param maxMemory Maximum memory in bytes (default 100MB)
	 */
	constructor(maxSize = 1000, maxMemory = 100 * 1024 * 1024) {
		this.maxSize = maxSize;
		this.maxMemory = maxMemory;
	}

	/**
	 * Get an ObjectURL for the given image data
	 * Creates a new one if not cached or if cache is full
	 */
	get(id: string, imageData: ArrayBuffer): string {
		const now = Date.now();
		const entry = this.cache.get(id);

		// Return cached URL if it exists
		if (entry) {
			entry.lastAccessed = now;
			return entry.url;
		}

		// Create new ObjectURL
		const url = URL.createObjectURL(new Blob([imageData]));

		// Check if we need to evict - but only if we're significantly over the limit
		// Use 90% threshold to avoid constant evictions
		if (this.cache.size >= this.maxSize * 0.9 || this.currentMemory >= this.maxMemory * 0.9) {
			this.evict();
		}

		// Add to cache
		this.cache.set(id, {
			url,
			size: imageData.byteLength,
			lastAccessed: now
		});
		this.currentMemory += imageData.byteLength;

		return url;
	}

	/**
	 * Preload an image into the cache
	 */
	preload(id: string, imageData: ArrayBuffer): string {
		// If already cached, just update access time
		if (this.cache.has(id)) {
			const entry = this.cache.get(id)!;
			entry.lastAccessed = Date.now();
			return entry.url;
		}

		// Check if we need to evict - use threshold here too
		if (this.cache.size >= this.maxSize * 0.9 || this.currentMemory >= this.maxMemory * 0.9) {
			// Evict multiple items if needed to make room
			const neededMemory = imageData.byteLength;
			const neededEntries = 1;
			let evicted = 0;

			// Keep evicting until we have enough space
			while (
				(this.cache.size >= this.maxSize - neededEntries &&
					evicted < 10) ||
				(this.currentMemory + neededMemory >= this.maxMemory && evicted < 10)
			) {
				this.evict();
				evicted++;
			}
		}

		const url = URL.createObjectURL(new Blob([imageData]));
		this.cache.set(id, {
			url,
			size: imageData.byteLength,
			lastAccessed: Date.now()
		});
		this.currentMemory += imageData.byteLength;

		return url;
	}

	/**
	 * Remove an entry from cache
	 */
	remove(id: string): void {
		const entry = this.cache.get(id);
		if (entry) {
			URL.revokeObjectURL(entry.url);
			this.currentMemory -= entry.size;
			this.cache.delete(id);
		}
	}

	/**
	 * Clear all cached URLs
	 */
	clear(): void {
		this.cache.forEach((entry) => {
			URL.revokeObjectURL(entry.url);
		});
		this.cache.clear();
		this.currentMemory = 0;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): { size: number; memory: number; maxSize: number; maxMemory: number } {
		return {
			size: this.cache.size,
			memory: this.currentMemory,
			maxSize: this.maxSize,
			maxMemory: this.maxMemory
		};
	}

	/**
	 * Evict least recently used entry
	 */
	private evict(): void {
		let oldestKey: string | null = null;
		let oldestTime = Date.now();

		// Find least recently used
		for (const [key, entry] of this.cache.entries()) {
			if (entry.lastAccessed < oldestTime) {
				oldestTime = entry.lastAccessed;
				oldestKey = key;
			}
		}

		// Remove it
		if (oldestKey) {
			this.remove(oldestKey);
		}
	}
}

// Singleton instance for gallery use
export const imageUrlCache = new ObjectUrlCache(2000, 200 * 1024 * 1024); // 2000 images or 200MB
