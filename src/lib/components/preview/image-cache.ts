/**
 * Image cache management for preview component
 * Handles caching and cleanup of images with LRU strategy
 */

export class ImageCache {
	private cache = new Map<string, HTMLImageElement>();
	private accessTimes = new Map<string, number>();
	private readonly maxSize: number;

	constructor(maxSize: number = 20) {
		this.maxSize = maxSize;
	}

	/**
	 * Get an image from cache
	 */
	get(url: string): HTMLImageElement | undefined {
		const image = this.cache.get(url);
		if (image) {
			this.accessTimes.set(url, Date.now());
		}
		return image;
	}

	/**
	 * Set an image in cache
	 */
	set(url: string, image: HTMLImageElement): void {
		this.cache.set(url, image);
		this.accessTimes.set(url, Date.now());
		this.enforceMaxSize();
	}

	/**
	 * Check if image exists in cache
	 */
	has(url: string): boolean {
		return this.cache.has(url);
	}

	/**
	 * Remove specific image from cache
	 */
	delete(url: string): boolean {
		this.accessTimes.delete(url);
		return this.cache.delete(url);
	}

	/**
	 * Clear all cached images
	 */
	clear(): void {
		this.cache.clear();
		this.accessTimes.clear();
	}

	/**
	 * Get cache size
	 */
	get size(): number {
		return this.cache.size;
	}

	/**
	 * Remove stale cache entries that are no longer referenced
	 */
	purgeStaleEntries(activeUrls: Set<string>): void {
		// Remove any cached images that are no longer referenced
		for (const cachedUrl of this.cache.keys()) {
			if (!activeUrls.has(cachedUrl)) {
				this.cache.delete(cachedUrl);
				this.accessTimes.delete(cachedUrl);
			}
		}

		this.enforceMaxSize();
	}

	/**
	 * Enforce maximum cache size using LRU strategy
	 */
	private enforceMaxSize(): void {
		if (this.cache.size > this.maxSize) {
			const entries = Array.from(this.accessTimes.entries());
			entries.sort((a, b) => a[1] - b[1]);

			// Remove oldest entries until we're under the limit
			const toRemove = entries.length - this.maxSize;
			for (let i = 0; i < toRemove; i++) {
				this.cache.delete(entries[i][0]);
				this.accessTimes.delete(entries[i][0]);
			}
		}
	}

	/**
	 * Get all cached URLs for debugging
	 */
	getCachedUrls(): string[] {
		return Array.from(this.cache.keys());
	}
}
